import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/index';
import { getPrisma } from '../../src/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await getPrisma().portfolioLot.deleteMany({ where: { symbol: 'PFTEST' } });
  await getPrisma().ticker.deleteMany({ where: { symbol: 'PFTEST' } });
  await getPrisma().ticker.create({
    data: { symbol: 'PFTEST', market: 'US', exchange: 'NASDAQ', nameEn: 'Portfolio Test', currency: 'USD' },
  });
});
afterAll(async () => {
  await getPrisma().portfolioLot.deleteMany({ where: { symbol: 'PFTEST' } });
  await getPrisma().ticker.deleteMany({ where: { symbol: 'PFTEST' } });
  await app.close();
});
beforeEach(async () => {
  await getPrisma().portfolioLot.deleteMany({ where: { symbol: 'PFTEST' } });
});

describe('Portfolio API', () => {
  it('POST /api/portfolio/lots adds a BUY lot', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/portfolio/lots',
      payload: { symbol: 'PFTEST', side: 'BUY', qty: 10, price: 100 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('POST rejects invalid body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/portfolio/lots',
      payload: { symbol: 'PFTEST', side: 'BUY', qty: -1, price: 100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/portfolio computes weighted avg cost', async () => {
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 10, price: 100 } });
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 10, price: 200 } });
    const res = await app.inject({ method: 'GET', url: '/api/portfolio' });
    const body = res.json();
    const pos = body.positions.find((p: { symbol: string }) => p.symbol === 'PFTEST');
    expect(pos.qty).toBeCloseTo(20, 5);
    expect(pos.avgCost).toBeCloseTo(150, 5);  // (1000+2000)/20
    expect(pos.costBasis).toBeCloseTo(3000, 5);
  });

  it('GET portfolio handles SELL: 가중평균 단가로 차감', async () => {
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 10, price: 100 } });
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'SELL', qty: 5, price: 150 } });
    const res = await app.inject({ method: 'GET', url: '/api/portfolio' });
    const pos = res.json().positions.find((p: { symbol: string }) => p.symbol === 'PFTEST');
    expect(pos.qty).toBeCloseTo(5, 5);
    expect(pos.avgCost).toBeCloseTo(100, 5);  // 평단 유지
    expect(pos.costBasis).toBeCloseTo(500, 5);
  });

  it('GET portfolio excludes fully-sold positions', async () => {
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 10, price: 100 } });
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'SELL', qty: 10, price: 150 } });
    const res = await app.inject({ method: 'GET', url: '/api/portfolio' });
    const pos = res.json().positions.find((p: { symbol: string }) => p.symbol === 'PFTEST');
    expect(pos).toBeUndefined();
  });

  it('GET /api/portfolio/lots returns all lots', async () => {
    await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 5, price: 100 } });
    const res = await app.inject({ method: 'GET', url: '/api/portfolio/lots' });
    const lots = res.json().lots;
    expect(lots.some((l: { symbol: string }) => l.symbol === 'PFTEST')).toBe(true);
  });

  it('DELETE removes a lot', async () => {
    const add = await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 1, price: 1 } });
    const id = add.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/api/portfolio/lots/${id}` });
    expect(del.statusCode).toBe(200);
  });

  it('multi-currency: USD와 KRW lot이 base(USD)로 합산되어야 함', async () => {
    const prisma = getPrisma();
    // 환율 seed
    await prisma.marketIndex.upsert({
      where: { code: 'KRW=X' },
      update: {},
      create: { code: 'KRW=X', name: 'USD/KRW', market: 'GLOBAL', kind: 'fx', position: 99 },
    });
    await prisma.indexQuoteIntraday.create({
      data: { code: 'KRW=X', ts: new Date(), value: 1500, changePct: 0, source: 'test' },
    });
    // KRW 종목 seed
    await prisma.portfolioLot.deleteMany({ where: { symbol: 'KRTEST.KS' } });
    await prisma.ticker.deleteMany({ where: { symbol: 'KRTEST.KS' } });
    await prisma.ticker.create({
      data: { symbol: 'KRTEST.KS', market: 'KR', exchange: 'KOSPI', nameKo: '환산테스트', currency: 'KRW' },
    });
    try {
      await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'PFTEST', side: 'BUY', qty: 10, price: 100 } });   // $1000
      await app.inject({ method: 'POST', url: '/api/portfolio/lots', payload: { symbol: 'KRTEST.KS', side: 'BUY', qty: 100, price: 15000 } }); // ₩1.5M = $1000
      const res = await app.inject({ method: 'GET', url: '/api/portfolio' });
      const body = res.json();
      expect(body.baseCurrency).toBe('USD');
      expect(body.fxRates).toHaveProperty('KRW');
      const usPos = body.positions.find((p: { symbol: string }) => p.symbol === 'PFTEST');
      const krPos = body.positions.find((p: { symbol: string }) => p.symbol === 'KRTEST.KS');
      expect(usPos.costBasis).toBeCloseTo(1000, 1);
      expect(usPos.costBasisBase).toBeCloseTo(1000, 1); // USD는 1:1
      expect(krPos.costBasis).toBeCloseTo(1500000, 1); // native(KRW)
      expect(krPos.costBasisBase).toBeCloseTo(1000, 1); // ₩1.5M / 1500 = $1000
    } finally {
      await prisma.portfolioLot.deleteMany({ where: { symbol: 'KRTEST.KS' } });
      await prisma.ticker.deleteMany({ where: { symbol: 'KRTEST.KS' } });
    }
  });
});
