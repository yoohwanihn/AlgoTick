import { request } from 'undici';
import type { MarketAdapter, QuoteResult, CandleResult, SearchResult, FinancialPeriod, NewsItem } from './base.js';
import { AdapterError } from './base.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AlgoTick/0.1';
const INTEG_URL = (code: string) => `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`;
const NEWS_URL = (code: string, pageSize = 20) =>
  `https://m.stock.naver.com/api/news/stock/${encodeURIComponent(code)}?pageSize=${pageSize}`;

interface NaverNewsItem {
  id?: string;
  officeId?: string;
  articleId?: string;
  officeName?: string;
  datetime?: string;  // "YYYYMMDDHHmm"
  title?: string;
  body?: string;
}
interface NaverNewsWrapper { total?: number; items?: NaverNewsItem[]; }

function parseNaverNewsDatetime(s: string | undefined): Date {
  if (!s || s.length < 12) return new Date();
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const mi = Number(s.slice(10, 12));
  // 한국 시간 (KST) → UTC 변환 (KST = UTC+9)
  const kstMs = Date.UTC(y, mo - 1, d, h, mi, 0);
  return new Date(kstMs - 9 * 60 * 60 * 1000);
}
const FINANCE_ANNUAL_URL = (code: string) => `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/finance/annual`;
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
const NAVER_FIELD_MAP: Record<string, string> = {
  '매출액': 'revenue',
  '영업이익': 'opIncome',
  '당기순이익': 'netIncome',
  '지배주주순이익': 'netIncomeAttributableToOwners',
  '영업이익률': 'operatingMarginPct',
  '순이익률': 'netMarginPct',
  'ROE': 'roePct',
  '부채비율': 'debtRatioPct',
  '당좌비율': 'quickRatioPct',
  '유보율': 'retainedEarningsRatioPct',
  'EPS': 'eps',
  'PER': 'per',
  'BPS': 'bps',
  'PBR': 'pbr',
  '현금DPS': 'cashDps',
  '현금배당수익률': 'dividendYieldPct',
  '현금배당성향': 'dividendPayoutPct',
};

interface NaverFinanceCell { value?: string; cx?: unknown; }
interface NaverFinanceRow { title: string; columns: Record<string, NaverFinanceCell> }
interface NaverFinanceTrTitle { isConsensus?: 'Y' | 'N'; title?: string; key: string }
interface NaverFinanceResponse {
  financeInfo?: { rowList?: NaverFinanceRow[]; trTitleList?: NaverFinanceTrTitle[]; };
}

function parsePeriodToDate(key: string): Date {
  // "202312" → 2023-12-31
  if (key.length !== 6) return new Date();
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(4, 6));
  // Treat as end-of-month (last day of given month)
  return new Date(Date.UTC(y, m, 0, 23, 59, 59));
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

  async getNews(symbol: string, limit = 20): Promise<NewsItem[]> {
    try {
      const code = stripKrSuffix(symbol);
      const body = await fetchJson<NaverNewsWrapper[]>(NEWS_URL(code, limit));
      const wrap = Array.isArray(body) ? body[0] : undefined;
      const items = wrap?.items ?? [];
      return items
        .filter((n): n is NaverNewsItem & { officeId: string; articleId: string; title: string } =>
          typeof n.officeId === 'string' && typeof n.articleId === 'string' && typeof n.title === 'string')
        .slice(0, limit)
        .map((n): NewsItem => ({
          externalId: `naver-${n.officeId}-${n.articleId}`,
          title: n.title,
          source: n.officeName,
          url: `https://n.news.naver.com/article/${n.officeId}/${n.articleId}`,
          summary: n.body && n.body.length > 0 ? n.body.slice(0, 200) : undefined,
          publishedAt: parseNaverNewsDatetime(n.datetime),
        }));
    } catch (_e) {
      return [];
    }
  }

  async getFinancials(symbol: string): Promise<FinancialPeriod[]> {
    try {
      const code = stripKrSuffix(symbol);
      const body = await fetchJson<NaverFinanceResponse>(FINANCE_ANNUAL_URL(code));
      const fi = body.financeInfo;
      if (!fi || !fi.trTitleList || !fi.rowList) return [];

      const trTitleList: NaverFinanceTrTitle[] = fi.trTitleList;
      const rowList: NaverFinanceRow[] = fi.rowList;
      const out: FinancialPeriod[] = [];
      for (const trTitle of trTitleList) {
        if (!trTitle.key) continue;
        if (trTitle.isConsensus === 'Y') continue;  // 컨센서스 (예측) 제외
        const data: Record<string, number | null> = {};
        for (const finRow of rowList) {
          const std = NAVER_FIELD_MAP[finRow.title];
          if (!std) continue;
          const cell = finRow.columns?.[trTitle.key];
          if (!cell || cell.value === '-' || cell.value === undefined || cell.value === null) {
            data[std] = null;
          } else {
            const n = parseKrNumber(cell.value);
            data[std] = Number.isFinite(n) ? n : null;
          }
        }
        out.push({
          period: trTitle.key,
          periodType: 'A',
          asOf: parsePeriodToDate(trTitle.key),
          source: 'naver',
          data,
        });
      }
      return out;
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('naver', `getFinancials failed for ${symbol}`, e);
    }
  }
}
