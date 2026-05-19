import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;

const TEST_RULE_NAME = 'TEST_RULE_screener';

beforeAll(async () => {
  app = await buildApp();

  // Seed a US ticker with a quote and financials for testing
  await getPrisma().screenerRule.deleteMany({ where: { name: TEST_RULE_NAME } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['SCRNTEST_US', 'SCRNTEST_KR'] } } });
  await getPrisma().financial.deleteMany({ where: { symbol: { in: ['SCRNTEST_US', 'SCRNTEST_KR'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['SCRNTEST_US', 'SCRNTEST_KR'] } } });

  await getPrisma().ticker.createMany({
    data: [
      { symbol: 'SCRNTEST_US', market: 'US', exchange: 'NASDAQ', nameEn: 'Screener US Test', currency: 'USD' },
      { symbol: 'SCRNTEST_KR', market: 'KR', exchange: 'KOSPI', nameKo: '스크리너 한국 테스트', currency: 'KRW' },
    ],
  });

  // Create quote for US ticker
  await getPrisma().quoteIntraday.create({
    data: {
      symbol: 'SCRNTEST_US',
      ts: new Date('2026-05-19T15:00:00.000Z'),
      price: 150.5,
      volume: 1000000,
      changePct: 2.5,
      source: 'test',
    },
  });

  // Create financials with PER=15 for US ticker
  await getPrisma().financial.create({
    data: {
      symbol: 'SCRNTEST_US',
      period: '202412',
      periodType: 'A',
      asOf: new Date('2024-12-31'),
      source: 'test',
      data: { per: 15, pbr: 1.5, roePct: 12.3 },
    },
  });
});

afterAll(async () => {
  await getPrisma().screenerRule.deleteMany({ where: { name: TEST_RULE_NAME } });
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['SCRNTEST_US', 'SCRNTEST_KR'] } } });
  await getPrisma().financial.deleteMany({ where: { symbol: { in: ['SCRNTEST_US', 'SCRNTEST_KR'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['SCRNTEST_US', 'SCRNTEST_KR'] } } });
  await app.close();
});

beforeEach(async () => {
  await getPrisma().screenerRule.deleteMany({ where: { name: TEST_RULE_NAME } });
});

describe('Screener API', () => {
  it('POST /api/screener/run with empty conditions returns []', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/screener/run',
      payload: { conditions: [] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hits).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('POST /api/screener/run with market == US returns only US tickers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/screener/run',
      payload: { conditions: [{ field: 'market', op: '==', value: 'US' }] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThan(0);
    const symbols = body.hits.map((h: { symbol: string }) => h.symbol);
    expect(symbols).toContain('SCRNTEST_US');
    expect(symbols).not.toContain('SCRNTEST_KR');
    for (const hit of body.hits) {
      expect(hit.market).toBe('US');
    }
  });

  it('POST /api/screener/run with PER < 1000 returns tickers that have financials with matching PER', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/screener/run',
      payload: { conditions: [{ field: 'per', op: '<', value: 1000 }] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // SCRNTEST_US has per=15 which is < 1000
    const hit = body.hits.find((h: { symbol: string }) => h.symbol === 'SCRNTEST_US');
    expect(hit).toBeDefined();
    expect(hit.per).toBe(15);
    // SCRNTEST_KR has no financials — should not appear
    const krHit = body.hits.find((h: { symbol: string }) => h.symbol === 'SCRNTEST_KR');
    expect(krHit).toBeUndefined();
  });

  it('POST /api/screener/rules saves a rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/screener/rules',
      payload: { name: TEST_RULE_NAME, conditions: [{ field: 'per', op: '<', value: 20 }] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBeDefined();
  });

  it('GET /api/screener/rules lists saved rules', async () => {
    // Create one first
    await app.inject({
      method: 'POST',
      url: '/api/screener/rules',
      payload: { name: TEST_RULE_NAME, conditions: [{ field: 'pbr', op: '<', value: 2 }] },
    });

    const res = await app.inject({ method: 'GET', url: '/api/screener/rules' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.rules)).toBe(true);
    const found = body.rules.find((r: { name: string }) => r.name === TEST_RULE_NAME);
    expect(found).toBeDefined();
    expect(found.conditions).toEqual([{ field: 'pbr', op: '<', value: 2 }]);
  });

  it('DELETE /api/screener/rules/:id removes a rule', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/screener/rules',
      payload: { name: TEST_RULE_NAME, conditions: [{ field: 'per', op: '<', value: 30 }] },
    });
    const { id } = createRes.json();

    const delRes = await app.inject({ method: 'DELETE', url: `/api/screener/rules/${id}` });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().ok).toBe(true);

    // Verify it's gone
    const listRes = await app.inject({ method: 'GET', url: '/api/screener/rules' });
    const rules = listRes.json().rules;
    expect(rules.find((r: { id: string }) => r.id === id)).toBeUndefined();
  });
});
