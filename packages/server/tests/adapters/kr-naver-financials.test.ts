import { describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    if (url.includes('m.stock.naver.com/api/stock/005930/finance/annual')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          itemCode: '005930',
          financePeriodType: 'annual',
          financeInfo: {
            trTitleList: [
              { isConsensus: 'N', title: '2023.12.', key: '202312' },
              { isConsensus: 'N', title: '2024.12.', key: '202412' },
              { isConsensus: 'Y', title: '2025.12.', key: '202512' },  // 제외 대상
            ],
            rowList: [
              { title: '매출액', columns: { '202312': { value: '2,589,355' }, '202412': { value: '3,008,709' } } },
              { title: '영업이익', columns: { '202312': { value: '65,670' }, '202412': { value: '327,260' } } },
              { title: 'ROE', columns: { '202312': { value: '4.15' }, '202412': { value: '9.03' } } },
              { title: 'PER', columns: { '202312': { value: '41.97' }, '202412': { value: '-' } } },
            ],
          },
        }) },
      };
    }
    if (url.includes('m.stock.naver.com/api/stock/EMPTY/finance/annual')) {
      return { statusCode: 200, body: { json: async () => ({ itemCode: 'EMPTY' }) } };
    }
    return { statusCode: 404, body: { json: async () => ({}), text: async () => '' } };
  }),
}));

import { KrNaverAdapter } from '../../src/adapters/kr-naver';

describe('KrNaverAdapter.getFinancials', () => {
  const adapter = new KrNaverAdapter();

  it('returns annual periods with mapped fields', async () => {
    const fins = await adapter.getFinancials('005930.KS');
    expect(fins).toHaveLength(2);  // 컨센서스 제외
    const y2023 = fins.find((f) => f.period === '202312');
    expect(y2023).toBeDefined();
    expect(y2023!.data.revenue).toBe(2589355);
    expect(y2023!.data.opIncome).toBe(65670);
    expect(y2023!.data.roePct).toBeCloseTo(4.15, 2);
    expect(y2023!.data.per).toBeCloseTo(41.97, 2);
  });

  it('handles "-" as null', async () => {
    const fins = await adapter.getFinancials('005930.KS');
    const y2024 = fins.find((f) => f.period === '202412');
    expect(y2024!.data.per).toBeNull();
  });

  it('excludes consensus periods', async () => {
    const fins = await adapter.getFinancials('005930.KS');
    expect(fins.find((f) => f.period === '202512')).toBeUndefined();
  });

  it('returns empty array for empty response', async () => {
    const fins = await adapter.getFinancials('EMPTY.KS');
    expect(fins).toEqual([]);
  });
});
