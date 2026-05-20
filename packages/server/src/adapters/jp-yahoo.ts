import { request } from 'undici';
import type { MarketAdapter, QuoteResult, CandleResult, SearchResult, FinancialPeriod, NewsItem, InsiderTradeItem, CompanyProfile } from './base.js';
import { AdapterError } from './base.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AlgoTick/0.1';
const CHART_URL = (s: string, from: number, to: number) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?period1=${from}&period2=${to}&interval=1d&includePrePost=false`;
const QUOTE_CHART_URL = (s: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=5d&interval=1d&includePrePost=false`;
const SEARCH_URL = (q: string) =>
  `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;

async function fetchJson<T>(url: string, source = 'yahoo-jp'): Promise<T> {
  const res = await request(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
  if (res.statusCode >= 400) throw new AdapterError(source, `HTTP ${res.statusCode} for ${url}`);
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
        currency?: string;
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

export class JpYahooAdapter implements MarketAdapter {
  readonly market = 'JP' as const;

  async getQuote(symbol: string): Promise<QuoteResult> {
    try {
      const body = await fetchJson<YahooChartResponse>(QUOTE_CHART_URL(symbol));
      const result = body.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') {
        throw new AdapterError('yahoo-jp', `No quote for ${symbol}`);
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
      throw new AdapterError('yahoo-jp', `getQuote failed for ${symbol}`, e);
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
      throw new AdapterError('yahoo-jp', `getDailyOHLCV failed for ${symbol}`, e);
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const body = await fetchJson<YahooSearchResponse>(SEARCH_URL(query));
      const items = body.quotes ?? [];
      return items
        .filter((r) => r.quoteType === 'EQUITY' && r.symbol && r.symbol.endsWith('.T'))
        .slice(0, limit)
        .map((r) => ({
          symbol: r.symbol!,
          name: r.shortname ?? r.longname ?? r.symbol!,
          exchange: 'TSE',
          market: 'JP' as const,
        }));
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('yahoo-jp', `search failed for ${query}`, e);
    }
  }

  // Stubs — Finnhub doesn't cover JP in free tier
  async getFinancials(_symbol: string): Promise<FinancialPeriod[]> { return []; }
  async getNews(_symbol: string, _limit?: number): Promise<NewsItem[]> { return []; }
  async getInsiderTrades(_symbol: string, _limit?: number): Promise<InsiderTradeItem[]> { return []; }
  async getProfile(_symbol: string): Promise<CompanyProfile | null> { return null; }
}
