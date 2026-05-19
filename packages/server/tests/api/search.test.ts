import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await getPrisma().ticker.deleteMany({ where: { symbol: 'TSTSEARCH' } });
  await getPrisma().ticker.create({
    data: { symbol: 'TSTSEARCH', market: 'US', exchange: 'NASDAQ', nameEn: 'TestSearch Co', currency: 'USD' },
  });
});
afterAll(async () => {
  await getPrisma().ticker.deleteMany({ where: { symbol: 'TSTSEARCH' } });
  await app.close();
});

describe('GET /api/search', () => {
  it('returns matching tickers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=TSTSEARCH' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.find((r: { symbol: string }) => r.symbol === 'TSTSEARCH')).toBeDefined();
  });

  it('returns 400 when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search' });
    expect(res.statusCode).toBe(400);
  });
});
