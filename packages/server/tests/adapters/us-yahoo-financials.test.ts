import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock loadConfig to provide finnhubApiKey
vi.mock('../../src/config', () => ({
  loadConfig: vi.fn(() => ({
    databaseUrl: 'postgresql://test',
    port: 4000,
    nodeEnv: 'test' as const,
    logLevel: 'info' as const,
    secUserAgent: 'AlgoTick test@test',
    finnhubApiKey: 'TEST_FINNHUB_KEY',
    pollingIntervalMs: 60000,
    warmUpOnStart: false,
    yahooConcurrency: 2,
    naverConcurrency: 3,
    secConcurrency: 1,
  })),
}));

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    if (url.includes('finnhub.io/api/v1/stock/metric') && url.includes('symbol=AAPL')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          metric: {
            peTTM: 35.4953,
            peNormalizedAnnual: 38.8433,
            pbAnnual: 50.978,
            psTTM: 8.95,
            roeTTM: 146.69,
            roeRfy: 151.91,
            epsTTM: 8.2666,
            epsAnnual: 7.465,
            currentDividendYieldTTM: 0.3574,
            revenueGrowthTTMYoy: 12.76,
            marketCapitalization: 4350836,
            '52WeekHigh': 303.2,
            '52WeekLow': 193.46,
            beta: 1.0724,
            currentRatioAnnual: 0.92,
            'totalDebt/totalEquityAnnual': 1.45,
          },
        }) },
      };
    }
    if (url.includes('finnhub.io/api/v1/stock/metric') && url.includes('symbol=ERR')) {
      return { statusCode: 500, body: { json: async () => ({}), text: async () => 'oops' } };
    }
    if (url.includes('finnhub.io/api/v1/company-news') && url.includes('symbol=AAPL')) {
      return {
        statusCode: 200,
        body: { json: async () => [
          { id: 1, datetime: 1779196622, headline: 'Apple news headline', source: 'Yahoo', url: 'https://example.com/1', summary: 'short summary' },
          { id: 2, datetime: 1779100000, headline: 'Another Apple item', source: 'CNBC', url: 'https://example.com/2', summary: '' },
        ] },
      };
    }
    if (url.includes('finnhub.io/api/v1/company-news') && url.includes('symbol=ERRX')) {
      return { statusCode: 500, body: { json: async () => [], text: async () => 'oops' } };
    }
    return { statusCode: 404, body: { json: async () => ({}), text: async () => '' } };
  }),
}));

import { UsYahooAdapter } from '../../src/adapters/us-yahoo';

describe('UsYahooAdapter.getFinancials (Finnhub)', () => {
  let adapter: UsYahooAdapter;
  beforeEach(() => { adapter = new UsYahooAdapter(); });

  it('returns one TTM period with mapped metrics for AAPL', async () => {
    const fins = await adapter.getFinancials('AAPL');
    expect(fins).toHaveLength(1);
    const f = fins[0]!;
    expect(f.periodType).toBe('A');
    expect(f.source).toBe('finnhub');
    expect(f.data.per).toBeCloseTo(35.4953, 2);
    expect(f.data.pbr).toBeCloseTo(50.978, 2);
    expect(f.data.psr).toBeCloseTo(8.95, 2);
    expect(f.data.roePct).toBeCloseTo(146.69, 2);
    expect(f.data.eps).toBeCloseTo(8.2666, 2);
    expect(f.data.marketCapMillionUsd).toBe(4350836);
    expect(f.data.week52High).toBe(303.2);
    expect(f.data.beta).toBeCloseTo(1.0724, 3);
  });

  it('returns empty array when Finnhub fails', async () => {
    const fins = await adapter.getFinancials('ERR');
    expect(fins).toEqual([]);
  });

  it('returns empty when FINNHUB_API_KEY is not set', async () => {
    // Override the loadConfig mock to return empty key
    const { loadConfig } = await import('../../src/config');
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      databaseUrl: 'postgresql://test',
      port: 4000, nodeEnv: 'test' as const, logLevel: 'info' as const,
      secUserAgent: 'x@y', finnhubApiKey: undefined,
      pollingIntervalMs: 60000, warmUpOnStart: false,
      yahooConcurrency: 2, naverConcurrency: 3, secConcurrency: 1,
    });
    const fins = await adapter.getFinancials('AAPL');
    expect(fins).toEqual([]);
  });
});

describe('UsYahooAdapter.getNews (Finnhub)', () => {
  let adapter: UsYahooAdapter;
  beforeEach(() => { adapter = new UsYahooAdapter(); });

  it('returns mapped news items', async () => {
    const news = await adapter.getNews('AAPL', 10);
    expect(news.length).toBeGreaterThan(0);
    expect(news[0]?.title).toBe('Apple news headline');
    expect(news[0]?.url).toBe('https://example.com/1');
    expect(news[0]?.externalId).toContain('finnhub-1');
    expect(news[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it('returns empty on error', async () => {
    const news = await adapter.getNews('ERRX');
    expect(news).toEqual([]);
  });
});
