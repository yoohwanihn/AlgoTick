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

  http.get(`${BASE}/api/watchlist`, () => HttpResponse.json({ items: [] })),
  http.get(`${BASE}/api/watchlist/has/:symbol`, () => HttpResponse.json({ exists: false })),
  http.post(`${BASE}/api/watchlist`, () => HttpResponse.json({ ok: true, item: { symbol: 'MOCK', position: 1, addedAt: new Date().toISOString() } })),
  http.delete(`${BASE}/api/watchlist/:symbol`, () => HttpResponse.json({ ok: true })),

  http.get(`${BASE}/api/portfolio`, () => HttpResponse.json({ totalCostBasis: 0, totalMarketValue: 0, totalUnrealizedPnl: 0, totalUnrealizedPnlPct: 0, positions: [] })),
  http.get(`${BASE}/api/portfolio/lots`, () => HttpResponse.json({ lots: [] })),
  http.post(`${BASE}/api/portfolio/lots`, () => HttpResponse.json({ ok: true, id: 'mock-lot-id' })),
  http.delete(`${BASE}/api/portfolio/lots/:id`, () => HttpResponse.json({ ok: true })),

  http.post(`${BASE}/api/screener/run`, () => HttpResponse.json({ hits: [], total: 0 })),
  http.get(`${BASE}/api/screener/rules`, () => HttpResponse.json({ rules: [] })),
  http.post(`${BASE}/api/screener/rules`, () => HttpResponse.json({ ok: true, id: 'mock-rule' })),
  http.delete(`${BASE}/api/screener/rules/:id`, () => HttpResponse.json({ ok: true })),

  http.get(`${BASE}/api/compare`, () => HttpResponse.json({ items: [], missingSymbols: [] })),

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
        financials: [],
        news: [],
        insiderTrades: [],
        profile: { name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', country: 'US' },
      },
      freshness: 'fresh',
      lastFetchedAt: new Date().toISOString(),
      warnings: [],
    });
  }),
];
