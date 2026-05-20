import { describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    if (url.includes('/v8/finance/chart/7203.T') && url.includes('range=5d')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          chart: { result: [{
            meta: { symbol: '7203.T', regularMarketPrice: 2966.5, regularMarketVolume: 12345678, regularMarketTime: 1779100000, chartPreviousClose: 2950, currency: 'JPY' },
            timestamp: [1779100000], indicators: { quote: [{ open: [2960], high: [2980], low: [2950], close: [2966.5], volume: [12345678] }] },
          }] },
        }) },
      };
    }
    if (url.includes('/v8/finance/chart/7203.T')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          chart: { result: [{
            meta: { symbol: '7203.T' },
            timestamp: [1779000000, 1779100000],
            indicators: { quote: [{ open: [2940, 2960], high: [2970, 2980], low: [2920, 2950], close: [2950, 2966.5], volume: [10000000, 12345678] }], adjclose: [{ adjclose: [2950, 2966.5] }] },
          }] },
        }) },
      };
    }
    if (url.includes('/v1/finance/search')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          quotes: [
            { symbol: '7203.T', shortname: 'Toyota Motor', exchange: 'JPX', quoteType: 'EQUITY' },
            { symbol: 'TM',     shortname: 'Toyota ADR',  exchange: 'NYQ', quoteType: 'EQUITY' },
          ],
        }) },
      };
    }
    return { statusCode: 404, body: { json: async () => ({}), text: async () => '' } };
  }),
}));

import { JpYahooAdapter } from '../../src/adapters/jp-yahoo';

describe('JpYahooAdapter', () => {
  const adapter = new JpYahooAdapter();

  it('returns JPY quote for 7203.T', async () => {
    const q = await adapter.getQuote('7203.T');
    expect(q.symbol).toBe('7203.T');
    expect(q.price).toBe(2966.5);
    expect(q.changePct).toBeCloseTo(((2966.5 - 2950) / 2950) * 100, 3);
    expect(q.source).toBe('yahoo');
  });

  it('returns daily candles', async () => {
    const candles = await adapter.getDailyOHLCV('7203.T', new Date('2026-05-15'), new Date('2026-05-19'));
    expect(candles.length).toBeGreaterThan(0);
    expect(candles[0]?.symbol).toBe('7203.T');
  });

  it('search filters to .T suffix only', async () => {
    const results = await adapter.search('toyota');
    expect(results.length).toBe(1);
    expect(results[0]?.symbol).toBe('7203.T');
    expect(results[0]?.market).toBe('JP');
  });

  it('stub methods return empty', async () => {
    expect(await adapter.getFinancials('7203.T')).toEqual([]);
    expect(await adapter.getNews('7203.T')).toEqual([]);
    expect(await adapter.getInsiderTrades('7203.T')).toEqual([]);
    expect(await adapter.getProfile('7203.T')).toBeNull();
  });
});
