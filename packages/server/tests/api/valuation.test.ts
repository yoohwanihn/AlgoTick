import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();

  // Clean up any previous test data
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['VAL_TEST'] } } });
  await getPrisma().financial.deleteMany({ where: { symbol: { in: ['VAL_TEST'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['VAL_TEST'] } } });

  await getPrisma().ticker.create({
    data: {
      symbol: 'VAL_TEST',
      market: 'US',
      exchange: 'NASDAQ',
      nameEn: 'Valuation Test Corp',
      currency: 'USD',
      sector: 'Technology',
    },
  });

  await getPrisma().quoteIntraday.create({
    data: {
      symbol: 'VAL_TEST',
      ts: new Date('2026-05-19T15:00:00.000Z'),
      price: 150.0,
      volume: 10_000_000,
      changePct: 0.5,
      source: 'test',
    },
  });

  await getPrisma().financial.create({
    data: {
      symbol: 'VAL_TEST',
      period: '202412',
      periodType: 'A',
      asOf: new Date('2024-12-31'),
      source: 'test',
      data: {
        per: 25.0,
        pbr: 3.5,
        eps: 6.0,
        bps: 42.0,
        psr: 4.0,
        beta: 1.2,
        roePct: 18.0,
        marketCapMillionUsd: 150_000,  // $150B
      },
    },
  });
});

afterAll(async () => {
  await getPrisma().quoteIntraday.deleteMany({ where: { symbol: { in: ['VAL_TEST'] } } });
  await getPrisma().financial.deleteMany({ where: { symbol: { in: ['VAL_TEST'] } } });
  await getPrisma().ticker.deleteMany({ where: { symbol: { in: ['VAL_TEST'] } } });
  await app.close();
});

describe('Valuation API', () => {
  it('POST /api/valuation/__NOPE__ returns 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/valuation/__NOPE__', payload: {} });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/valuation/VAL_TEST with defaults returns full result structure', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/valuation/VAL_TEST', payload: {} });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Top-level fields
    expect(body.symbol).toBe('VAL_TEST');
    expect(body.currency).toBe('USD');
    expect(typeof body.currentPrice).toBe('number');

    // inputs
    expect(typeof body.inputs.wacc).toBe('number');
    expect(body.inputs.rf).toBe(0.04);
    expect(body.inputs.erp).toBe(0.055);
    expect(body.inputs.beta).toBe(1.2);  // from financial data
    expect(body.inputs.terminalGrowth).toBe(0.025);
    expect(body.inputs.forecastYears).toBe(5);
    expect(typeof body.inputs.fcfBase).toBe('number');
    expect(body.inputs.fcfBase).toBeGreaterThan(0);

    // reverseDcf
    expect(body.reverseDcf).toHaveProperty('impliedGrowthHigh');
    expect(typeof body.reverseDcf.note).toBe('string');

    // forwardDcf — 3 scenarios
    expect(body.forwardDcf.scenarios).toHaveLength(3);
    const names = body.forwardDcf.scenarios.map((s: { name: string }) => s.name);
    expect(names).toContain('bull');
    expect(names).toContain('base');
    expect(names).toContain('bear');
    expect(typeof body.forwardDcf.probabilityWeightedPerShare).toBe('number');

    // comps
    expect(body.comps).toHaveProperty('peerSector');
    expect(body.comps).toHaveProperty('peersUsed');
    expect(body.comps).toHaveProperty('avgPer');

    // sensitivity 5x5
    expect(body.sensitivity.waccRange).toHaveLength(5);
    expect(body.sensitivity.growthRange).toHaveLength(5);
    expect(body.sensitivity.matrix).toHaveLength(5);
    expect(body.sensitivity.matrix[0]).toHaveLength(5);
  });

  it('POST with custom scenarios reflects growthHigh in result', async () => {
    const payload = {
      scenarios: {
        bull: { growthHigh: 0.30, prob: 0.5 },
        base: { growthHigh: 0.15, prob: 0.3 },
        bear: { growthHigh: 0.02, prob: 0.2 },
      },
    };
    const res = await app.inject({ method: 'POST', url: '/api/valuation/VAL_TEST', payload });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const bullScenario = body.forwardDcf.scenarios.find((s: { name: string }) => s.name === 'bull');
    expect(bullScenario).toBeDefined();
    expect(bullScenario.growthHigh).toBeCloseTo(0.30);
    expect(bullScenario.prob).toBeCloseTo(0.5);
    const baseScenario = body.forwardDcf.scenarios.find((s: { name: string }) => s.name === 'base');
    expect(baseScenario.growthHigh).toBeCloseTo(0.15);
  });

  it('POST with invalid scenarios returns 400', async () => {
    const payload = {
      scenarios: {
        bull: { growthHigh: 'not-a-number', prob: 0.5 },
        base: { growthHigh: 0.10, prob: 0.5 },
        // missing bear
      },
    };
    const res = await app.inject({ method: 'POST', url: '/api/valuation/VAL_TEST', payload });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});
