import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();

  // Clean up any previous test data
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['CMP_AAPL', 'CMP_MSFT'] } } });
  await getPrisma().financial.deleteMany({ where: { symbol: { in: ['CMP_AAPL', 'CMP_MSFT'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['CMP_AAPL', 'CMP_MSFT'] } } });

  await getPrisma().ticker.createMany({
    data: [
      { symbol: 'CMP_AAPL', market: 'US', exchange: 'NASDAQ', nameEn: 'Compare Apple Test', currency: 'USD' },
      { symbol: 'CMP_MSFT', market: 'US', exchange: 'NASDAQ', nameEn: 'Compare Microsoft Test', currency: 'USD' },
    ],
  });

  await getPrisma().quoteIntraday.create({
    data: {
      symbol: 'CMP_AAPL',
      ts: new Date('2026-05-19T15:00:00.000Z'),
      price: 175.5,
      volume: 2000000,
      changePct: 1.25,
      source: 'test',
    },
  });

  await getPrisma().financial.create({
    data: {
      symbol: 'CMP_AAPL',
      period: '202412',
      periodType: 'A',
      asOf: new Date('2024-12-31'),
      source: 'test',
      data: { per: 28.5, pbr: 3.2, roePct: 15.6, dividendYieldPct: 0.5 },
    },
  });
});

afterAll(async () => {
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['CMP_AAPL', 'CMP_MSFT'] } } });
  await getPrisma().financial.deleteMany({ where: { symbol: { in: ['CMP_AAPL', 'CMP_MSFT'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['CMP_AAPL', 'CMP_MSFT'] } } });
  await app.close();
});

describe('Compare API', () => {
  it('GET /api/compare?s=CMP_AAPL returns 1 item', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/compare?s=CMP_AAPL' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].symbol).toBe('CMP_AAPL');
    expect(body.items[0].name).toBe('Compare Apple Test');
    expect(body.missingSymbols).toEqual([]);
  });

  it('GET /api/compare?s=CMP_AAPL,CMP_MSFT returns 2 items', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/compare?s=CMP_AAPL,CMP_MSFT' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    const symbols = body.items.map((i: { symbol: string }) => i.symbol);
    expect(symbols).toContain('CMP_AAPL');
    expect(symbols).toContain('CMP_MSFT');
    expect(body.missingSymbols).toEqual([]);
  });

  it('GET /api/compare?s=__NOPE__,CMP_AAPL returns 1 item + missingSymbols includes __NOPE__', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/compare?s=__NOPE__,CMP_AAPL' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].symbol).toBe('CMP_AAPL');
    expect(body.missingSymbols).toContain('__NOPE__');
  });

  it('GET /api/compare with missing s returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/compare' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});
