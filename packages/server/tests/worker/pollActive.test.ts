import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/adapters/us-yahoo', () => ({
  UsYahooAdapter: class {
    market = 'US';
    async getQuote(symbol: string) {
      return {
        symbol, price: 100, volume: 1000, changePct: 1.0,
        ts: new Date('2026-05-19T15:00:00Z'), source: 'yahoo',
        marketCap: 100_000, sharesOutstanding: 1000,
      };
    }
    async getDailyOHLCV() { return []; }
    async search() { return []; }
  },
}));

import { getPrisma } from '../../src/db';
import { pollActive } from '../../src/worker/jobs/pollActive';

describe('pollActive', () => {
  beforeEach(async () => {
    await getPrisma().quoteIntraday.deleteMany({ where: { symbol: 'WTST1' } });
    await getPrisma().ingestionLog.deleteMany({ where: { symbol: 'WTST1' } });
    await getPrisma().ticker.deleteMany({ where: { symbol: 'WTST1' } });
    await getPrisma().ticker.create({
      data: { symbol: 'WTST1', market: 'US', exchange: 'NASDAQ', nameEn: 'Worker Test', currency: 'USD' },
    });
    process.env.WATCHLIST_SYMBOLS = 'WTST1';
  });

  it('fetches and persists quote for WATCHLIST_SYMBOLS', async () => {
    const result = await pollActive();
    expect(result.updated).toBe(1);
    const q = await getPrisma().quoteIntraday.findFirst({ where: { symbol: 'WTST1' } });
    expect(q).not.toBeNull();
  });

  it('skips non-US tickers (Stage 4까지)', async () => {
    await getPrisma().ticker.deleteMany({ where: { symbol: 'WTSTKR' } });
    await getPrisma().ticker.create({
      data: { symbol: 'WTSTKR', market: 'KR', exchange: 'KOSPI', nameKo: 'KR Test', currency: 'KRW' },
    });
    process.env.WATCHLIST_SYMBOLS = 'WTSTKR';
    const result = await pollActive();
    expect(result.updated).toBe(0);
  });
});
