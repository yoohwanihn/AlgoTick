import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
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
