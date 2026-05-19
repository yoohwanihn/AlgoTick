import { describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  request: vi.fn(async (url: string) => {
    if (url.includes('m.stock.naver.com/api/stock/005930/integration')) {
      return {
        statusCode: 200,
        body: { json: async () => ({
          stockName: '삼성전자',
          totalInfos: [
            { code: 'lastClosePrice', value: '281,000' },
            { code: 'openPrice', value: '275,500' },
            { code: 'highPrice', value: '281,500' },
            { code: 'lowPrice', value: '266,000' },
            { code: 'marketValue', value: '1,610조 6,498억' },
            { code: 'per', value: '41.97배' },
            { code: 'pbr', value: '4.30배' },
          ],
          dealTrendInfos: [
            {
              itemCode: '005930',
              bizdate: '20260519',
              closePrice: '275,500',
              compareToPreviousClosePrice: '-5,500',
              accumulatedTradingVolume: '30,186,229',
            },
          ],
        }) },
      };
    }
    if (url.includes('m.stock.naver.com/api/stock/UNKNOWN/integration')) {
      return { statusCode: 200, body: { json: async () => ({ stockName: 'unknown', dealTrendInfos: [] }) } };
    }
    if (url.includes('m.stock.naver.com/api/news/stock/005930')) {
      return {
        statusCode: 200,
        body: { json: async () => [{
          total: 2,
          items: [
            { id: 'x1', officeId: '003', articleId: '0013955280', officeName: '뉴시스', datetime: '202605200003', title: '삼성전자 노사 협상', body: '본문' },
            { id: 'x2', officeId: '009', articleId: '0005000001', officeName: '매일경제', datetime: '202605191230', title: '반도체 시황', body: '본문2' },
          ],
        }] },
      };
    }
    if (url.includes('m.stock.naver.com/api/news/stock/EMPTY')) {
      return { statusCode: 200, body: { json: async () => [{ total: 0, items: [] }] } };
    }
    if (url.includes('siseJson.naver')) {
      const text = "[['날짜', '시가', '고가', '저가', '종가', '거래량', '외국인소진율'],\n" +
        '["20240502", 77600, 78600, 77300, 78000, 18900640, 55.88],\n' +
        '["20240503", 79000, 79000, 77500, 77600, 13151889, 55.88]\n' +
        ']';
      return { statusCode: 200, body: { text: async () => text } };
    }
    return { statusCode: 404, body: { json: async () => ({}), text: async () => '' } };
  }),
}));

import { KrNaverAdapter, parseKrNumber, parseKrPercent, parseKrMarketValue, stripKrSuffix } from '../../src/adapters/kr-naver';

describe('KR helpers', () => {
  it('stripKrSuffix removes .KS / .KQ', () => {
    expect(stripKrSuffix('005930.KS')).toBe('005930');
    expect(stripKrSuffix('091990.KQ')).toBe('091990');
    expect(stripKrSuffix('AAPL')).toBe('AAPL');
  });

  it('parseKrNumber handles commas and signs', () => {
    expect(parseKrNumber('281,000')).toBe(281000);
    expect(parseKrNumber('-5,500')).toBe(-5500);
    expect(parseKrNumber('+1,418,906')).toBe(1418906);
    expect(parseKrNumber(null)).toBe(0);
  });

  it('parseKrPercent', () => {
    expect(parseKrPercent('48.61%')).toBeCloseTo(48.61, 2);
  });

  it('parseKrMarketValue converts 조/억', () => {
    expect(parseKrMarketValue('1,610조 6,498억')).toBe(1610 * 1e12 + 6498 * 1e8);
    expect(parseKrMarketValue('500억')).toBe(500 * 1e8);
    expect(parseKrMarketValue('2조')).toBe(2 * 1e12);
  });
});

describe('KrNaverAdapter', () => {
  const adapter = new KrNaverAdapter();

  it('returns quote for 005930.KS', async () => {
    const q = await adapter.getQuote('005930.KS');
    expect(q.symbol).toBe('005930.KS');
    expect(q.price).toBe(275500);
    expect(q.source).toBe('naver');
    expect(q.volume).toBe(30186229);
    expect(q.changePct).toBeCloseTo((-5500 / (275500 - -5500)) * 100, 3);
    expect(q.marketCap).toBeGreaterThan(1e15);
  });

  it('throws AdapterError for unknown symbol', async () => {
    await expect(adapter.getQuote('UNKNOWN.KS')).rejects.toMatchObject({ name: 'AdapterError' });
  });

  it('returns daily candles', async () => {
    const candles = await adapter.getDailyOHLCV('005930.KS', new Date('2024-05-02'), new Date('2024-05-03'));
    expect(candles).toHaveLength(2);
    expect(candles[0]?.date).toBe('2024-05-02');
    expect(candles[0]?.close).toBe(78000);
    expect(candles[0]?.volume).toBe(18900640);
  });

  it('search returns empty (DB seed handles KR search)', async () => {
    const results = await adapter.search('삼성');
    expect(results).toEqual([]);
  });
});

describe('KrNaverAdapter.getNews', () => {
  const adapter = new KrNaverAdapter();
  it('returns mapped news items with naver article URL', async () => {
    const news = await adapter.getNews('005930.KS', 10);
    expect(news.length).toBe(2);
    expect(news[0]?.title).toBe('삼성전자 노사 협상');
    expect(news[0]?.url).toBe('https://n.news.naver.com/article/003/0013955280');
    expect(news[0]?.externalId).toBe('naver-003-0013955280');
    expect(news[0]?.source).toBe('뉴시스');
  });
  it('returns empty for empty response', async () => {
    const news = await adapter.getNews('EMPTY.KS');
    expect(news).toEqual([]);
  });
});

describe('KrNaverAdapter.getInsiderTrades (stub)', () => {
  it('returns empty (DART integration deferred to Stage 5e)', async () => {
    const adapter = new KrNaverAdapter();
    const r = await adapter.getInsiderTrades('005930.KS');
    expect(r).toEqual([]);
  });
});

describe('KrNaverAdapter.getProfile (stub)', () => {
  it('returns null (KR uses seed sector/industry)', async () => {
    const adapter = new KrNaverAdapter();
    const r = await adapter.getProfile('005930.KS');
    expect(r).toBeNull();
  });
});
