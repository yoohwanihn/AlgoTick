import { describe, expect, it, beforeEach } from 'vitest';
import { getPrisma } from '../../src/db';
import { searchTickers } from '../../src/services/searchService';

describe('searchTickers', () => {
  beforeEach(async () => {
    await getPrisma().ticker.deleteMany({ where: { symbol: { startsWith: 'TST' } } });
    await getPrisma().ticker.createMany({
      data: [
        { symbol: 'TST1', market: 'US', exchange: 'NASDAQ', nameEn: 'Test One Inc', currency: 'USD' },
        { symbol: 'TST2', market: 'US', exchange: 'NASDAQ', nameEn: 'Other Company', currency: 'USD' },
        { symbol: 'TST3.KS', market: 'KR', exchange: 'KOSPI', nameKo: '테스트삼', currency: 'KRW' },
      ],
    });
  });

  it('matches by symbol prefix', async () => {
    const r = await searchTickers('TST1');
    expect(r.find(x => x.symbol === 'TST1')).toBeDefined();
  });

  it('matches by name substring (English)', async () => {
    const r = await searchTickers('Test One');
    expect(r.find(x => x.symbol === 'TST1')).toBeDefined();
  });

  it('matches by Korean name', async () => {
    const r = await searchTickers('테스트삼');
    expect(r.find(x => x.symbol === 'TST3.KS')).toBeDefined();
  });

  it('respects limit', async () => {
    const r = await searchTickers('TST', 2);
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
