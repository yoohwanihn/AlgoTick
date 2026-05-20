import { describe, expect, it, vi } from 'vitest';

// 외부 네트워크 호출을 피하기 위해 refreshTicker는 mock
vi.mock('../../src/services/tickerService.js', () => ({
  refreshTicker: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/adapters/router.js', () => ({
  getAdapter: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/db.js', () => ({
  getPrisma: () => ({
    ticker: {
      findMany: vi.fn().mockResolvedValue([
        { symbol: 'AAA', market: 'US' },
        { symbol: 'BBB', market: 'US' },
        { symbol: 'CCC.KS', market: 'KR' },
      ]),
    },
  }),
}));

describe('warmUpSeed', () => {
  it('전체 시드 종목을 refreshTicker로 페치하고 카운트 반환', async () => {
    const { warmUpSeed } = await import('../../src/worker/jobs/warmUpSeed');
    const { refreshTicker } = await import('../../src/services/tickerService');
    const result = await warmUpSeed();
    expect(result.symbols).toBe(3);
    expect(result.updated).toBe(3);
    expect(result.errors).toBe(0);
    expect(refreshTicker).toHaveBeenCalledTimes(3);
  });
});
