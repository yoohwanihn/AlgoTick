import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:4000';

const TICKERS = [
  { symbol: 'AAPL', market: 'US', exchange: 'NASDAQ', nameEn: 'Apple Inc.', sector: 'Technology', currency: 'USD' },
  { symbol: 'AMZN', market: 'US', exchange: 'NASDAQ', nameEn: 'Amazon.com Inc.', sector: 'Consumer Cyclical', currency: 'USD' },
];

export const handlers = [
  http.get(`${BASE}/api/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    if (!q) return HttpResponse.json({ error: { code: 'BAD_REQUEST', message: 'q required' } }, { status: 400 });
    const results = TICKERS.filter((r) =>
      r.symbol.toLowerCase().includes(q.toLowerCase()) ||
      r.nameEn.toLowerCase().includes(q.toLowerCase())
    );
    return HttpResponse.json({ results });
  }),

  http.get(`${BASE}/api/ticker/:symbol`, ({ params }) => {
    const symbol = params.symbol as string;
    if (symbol === '__NOPE__') {
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: `Ticker ${symbol} not found` } }, { status: 404 });
    }
    return HttpResponse.json({
      data: {
        symbol,
        market: 'US',
        exchange: 'NASDAQ',
        name: 'Apple Inc.',
        currency: 'USD',
        quote: { price: 234.52, volume: 50_000_000, changePct: 1.24, ts: '2026-05-19T15:00:00.000Z' },
        candles: [
          { date: '2026-05-15', open: 230, high: 235, low: 229, close: 233, volume: 45_000_000 },
          { date: '2026-05-16', open: 233, high: 236, low: 232, close: 234, volume: 48_000_000 },
        ],
        indicators: {
          ma5: [null, null], ma20: [null, null], ma60: [null, null], ma120: [null, null],
          rsi14: [null, null],
          macdLine: [null, null], macdSignal: [null, null], macdHistogram: [null, null],
          bollingerMiddle: [null, null], bollingerUpper: [null, null], bollingerLower: [null, null],
        },
        signals: [],
      },
      freshness: 'fresh',
      lastFetchedAt: new Date().toISOString(),
      warnings: [],
    });
  }),
];
