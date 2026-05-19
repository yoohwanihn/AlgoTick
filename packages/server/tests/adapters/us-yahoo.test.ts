import { describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    // Unknown symbol on quote chart endpoint → empty result
    if (url.includes('UNKNOWN_SYM_XYZ')) {
      return {
        statusCode: 200,
        body: { json: async () => ({ chart: { result: [], error: null } }) },
      };
    }
    // Quote endpoint = chart with range=5d
    if (url.includes('/v8/finance/chart') && url.includes('range=5d')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          chart: { result: [{
            meta: {
              symbol: 'AAPL',
              regularMarketPrice: 234.52,
              regularMarketVolume: 50000000,
              regularMarketTime: 1763568000,
              chartPreviousClose: 231.65,
            },
            timestamp: [1763481600, 1763568000],
            indicators: {
              quote: [{ open: [231, 233], high: [235, 236], low: [229, 232], close: [231, 234.52], volume: [40000000, 50000000] }],
              adjclose: [{ adjclose: [231, 234.52] }],
            },
          }] },
        }) },
      };
    }
    // Chart with explicit period1/period2 (daily history)
    if (url.includes('/v8/finance/chart')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          chart: { result: [{
            meta: { symbol: 'AAPL' },
            timestamp: [1747353600, 1747440000],
            indicators: {
              quote: [{ open: [230, 233], high: [235, 236], low: [229, 232], close: [233, 234], volume: [45000000, 48000000] }],
              adjclose: [{ adjclose: [233, 234] }],
            },
          }] },
        }) },
      };
    }
    if (url.includes('/v1/finance/search')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          quotes: [
            { symbol: 'AAPL', shortname: 'Apple Inc.', exchange: 'NMS', quoteType: 'EQUITY' },
            { symbol: 'AMZN', shortname: 'Amazon.com', exchange: 'NMS', quoteType: 'EQUITY' },
          ],
        }) },
      };
    }
    return { statusCode: 404, body: { json: async () => ({}) } };
  }),
}));

import { UsYahooAdapter } from '../../src/adapters/us-yahoo';

describe('UsYahooAdapter (direct HTTP, chart-based)', () => {
  const adapter = new UsYahooAdapter();

  it('returns quote for AAPL using chart meta', async () => {
    const q = await adapter.getQuote('AAPL');
    expect(q.symbol).toBe('AAPL');
    expect(q.price).toBe(234.52);
    expect(q.source).toBe('yahoo');
    // changePct = (234.52 - 231.65) / 231.65 * 100 ≈ 1.239
    expect(q.changePct).toBeCloseTo(1.239, 1);
  });

  it('throws AdapterError on unknown symbol (empty chart result)', async () => {
    await expect(adapter.getQuote('UNKNOWN_SYM_XYZ')).rejects.toMatchObject({ name: 'AdapterError' });
  });

  it('returns daily candles', async () => {
    const candles = await adapter.getDailyOHLCV('AAPL', new Date('2026-05-15'), new Date('2026-05-16'));
    expect(candles).toHaveLength(2);
    expect(candles[0]?.close).toBe(233);
  });

  it('searches and returns equity results only', async () => {
    const results = await adapter.search('apple');
    expect(results.every(r => r.market === 'US')).toBe(true);
    expect(results[0]?.symbol).toBe('AAPL');
  });
});
