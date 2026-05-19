// yahoo-finance2's bundled type declarations only expose `quote` and `autoc`.
// We cast the default export to a local interface that describes the full API
// we actually use at runtime, avoiding TS2339 / TS2769 errors from the package.

/* eslint-disable @typescript-eslint/no-explicit-any */
import yfDefault from 'yahoo-finance2';
import type { MarketAdapter, QuoteResult, CandleResult, SearchResult } from './base.js';
import { AdapterError } from './base.js';

interface YahooFinanceApi {
  quote(symbol: string): Promise<Record<string, unknown>>;
  chart(
    symbol: string,
    opts: { period1: Date; period2: Date; interval: string },
  ): Promise<{ quotes: Array<Record<string, unknown>> }>;
  search(query: string): Promise<{ quotes: Array<Record<string, unknown>> }>;
  suppressNotices?: (keys: string[]) => void;
}

const yf = yfDefault as unknown as YahooFinanceApi;

yf.suppressNotices?.(['yahooSurvey']);

export class UsYahooAdapter implements MarketAdapter {
  readonly market = 'US' as const;

  async getQuote(symbol: string): Promise<QuoteResult> {
    try {
      const q = await yf.quote(symbol);
      if (!q || typeof q['regularMarketPrice'] !== 'number') {
        throw new AdapterError('yahoo', `No quote for ${symbol}`);
      }
      return {
        symbol,
        price: q['regularMarketPrice'] as number,
        volume: typeof q['regularMarketVolume'] === 'number' ? (q['regularMarketVolume'] as number) : 0,
        changePct: typeof q['regularMarketChangePercent'] === 'number' ? (q['regularMarketChangePercent'] as number) : 0,
        ts: q['regularMarketTime'] ? new Date(q['regularMarketTime'] as string) : new Date(),
        source: 'yahoo',
        marketCap: typeof q['marketCap'] === 'number' ? (q['marketCap'] as number) : undefined,
        sharesOutstanding:
          typeof q['sharesOutstanding'] === 'number' ? (q['sharesOutstanding'] as number) : undefined,
      };
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('yahoo', `getQuote failed for ${symbol}`, e);
    }
  }

  async getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]> {
    try {
      const result = await yf.chart(symbol, {
        period1: from,
        period2: to,
        interval: '1d',
      });
      const rows = result?.quotes ?? [];
      return rows
        .filter((r) => r['date'] instanceof Date && r['close'] !== null && r['close'] !== undefined)
        .map((r) => ({
          symbol,
          date: (r['date'] as Date).toISOString().slice(0, 10),
          open: r['open'] as number,
          high: r['high'] as number,
          low: r['low'] as number,
          close: r['close'] as number,
          adjClose: typeof r['adjclose'] === 'number' ? (r['adjclose'] as number) : undefined,
          volume: r['volume'] as number,
        }));
    } catch (e) {
      throw new AdapterError('yahoo', `getDailyOHLCV failed for ${symbol}`, e);
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const result = await yf.search(query);
      const items = result?.quotes ?? [];
      return items
        .filter((r) => r['quoteType'] === 'EQUITY' && typeof r['symbol'] === 'string')
        .slice(0, limit)
        .map((r) => ({
          symbol: r['symbol'] as string,
          name: ((r['shortname'] ?? r['longname'] ?? r['symbol']) as string),
          exchange: typeof r['exchange'] === 'string' ? (r['exchange'] as string) : 'UNKNOWN',
          market: 'US' as const,
        }));
    } catch (e) {
      throw new AdapterError('yahoo', `search failed for ${query}`, e);
    }
  }
}
