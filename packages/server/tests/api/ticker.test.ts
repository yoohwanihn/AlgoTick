import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    // getQuote uses chart with range=5d
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
    // getDailyOHLCV uses chart with period1/period2
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
    return { statusCode: 404, body: { json: async () => ({}) } };
  }),
}));

import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  // ensure clean cache so we exercise the cache-miss path
  await getPrisma().validationResult.deleteMany({ where: { symbol: 'AAPL' } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: 'AAPL' } });
  await getPrisma().quoteDaily.deleteMany({ where: { symbol: 'AAPL' } });
  await getPrisma().ingestionLog.deleteMany({ where: { symbol: 'AAPL' } });
});
afterAll(async () => { await app.close(); });

describe('GET /api/ticker/:symbol', () => {
  it('returns 404 when ticker not in master', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ticker/__NOPE__' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with detail for known US ticker', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ticker/AAPL' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.symbol).toBe('AAPL');
    expect(['fresh', 'stale']).toContain(body.freshness);
  }, 30000);
});
