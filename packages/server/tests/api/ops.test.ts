import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;

const TEST_SYMBOL = '__OPS_TEST__';

beforeAll(async () => {
  app = await buildApp();

  // Seed a validation result for testing
  await getPrisma().validationResult.deleteMany({ where: { symbol: TEST_SYMBOL } });
  await getPrisma().validationResult.createMany({
    data: [
      {
        symbol: TEST_SYMBOL,
        kind: 'quote',
        ts: new Date(),
        severity: 'warning',
        code: 'TEST_WARN',
        message: 'test warning',
        details: null,
      },
      {
        symbol: TEST_SYMBOL,
        kind: 'daily',
        ts: new Date(),
        severity: 'error',
        code: 'TEST_ERR',
        message: 'test error',
        details: null,
      },
    ],
  });
});

afterAll(async () => {
  await getPrisma().validationResult.deleteMany({ where: { symbol: TEST_SYMBOL } });
  await app.close();
});

describe('Ops API', () => {
  it('GET /api/__stats__ returns counts object with all required keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/__stats__' });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body).toHaveProperty('ts');
    expect(body).toHaveProperty('counts');
    expect(body).toHaveProperty('validationsLast24h');
    expect(body).toHaveProperty('recentIngestion');

    const { counts } = body;
    expect(counts).toHaveProperty('tickers');
    expect(counts).toHaveProperty('quotesIntraday');
    expect(counts).toHaveProperty('quotesDaily');
    expect(counts).toHaveProperty('financials');
    expect(counts).toHaveProperty('news');
    expect(counts).toHaveProperty('insiderTrades');
    expect(counts).toHaveProperty('indices');
    expect(counts).toHaveProperty('watchlist');
    expect(counts).toHaveProperty('portfolioLots');
    expect(counts).toHaveProperty('screenerRules');
    expect(counts).toHaveProperty('marketEvents');

    expect(typeof counts.tickers).toBe('number');
    expect(typeof body.validationsLast24h.warnings).toBe('number');
    expect(typeof body.validationsLast24h.errors).toBe('number');
    expect(Array.isArray(body.recentIngestion)).toBe(true);

    // SSE 통계
    expect(body.sse).toBeDefined();
    expect(typeof body.sse.clients).toBe('number');
    expect(typeof body.sse.uniqueSymbols).toBe('number');
    expect(typeof body.sse.totalSubscriptions).toBe('number');

    // Our seeded rows should be counted in validationsLast24h
    expect(body.validationsLast24h.warnings).toBeGreaterThanOrEqual(1);
    expect(body.validationsLast24h.errors).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/__validations__ returns array (may be empty)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/__validations__?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);

    // We seeded validation results so there should be at least our 2 rows
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    const item = body.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('symbol');
    expect(item).toHaveProperty('kind');
    expect(item).toHaveProperty('ts');
    expect(item).toHaveProperty('severity');
    expect(item).toHaveProperty('code');
    expect(item).toHaveProperty('message');
    expect(item).toHaveProperty('details');
  });

  it('GET /api/__validations__?severity=invalid is rejected gracefully (severity ignored)', async () => {
    // Invalid severity should be ignored — treated as "no severity filter"
    const res = await app.inject({ method: 'GET', url: '/api/__validations__?severity=invalid&limit=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    // All items should be returned without severity filter (our seeded rows are included)
    // The invalid severity should be silently ignored, not cause a server error
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });
});
