import { request } from 'undici';
import type { MarketAdapter, QuoteResult, CandleResult, SearchResult, FinancialPeriod, NewsItem, InsiderTradeItem } from './base.js';
import { AdapterError } from './base.js';
import { loadConfig } from '../config.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AlgoTick/0.1';

const FINNHUB_METRIC_URL = (symbol: string, key: string) =>
  `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(key)}`;

interface FinnhubMetricResponse {
  metric?: Record<string, number | string | null>;
}

/** Finnhub returns dividend yield as a decimal fraction (0.3574 = 0.36%, NOT 35.74%) but other percents are already in % */
function pickNumber(m: Record<string, number | string | null>, key: string): number | null {
  const v = m[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}
const FINNHUB_INSIDER_URL = (symbol: string, key: string) =>
  `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`;

interface FinnhubInsiderRaw {
  id?: string | number;
  name?: string;
  transactionDate?: string;
  filingDate?: string;
  share?: number;
  change?: number;
  transactionPrice?: number;
  transactionCode?: string;
  isDerivative?: boolean;
}
interface FinnhubInsiderResponse {
  symbol?: string;
  data?: FinnhubInsiderRaw[];
}

function classifySide(code: string | undefined, change: number | undefined): 'BUY' | 'SELL' {
  const buyCodes = new Set(['P', 'A', 'M']);
  const sellCodes = new Set(['S', 'F', 'D', 'G']);
  if (code) {
    if (buyCodes.has(code)) return 'BUY';
    if (sellCodes.has(code)) return 'SELL';
  }
  if (typeof change === 'number') return change >= 0 ? 'BUY' : 'SELL';
  return 'SELL';
}

const FINNHUB_NEWS_URL = (symbol: string, fromDate: string, toDate: string, key: string) =>
  `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${toDate}&token=${encodeURIComponent(key)}`;

interface FinnhubNewsRaw {
  id?: number;
  datetime?: number;  // unix epoch seconds
  headline?: string;
  source?: string;
  url?: string;
  summary?: string;
}

function ymdFromOffset(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const CHART_URL = (s: string, from: number, to: number) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?period1=${from}&period2=${to}&interval=1d&includePrePost=false`;
const QUOTE_CHART_URL = (s: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=5d&interval=1d&includePrePost=false`;
const SEARCH_URL = (q: string) =>
  `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;

async function fetchJson<T>(url: string, source = 'yahoo'): Promise<T> {
  const res = await request(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
  if (res.statusCode >= 400) {
    throw new AdapterError(source, `HTTP ${res.statusCode} for ${url}`);
  }
  return (await res.body.json()) as T;
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        symbol?: string;
        regularMarketPrice?: number;
        regularMarketVolume?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open: Array<number | null>;
          high: Array<number | null>;
          low: Array<number | null>;
          close: Array<number | null>;
          volume: Array<number | null>;
        }>;
        adjclose?: Array<{ adjclose: Array<number | null> }>;
      };
    }> | null;
    error?: unknown;
  };
}

interface YahooSearchResponse {
  quotes: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
  }>;
}

export class UsYahooAdapter implements MarketAdapter {
  readonly market = 'US' as const;

  /**
   * Yahoo Finance v7 quote endpoint requires auth (crumb+cookie) as of late 2024.
   * We use the v8 chart endpoint with `range=5d` instead: the `meta` block contains
   * current price/volume/time, and `chartPreviousClose` gives us yesterday's close
   * for computing changePct. marketCap and sharesOutstanding are not available here.
   */
  async getQuote(symbol: string): Promise<QuoteResult> {
    try {
      const body = await fetchJson<YahooChartResponse>(QUOTE_CHART_URL(symbol));
      const result = body.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') {
        throw new AdapterError('yahoo', `No quote for ${symbol}`);
      }
      const prev = meta.chartPreviousClose ?? meta.regularMarketPrice;
      const changePct = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
      return {
        symbol,
        price: meta.regularMarketPrice,
        volume: meta.regularMarketVolume ?? 0,
        changePct,
        ts: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date(),
        source: 'yahoo',
      };
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('yahoo', `getQuote failed for ${symbol}`, e);
    }
  }

  async getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]> {
    try {
      const fromS = Math.floor(from.getTime() / 1000);
      const toS = Math.floor(to.getTime() / 1000);
      const body = await fetchJson<YahooChartResponse>(CHART_URL(symbol, fromS, toS));
      const result = body.chart?.result?.[0];
      if (!result) return [];
      const ts = result.timestamp ?? [];
      const q = result.indicators?.quote?.[0];
      const adjc = result.indicators?.adjclose?.[0]?.adjclose;
      if (!q) return [];
      const out: CandleResult[] = [];
      for (let i = 0; i < ts.length; i++) {
        const close = q.close[i];
        if (close == null || q.open[i] == null || q.high[i] == null || q.low[i] == null) continue;
        out.push({
          symbol,
          date: new Date(ts[i]! * 1000).toISOString().slice(0, 10),
          open: q.open[i]!,
          high: q.high[i]!,
          low: q.low[i]!,
          close,
          adjClose: adjc?.[i] ?? undefined,
          volume: q.volume[i] ?? 0,
        });
      }
      return out;
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('yahoo', `getDailyOHLCV failed for ${symbol}`, e);
    }
  }

  async getFinancials(symbol: string): Promise<FinancialPeriod[]> {
    const cfg = loadConfig();
    if (!cfg.finnhubApiKey || cfg.finnhubApiKey.length === 0) return [];
    try {
      const body = await fetchJson<FinnhubMetricResponse>(FINNHUB_METRIC_URL(symbol, cfg.finnhubApiKey), 'finnhub');
      const m = body.metric;
      if (!m) return [];

      // Period: use current date as asOf, period key = current year
      const now = new Date();
      const year = now.getUTCFullYear();
      const period = `${year}TTM`;  // mark as trailing-12-month snapshot

      // Dividend yield: Finnhub gives decimal fraction, convert to percent for our schema
      const divYieldDec = pickNumber(m, 'currentDividendYieldTTM');
      const dividendYieldPct = divYieldDec !== null ? divYieldDec : null;  // already in % per Finnhub docs spot-check; keep as-is

      const data: Record<string, number | null> = {
        per: pickNumber(m, 'peTTM') ?? pickNumber(m, 'peNormalizedAnnual'),
        pbr: pickNumber(m, 'pbAnnual'),
        psr: pickNumber(m, 'psTTM'),
        roePct: pickNumber(m, 'roeTTM') ?? pickNumber(m, 'roeRfy'),
        eps: pickNumber(m, 'epsTTM') ?? pickNumber(m, 'epsAnnual'),
        dividendYieldPct,
        revenueGrowthYoyPct: pickNumber(m, 'revenueGrowthTTMYoy'),
        marketCapMillionUsd: pickNumber(m, 'marketCapitalization'),
        week52High: pickNumber(m, '52WeekHigh'),
        week52Low: pickNumber(m, '52WeekLow'),
        beta: pickNumber(m, 'beta'),
        currentRatio: pickNumber(m, 'currentRatioAnnual'),
        debtToEquity: pickNumber(m, 'totalDebt/totalEquityAnnual'),
      };

      return [{
        period,
        periodType: 'A',
        asOf: now,
        source: 'finnhub',
        data,
      }];
    } catch (_e) {
      return [];  // Non-fatal: return empty if Finnhub is unreachable or returns invalid
    }
  }

  async getNews(symbol: string, limit = 20): Promise<NewsItem[]> {
    const cfg = loadConfig();
    if (!cfg.finnhubApiKey || cfg.finnhubApiKey.length === 0) return [];
    try {
      const to = ymdFromOffset(0);
      const from = ymdFromOffset(7);
      const body = await fetchJson<FinnhubNewsRaw[]>(FINNHUB_NEWS_URL(symbol, from, to, cfg.finnhubApiKey), 'finnhub');
      if (!Array.isArray(body)) return [];
      return body
        .filter((n) => typeof n.headline === 'string' && n.headline.length > 0 && typeof n.url === 'string')
        .slice(0, limit)
        .map((n): NewsItem => ({
          externalId: `finnhub-${n.id ?? n.url ?? n.headline ?? ''}`,
          title: n.headline as string,
          source: n.source,
          url: n.url as string,
          summary: n.summary && n.summary.length > 0 ? n.summary : undefined,
          publishedAt: n.datetime ? new Date(n.datetime * 1000) : new Date(),
        }));
    } catch (_e) {
      return [];
    }
  }

  async getInsiderTrades(symbol: string, limit = 50): Promise<InsiderTradeItem[]> {
    const cfg = loadConfig();
    if (!cfg.finnhubApiKey || cfg.finnhubApiKey.length === 0) return [];
    try {
      const body = await fetchJson<FinnhubInsiderResponse>(FINNHUB_INSIDER_URL(symbol, cfg.finnhubApiKey), 'finnhub');
      const items = body.data ?? [];
      return items
        .filter((t) => typeof t.name === 'string' && typeof t.transactionDate === 'string' && typeof t.share === 'number')
        .slice(0, limit)
        .map((t): InsiderTradeItem => ({
          externalId: `finnhub-${t.id ?? `${t.name}-${t.transactionDate}-${t.share}`}`,
          tradeDate: new Date(t.transactionDate as string),
          filingDate: t.filingDate ? new Date(t.filingDate) : undefined,
          personName: t.name as string,
          side: classifySide(t.transactionCode, t.change),
          shares: Math.abs(Number(t.share)),
          price: typeof t.transactionPrice === 'number' ? t.transactionPrice : undefined,
          transactionCode: t.transactionCode,
          isDerivative: t.isDerivative,
          source: 'finnhub',
        }));
    } catch (_e) {
      return [];
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const body = await fetchJson<YahooSearchResponse>(SEARCH_URL(query));
      const items = body.quotes ?? [];
      return items
        .filter((r) => r.quoteType === 'EQUITY' && r.symbol)
        .slice(0, limit)
        .map((r) => ({
          symbol: r.symbol!,
          name: r.shortname ?? r.longname ?? r.symbol!,
          exchange: r.exchange ?? 'UNKNOWN',
          market: 'US' as const,
        }));
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('yahoo', `search failed for ${query}`, e);
    }
  }
}
