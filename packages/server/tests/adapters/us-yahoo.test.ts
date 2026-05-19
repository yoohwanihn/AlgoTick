import { describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/yahoo-AAPL-quote.json';

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(async (symbol: string) => {
      if (symbol === 'AAPL') return fixture;
      throw new Error('Not found');
    }),
    chart: vi.fn(async (_symbol: string, _opts: object) => ({
      quotes: [
        { date: new Date('2026-05-15'), open: 230, high: 235, low: 229, close: 233, adjclose: 233, volume: 45000000 },
        { date: new Date('2026-05-16'), open: 233, high: 236, low: 232, close: 234, adjclose: 234, volume: 48000000 },
      ],
    })),
    search: vi.fn(async (_q: string) => ({
      quotes: [
        { symbol: 'AAPL', shortname: 'Apple Inc.', exchange: 'NMS', quoteType: 'EQUITY' },
        { symbol: 'AMZN', shortname: 'Amazon.com', exchange: 'NMS', quoteType: 'EQUITY' },
      ],
    })),
    suppressNotices: vi.fn(),
  },
}));

import { UsYahooAdapter } from '../../src/adapters/us-yahoo';

describe('UsYahooAdapter', () => {
  const adapter = new UsYahooAdapter();

  it('returns quote for AAPL', async () => {
    const q = await adapter.getQuote('AAPL');
    expect(q.symbol).toBe('AAPL');
    expect(q.price).toBe(234.52);
    expect(q.source).toBe('yahoo');
  });

  it('throws AdapterError on unknown symbol', async () => {
    await expect(adapter.getQuote('XXXXX')).rejects.toMatchObject({ name: 'AdapterError' });
  });

  it('returns daily candles', async () => {
    const candles = await adapter.getDailyOHLCV('AAPL', new Date('2026-05-15'), new Date('2026-05-16'));
    expect(candles).toHaveLength(2);
    expect(candles[0]?.date).toBe('2026-05-15');
    expect(candles[0]?.close).toBe(233);
  });

  it('searches and returns equity results only', async () => {
    const results = await adapter.search('apple');
    expect(results.every(r => r.market === 'US')).toBe(true);
    expect(results[0]?.symbol).toBe('AAPL');
  });
});
