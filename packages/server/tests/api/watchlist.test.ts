import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  // Ensure test ticker exists
  await getPrisma().ticker.deleteMany({ where: { symbol: 'WLTEST' } });
  await getPrisma().ticker.create({
    data: { symbol: 'WLTEST', market: 'US', exchange: 'NASDAQ', nameEn: 'Watchlist Test', currency: 'USD' },
  });
});
afterAll(async () => {
  await getPrisma().watchlist.deleteMany({ where: { symbol: 'WLTEST' } });
  await getPrisma().ticker.deleteMany({ where: { symbol: 'WLTEST' } });
  await app.close();
});
beforeEach(async () => {
  await getPrisma().watchlist.deleteMany({ where: { symbol: 'WLTEST' } });
});

describe('Watchlist API', () => {
  it('POST /api/watchlist adds a ticker', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/watchlist', payload: { symbol: 'WLTEST', memo: 'test memo' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.item.symbol).toBe('WLTEST');
  });

  it('POST /api/watchlist returns 404 for unknown ticker', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/watchlist', payload: { symbol: '__NOPE__' } });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/watchlist returns 400 for invalid body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/watchlist', payload: { symbol: '' } });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/watchlist returns items', async () => {
    await app.inject({ method: 'POST', url: '/api/watchlist', payload: { symbol: 'WLTEST' } });
    const res = await app.inject({ method: 'GET', url: '/api/watchlist' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.some((i: { symbol: string }) => i.symbol === 'WLTEST')).toBe(true);
  });

  it('DELETE /api/watchlist/:symbol removes', async () => {
    await app.inject({ method: 'POST', url: '/api/watchlist', payload: { symbol: 'WLTEST' } });
    const res = await app.inject({ method: 'DELETE', url: '/api/watchlist/WLTEST' });
    expect(res.statusCode).toBe(200);
    const after = await getPrisma().watchlist.findUnique({ where: { symbol: 'WLTEST' } });
    expect(after).toBeNull();
  });

  it('GET /api/watchlist/has/:symbol', async () => {
    let r = await app.inject({ method: 'GET', url: '/api/watchlist/has/WLTEST' });
    expect(r.json()).toEqual({ exists: false });
    await app.inject({ method: 'POST', url: '/api/watchlist', payload: { symbol: 'WLTEST' } });
    r = await app.inject({ method: 'GET', url: '/api/watchlist/has/WLTEST' });
    expect(r.json()).toEqual({ exists: true });
  });
});
