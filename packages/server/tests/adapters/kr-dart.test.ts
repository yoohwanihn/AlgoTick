import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config', () => ({
  loadConfig: vi.fn(() => ({
    databaseUrl: 'postgresql://test', port: 4000, nodeEnv: 'test' as const, logLevel: 'info' as const,
    secUserAgent: 'x@y', dartApiKey: 'TEST_DART_KEY', finnhubApiKey: undefined,
    pollingIntervalMs: 60000, warmUpOnStart: false,
    yahooConcurrency: 2, naverConcurrency: 3, secConcurrency: 1,
  })),
}));

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    if (url.includes('company.json') && url.includes('00126380')) {
      return { statusCode: 200, body: { json: async () => ({
        status: '000', message: '정상',
        corp_name: '삼성전자(주)', corp_name_eng: 'SAMSUNG ELECTRONICS CO,.LTD',
        stock_name: '삼성전자', stock_code: '005930',
        ceo_nm: '전영현, 노태문', est_dt: '19690113',
        induty_code: '264', phn_no: '02-2255-0114', hm_url: 'www.samsung.com/sec',
      }) } };
    }
    if (url.includes('majorstock.json') && url.includes('00126380')) {
      return { statusCode: 200, body: { json: async () => ({
        status: '000', message: '정상',
        list: [
          { rcept_no: 'M001', rcept_dt: '2024-05-24', repror: '삼성물산',
            stkqy: '1,199,285,813', stkrt: '20.10',
            bsis_pstn_stkqy: '1,199,285,813', bsis_pstn_stkrt: '20.10' },
          { rcept_no: 'M002', rcept_dt: '2024-04-10', repror: '국민연금공단',
            stkqy: '500,000,000', stkrt: '8.50',
            bsis_pstn_stkqy: '490,000,000', bsis_pstn_stkrt: '8.32' },
        ],
      }) } };
    }
    if (url.includes('elestock.json') && url.includes('00126380')) {
      return { statusCode: 200, body: { json: async () => ({
        status: '000', message: '정상',
        list: [
          { rcept_no: 'E001', rcept_dt: '2024-05-29', repror: '손준호', isu_dcrs_qy: '1000', isu_dcrs_unit_amt: '75000' },
          { rcept_no: 'E002', rcept_dt: '2024-06-04', repror: '정재욱', isu_dcrs_qy: '-2000', isu_dcrs_unit_amt: '77000' },
          { rcept_no: 'E003', rcept_dt: '2024-06-04', repror: '박학규', isu_dcrs_qy: '-', isu_dcrs_unit_amt: '0' },
        ],
      }) } };
    }
    if (url.includes('company.json') && url.includes('99999999')) {
      return { statusCode: 200, body: { json: async () => ({ status: '013', message: 'no data' }) } };
    }
    return { statusCode: 200, body: { json: async () => ({ status: '013', message: 'no data' }) } };
  }),
}));

import { dartGetProfile, dartGetInsiderTrades, dartGetInstitutionalHoldings } from '../../src/adapters/kr-dart';

describe('kr-dart', () => {
  it('dartGetProfile maps Samsung company info', async () => {
    const p = await dartGetProfile('00126380');
    expect(p).not.toBeNull();
    expect(p!.name).toMatch(/SAMSUNG/);
    expect(p!.weburl).toMatch(/samsung/);
    expect(p!.country).toBe('KR');
    expect(p!.ipo).toBeInstanceOf(Date);
  });

  it('dartGetProfile returns null for unknown corp', async () => {
    const p = await dartGetProfile('99999999');
    expect(p).toBeNull();
  });

  it('dartGetInsiderTrades parses positive (BUY) and negative (SELL) qty', async () => {
    const trades = await dartGetInsiderTrades('005930.KS', '00126380');
    expect(trades.length).toBe(2);  // 1 BUY + 1 SELL, skip "-" qty
    const buy = trades.find((t) => t.personName === '손준호');
    const sell = trades.find((t) => t.personName === '정재욱');
    expect(buy?.side).toBe('BUY');
    expect(buy?.shares).toBe(1000);
    expect(sell?.side).toBe('SELL');
    expect(sell?.shares).toBe(2000);
  });

  it('dartGetInsiderTrades skips "-" qty', async () => {
    const trades = await dartGetInsiderTrades('005930.KS', '00126380');
    expect(trades.find((t) => t.personName === '박학규')).toBeUndefined();
  });

  it('dartGetInstitutionalHoldings returns 5% holders', async () => {
    const holdings = await dartGetInstitutionalHoldings('005930.KS', '00126380');
    expect(holdings.length).toBe(2);
    const samsung = holdings.find((h) => h.holderName === '삼성물산');
    expect(samsung?.shares).toBe(1199285813);
    expect(samsung?.pctOfFloat).toBeCloseTo(20.10, 2);
  });

  it('throws when DART_API_KEY missing', async () => {
    const { loadConfig } = await import('../../src/config');
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      databaseUrl: 'x', port: 4000, nodeEnv: 'test' as const, logLevel: 'info' as const,
      secUserAgent: 'x@y', dartApiKey: undefined,
      pollingIntervalMs: 60000, warmUpOnStart: false,
      yahooConcurrency: 2, naverConcurrency: 3, secConcurrency: 1,
    });
    await expect(dartGetProfile('00126380')).rejects.toMatchObject({ name: 'AdapterError' });
  });
});
