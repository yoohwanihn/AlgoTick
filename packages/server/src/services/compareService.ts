import { getPrisma } from '../db.js';

export interface ComparePosition {
  symbol: string;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  quote: { price: number; changePct: number; volume: number; ts: string } | null;
  financial: Record<string, number | null> | null;
  financialPeriod: string | null;
  financialSource: string | null;
  candles: Array<{ date: string; close: number }>;
  insiderCount: number;
  newsCount: number;
}

export interface CompareResponse {
  items: ComparePosition[];
  missingSymbols: string[];
}

export async function compareTickers(symbols: string[]): Promise<CompareResponse> {
  const prisma = getPrisma();
  const valid = symbols.slice(0, 3).map((s) => s.trim()).filter(Boolean);
  if (valid.length === 0) return { items: [], missingSymbols: [] };

  const tickers = await prisma.ticker.findMany({ where: { symbol: { in: valid } } });
  const foundSymbols = new Set(tickers.map((t) => t.symbol));
  const missingSymbols = valid.filter((s) => !foundSymbols.has(s));

  // Latest intraday quote per symbol
  const allQuotes = await prisma.quoteIntraday.findMany({
    where: { symbol: { in: valid } },
    orderBy: { ts: 'desc' },
  });
  const quoteBySymbol = new Map<string, typeof allQuotes[number]>();
  for (const q of allQuotes) if (!quoteBySymbol.has(q.symbol)) quoteBySymbol.set(q.symbol, q);

  // Latest financial per symbol
  const allFins = await prisma.financial.findMany({
    where: { symbol: { in: valid } },
    orderBy: { asOf: 'desc' },
  });
  const finBySymbol = new Map<string, typeof allFins[number]>();
  for (const f of allFins) if (!finBySymbol.has(f.symbol)) finBySymbol.set(f.symbol, f);

  // Last 180 daily closes per symbol (for chart overlay)
  const dailyRows = await prisma.quoteDaily.findMany({
    where: { symbol: { in: valid } },
    orderBy: { date: 'desc' },
  });
  const candlesBySymbol = new Map<string, Array<{ date: string; close: number }>>();
  for (const r of dailyRows) {
    if (!candlesBySymbol.has(r.symbol)) candlesBySymbol.set(r.symbol, []);
    const arr = candlesBySymbol.get(r.symbol)!;
    if (arr.length < 180) arr.push({ date: r.date.toISOString().slice(0, 10), close: Number(r.close) });
  }

  const insiderCounts = await prisma.insiderTrade.groupBy({
    by: ['symbol'],
    where: { symbol: { in: valid } },
    _count: { _all: true },
  });
  const insiderCountBySymbol = new Map(insiderCounts.map((r) => [r.symbol, r._count._all]));

  const newsCounts = await prisma.news.groupBy({
    by: ['symbol'],
    where: { symbol: { in: valid }, scope: 'ticker' },
    _count: { _all: true },
  });
  const newsCountBySymbol = new Map(
    newsCounts.filter((r) => r.symbol !== null).map((r) => [r.symbol as string, r._count._all]),
  );

  const positions: ComparePosition[] = [];
  for (const sym of valid) {
    const t = tickers.find((x) => x.symbol === sym);
    if (!t) continue;
    const q = quoteBySymbol.get(sym);
    const f = finBySymbol.get(sym);
    const ascCandles = (candlesBySymbol.get(sym) ?? []).slice().reverse();
    positions.push({
      symbol: sym,
      name: t.nameKo ?? t.nameEn ?? sym,
      market: t.market as string,
      exchange: t.exchange as string,
      currency: t.currency,
      quote: q ? { price: Number(q.price), changePct: Number(q.changePct), volume: Number(q.volume), ts: q.ts.toISOString() } : null,
      financial: f ? (f.data as Record<string, number | null>) : null,
      financialPeriod: f?.period ?? null,
      financialSource: f?.source ?? null,
      candles: ascCandles,
      insiderCount: insiderCountBySymbol.get(sym) ?? 0,
      newsCount: newsCountBySymbol.get(sym) ?? 0,
    });
  }
  const items = positions;

  return { items, missingSymbols };
}
