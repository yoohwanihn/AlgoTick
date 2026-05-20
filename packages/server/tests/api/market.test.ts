import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;

const TEST_INDEX_CODE = '^TST_IDX';

beforeAll(async () => {
  app = await buildApp();

  // Clean up any previous test data
  await getPrisma().indexQuoteIntraday.deleteMany({ where: { code: TEST_INDEX_CODE } });
  await getPrisma().marketIndex.deleteMany({ where: { code: TEST_INDEX_CODE } });
  await getPrisma().marketEvent.deleteMany({ where: { title: { startsWith: '__TEST_EVENT__' } } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['MKT_AAPL', 'MKT_GOOG'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['MKT_AAPL', 'MKT_GOOG'] } } });

  // Seed test index
  await getPrisma().marketIndex.create({
    data: { code: TEST_INDEX_CODE, name: 'Test Index', market: 'US', kind: 'index', position: 99 },
  });
  await getPrisma().indexQuoteIntraday.create({
    data: { code: TEST_INDEX_CODE, ts: new Date('2026-05-19T15:00:00.000Z'), value: 5200.5, changePct: 0.42, source: 'test' },
  });

  // Seed test tickers for sector / mover tests
  await getPrisma().ticker.createMany({
    data: [
      { symbol: 'MKT_AAPL', market: 'US', exchange: 'NASDAQ', nameEn: 'Market Apple Test', sector: 'Technology', currency: 'USD' },
      { symbol: 'MKT_GOOG', market: 'US', exchange: 'NASDAQ', nameEn: 'Market Google Test', sector: 'Technology', currency: 'USD' },
    ],
  });
  await getPrisma().quoteIntraday.createMany({
    data: [
      { symbol: 'MKT_AAPL', ts: new Date('2026-05-19T15:00:00.000Z'), price: 175.5, volume: 3000000n, changePct: 2.5, source: 'test' },
      { symbol: 'MKT_GOOG', ts: new Date('2026-05-19T15:00:00.000Z'), price: 140.0, volume: 1000000n, changePct: -1.2, source: 'test' },
    ],
  });

  // Seed test market event
  await getPrisma().marketEvent.create({
    data: {
      eventDate: new Date(Date.now() + 2 * 86400_000),
      market: 'US',
      kind: 'earnings',
      symbol: 'MKT_AAPL',
      title: '__TEST_EVENT__ MKT_AAPL Earnings',
      meta: { epsEstimate: 1.5 },
    },
  });
});

afterAll(async () => {
  await getPrisma().indexQuoteIntraday.deleteMany({ where: { code: TEST_INDEX_CODE } });
  await getPrisma().marketIndex.deleteMany({ where: { code: TEST_INDEX_CODE } });
  await getPrisma().marketEvent.deleteMany({ where: { title: { startsWith: '__TEST_EVENT__' } } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['MKT_AAPL', 'MKT_GOOG'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['MKT_AAPL', 'MKT_GOOG'] } } });
  await app.close();
});

describe('Market API', () => {
  it('GET /api/market/indices returns array with seeded index', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/market/indices' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    const idx = body.items.find((i: { code: string }) => i.code === TEST_INDEX_CODE);
    expect(idx).toBeDefined();
    expect(idx.name).toBe('Test Index');
    expect(idx.value).toBeCloseTo(5200.5, 1);
    expect(idx.changePct).toBeCloseTo(0.42, 2);
  });

  it('GET /api/market/sectors?market=US returns array with sector data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/market/sectors?market=US' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    if (body.items.length > 0) {
      const first = body.items[0];
      expect(first).toHaveProperty('sector');
      expect(first).toHaveProperty('avgChangePct');
      expect(first).toHaveProperty('count');
      expect(first).toHaveProperty('totalVolume');
    }
  });

  it('GET /api/market/movers?direction=up returns items sorted by changePct desc', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/market/movers?market=US&direction=up&limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    // Verify descending order if 2+ items
    for (let i = 1; i < body.items.length; i++) {
      expect(body.items[i - 1].changePct).toBeGreaterThanOrEqual(body.items[i].changePct);
    }
    // Check our test tickers are there
    const appl = body.items.find((m: { symbol: string }) => m.symbol === 'MKT_AAPL');
    expect(appl).toBeDefined();
    expect(appl.changePct).toBeCloseTo(2.5, 1);
  });

  it('GET /api/market/movers?direction=down returns items sorted by changePct asc', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/market/movers?market=US&direction=down&limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    // Verify ascending order if 2+ items
    for (let i = 1; i < body.items.length; i++) {
      expect(body.items[i - 1].changePct).toBeLessThanOrEqual(body.items[i].changePct);
    }
  });

  it('GET /api/market/events returns array (may be empty)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/market/events' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    // We seeded one event 2 days from now
    const testEvent = body.items.find((e: { title: string }) => e.title.startsWith('__TEST_EVENT__'));
    expect(testEvent).toBeDefined();
    expect(testEvent.kind).toBe('earnings');
    expect(testEvent.market).toBe('US');
  });

  it('GET /api/market/news returns array (may be empty)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/market/news' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('GET /api/market/news dedup: 같은 제목 다른 externalId는 1회만 노출', async () => {
    const prisma = getPrisma();
    const baseTitle = '__DEDUP_TEST__ Stocks fall as yields rise';
    await prisma.news.deleteMany({ where: { title: baseTitle } });
    try {
      // 같은 제목·source가 다른 externalId로 3건 들어간 상황을 재현
      for (let i = 0; i < 3; i++) {
        await prisma.news.create({
          data: {
            symbol: null, scope: 'market', market: 'GLOBAL',
            externalId: `dedup-${i}-${Date.now()}`,
            title: baseTitle, source: 'Reuters', url: `https://example.com/${i}`,
            publishedAt: new Date(),
          },
        });
      }
      const res = await app.inject({ method: 'GET', url: '/api/market/news?limit=30' });
      const body = res.json();
      const matched = body.items.filter((n: { title: string }) => n.title === baseTitle);
      expect(matched.length).toBe(1);
    } finally {
      await prisma.news.deleteMany({ where: { title: baseTitle } });
    }
  });
});
