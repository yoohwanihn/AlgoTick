import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPrisma } from '../../src/db';
import { getTickerDetail } from '../../src/services/tickerService';

const mockAdapter = {
  market: 'US' as const,
  getQuote: vi.fn(async (symbol: string) => ({
    symbol,
    price: 100,
    volume: 1000,
    changePct: 1.0,
    ts: new Date('2026-05-19T15:00:00Z'),
    source: 'yahoo',
    marketCap: 100_000,
    sharesOutstanding: 1000,
  })),
  getDailyOHLCV: vi.fn(async () => [
    { symbol: 'TST', date: '2026-05-18', open: 99, high: 101, low: 98, close: 100, volume: 1000 },
  ]),
  search: vi.fn(async () => []),
  getFinancials: vi.fn(async () => []),
  getNews: vi.fn(async () => []),
  getInsiderTrades: vi.fn(async () => []),
};

beforeEach(async () => {
  await getPrisma().insiderTrade.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().ingestionLog.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().quoteDaily.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().validationResult.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().ticker.deleteMany({ where: { symbol: 'TICKERTST' } });
  await getPrisma().ticker.create({
    data: { symbol: 'TICKERTST', market: 'US', exchange: 'NASDAQ', nameEn: 'Test', currency: 'USD' },
  });
  mockAdapter.getQuote.mockClear();
  mockAdapter.getDailyOHLCV.mockClear();
  mockAdapter.getFinancials.mockClear();
  mockAdapter.getNews.mockClear();
  mockAdapter.getInsiderTrades.mockClear();
});

describe('getTickerDetail', () => {
  it('cache miss: fetches from adapter and persists', async () => {
    const result = await getTickerDetail('TICKERTST', mockAdapter);
    expect(mockAdapter.getQuote).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getDailyOHLCV).toHaveBeenCalledTimes(1);
    expect(result.freshness).toBe('fresh');
    expect(result.data.quote!.price).toBe(100);
    expect(result.warnings).toBeDefined();

    const persisted = await getPrisma().quoteIntraday.findFirst({ where: { symbol: 'TICKERTST' } });
    expect(persisted).not.toBeNull();
  });

  it('returns warnings array when validator emits warnings (PRICE_JUMP_LARGE)', async () => {
    await getTickerDetail('TICKERTST', mockAdapter);
    mockAdapter.getDailyOHLCV.mockResolvedValueOnce([
      { symbol: 'TICKERTST', date: '2026-05-18', open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { symbol: 'TICKERTST', date: '2026-05-19', open: 100, high: 145, low: 100, close: 140, volume: 1000 },
    ]);
    await getPrisma().ingestionLog.update({
      where: { symbol_kind: { symbol: 'TICKERTST', kind: 'quote' } },
      data: { lastFetchedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });
    const result = await getTickerDetail('TICKERTST', mockAdapter);
    expect(result.warnings).toBeDefined();
  });

  it('cache hit & fresh: returns DB without adapter call', async () => {
    await getTickerDetail('TICKERTST', mockAdapter);
    mockAdapter.getQuote.mockClear();
    mockAdapter.getDailyOHLCV.mockClear();

    const result = await getTickerDetail('TICKERTST', mockAdapter);
    expect(mockAdapter.getQuote).not.toHaveBeenCalled();
    expect(result.freshness).toBe('fresh');
  });

  it('cache hit & stale: returns DB immediately and marks stale', async () => {
    await getTickerDetail('TICKERTST', mockAdapter);
    await getPrisma().ingestionLog.update({
      where: { symbol_kind: { symbol: 'TICKERTST', kind: 'quote' } },
      data: { lastFetchedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });
    mockAdapter.getQuote.mockClear();

    const result = await getTickerDetail('TICKERTST', mockAdapter);
    expect(result.freshness).toBe('stale');
  });

  it('throws when ticker symbol unknown in master', async () => {
    await expect(getTickerDetail('UNKNOWN_X_Y_Z', mockAdapter)).rejects.toThrow(/not found/i);
  });
});
