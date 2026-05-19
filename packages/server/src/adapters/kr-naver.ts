import { request } from 'undici';
import type { MarketAdapter, QuoteResult, CandleResult, SearchResult } from './base.js';
import { AdapterError } from './base.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AlgoTick/0.1';
const INTEG_URL = (code: string) => `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`;
const SISE_URL = (code: string, from: string, to: string) =>
  `https://api.finance.naver.com/siseJson.naver?symbol=${encodeURIComponent(code)}&requestType=1&startTime=${from}&endTime=${to}&timeframe=day`;

export function stripKrSuffix(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/i, '');
}

/** "281,000" → 281000, "-5,500" → -5500, "+1,418,906" → 1418906 */
export function parseKrNumber(s: string | undefined | null): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[+,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "48.61%" → 48.61 */
export function parseKrPercent(s: string | undefined | null): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[%,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** "1,610조 6,498억" → 161064980000000 (원 단위) */
export function parseKrMarketValue(s: string | undefined | null): number {
  if (!s) return 0;
  const txt = String(s).replace(/,/g, '').replace(/\s+/g, '');
  let total = 0;
  const joMatch = txt.match(/(\d+(?:\.\d+)?)조/);
  if (joMatch) total += Number(joMatch[1]) * 1e12;
  const eokMatch = txt.match(/(\d+(?:\.\d+)?)억/);
  if (eokMatch) total += Number(eokMatch[1]) * 1e8;
  if (!joMatch && !eokMatch) {
    // 단순 숫자(콤마 제거)
    const n = Number(txt);
    if (Number.isFinite(n)) total = n;
  }
  return total;
}

/** "20260519" → Date(2026-05-19T15:30:00Z) (한국 장 마감 KST 15:30 = UTC 06:30) */
export function parseKrBizDate(s: string | undefined | null): Date {
  if (!s || s.length !== 8) return new Date();
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  // 한국 장 마감 시각으로 보정 (UTC 06:30 = KST 15:30)
  return new Date(Date.UTC(y, m - 1, d, 6, 30, 0));
}

interface NaverTotalInfo { code: string; value: string; }
interface NaverDealTrend {
  itemCode: string;
  bizdate: string;
  closePrice: string;
  compareToPreviousClosePrice: string;
  accumulatedTradingVolume: string;
}
interface NaverIntegrationResponse {
  stockName?: string;
  totalInfos?: NaverTotalInfo[];
  dealTrendInfos?: NaverDealTrend[];
}

async function fetchJson<T>(url: string, source = 'naver'): Promise<T> {
  const res = await request(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
  if (res.statusCode >= 400) throw new AdapterError(source, `HTTP ${res.statusCode} for ${url}`);
  return (await res.body.json()) as T;
}

/** siseJson은 strict JSON 아님 — 단일 quote를 double로 변환 후 parse */
async function fetchSiseArray(url: string): Promise<unknown[][]> {
  const res = await request(url, { headers: { 'User-Agent': UA } });
  if (res.statusCode >= 400) throw new AdapterError('naver', `HTTP ${res.statusCode} for ${url}`);
  const text = (await res.body.text()).trim();
  // 단일 quote → double, 줄바꿈/탭 정리
  const cleaned = text.replace(/'/g, '"').replace(/\s+/g, ' ');
  try {
    return JSON.parse(cleaned) as unknown[][];
  } catch (e) {
    throw new AdapterError('naver', `siseJson parse failed: ${(e as Error).message}`, e);
  }
}

export class KrNaverAdapter implements MarketAdapter {
  readonly market = 'KR' as const;

  async getQuote(symbol: string): Promise<QuoteResult> {
    try {
      const code = stripKrSuffix(symbol);
      const body = await fetchJson<NaverIntegrationResponse>(INTEG_URL(code));
      const trend = body.dealTrendInfos?.[0];
      if (!trend || !trend.closePrice) throw new AdapterError('naver', `No quote for ${symbol}`);
      const price = parseKrNumber(trend.closePrice);
      const compare = parseKrNumber(trend.compareToPreviousClosePrice);
      const prevClose = price - compare;
      const changePct = prevClose > 0 ? (compare / prevClose) * 100 : 0;
      const volume = parseKrNumber(trend.accumulatedTradingVolume);
      const ts = parseKrBizDate(trend.bizdate);
      const totals = body.totalInfos ?? [];
      const mvRaw = totals.find((t) => t.code === 'marketValue')?.value;
      const marketCap = mvRaw ? parseKrMarketValue(mvRaw) : undefined;
      return {
        symbol,
        price,
        volume,
        changePct,
        ts,
        source: 'naver',
        marketCap,
      };
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('naver', `getQuote failed for ${symbol}`, e);
    }
  }

  async getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]> {
    try {
      const code = stripKrSuffix(symbol);
      const fmt = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      const rows = await fetchSiseArray(SISE_URL(code, fmt(from), fmt(to)));
      // rows[0] = header. rows[1..] = data
      const out: CandleResult[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row) || row.length < 6) continue;
        const dateStr = String(row[0]);
        if (dateStr.length !== 8) continue;
        const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        const open = Number(row[1]);
        const high = Number(row[2]);
        const low = Number(row[3]);
        const close = Number(row[4]);
        const volume = Number(row[5]);
        if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
        out.push({ symbol, date, open, high, low, close, volume });
      }
      return out;
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('naver', `getDailyOHLCV failed for ${symbol}`, e);
    }
  }

  async search(_query: string, _limit = 10): Promise<SearchResult[]> {
    // KR search는 DB 시드(tickers 테이블)에서 처리. 어댑터 search는 빈 결과.
    return [];
  }
}
