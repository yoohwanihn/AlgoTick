import { getPrisma } from '../db.js';

export type ScreenerOp = '<' | '<=' | '>' | '>=' | '==' | '!=';
export type ScreenerField = 'per' | 'pbr' | 'roePct' | 'price' | 'changePct' | 'marketCap' | 'market';

export interface ScreenerCondition {
  field: ScreenerField;
  op: ScreenerOp;
  value: number | string;
}

export interface ScreenerHit {
  symbol: string;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  price: number | null;
  changePct: number | null;
  per: number | null;
  pbr: number | null;
  roePct: number | null;
  marketCap: number | null;
}

function evalOp(left: number | string | null, op: ScreenerOp, right: number | string): boolean {
  if (left === null || left === undefined) return false;
  if (typeof right === 'string' || typeof left === 'string') {
    const l = String(left); const r = String(right);
    if (op === '==') return l === r;
    if (op === '!=') return l !== r;
    return false;
  }
  const l = Number(left); const r = Number(right);
  if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
  switch (op) {
    case '<': return l < r;
    case '<=': return l <= r;
    case '>': return l > r;
    case '>=': return l >= r;
    case '==': return l === r;
    case '!=': return l !== r;
  }
}

export async function runScreener(conditions: ScreenerCondition[]): Promise<ScreenerHit[]> {
  if (conditions.length === 0) return [];
  const prisma = getPrisma();

  // Load all tickers + their latest financials + latest intraday quote
  const tickers = await prisma.ticker.findMany();
  const symbols = tickers.map((t) => t.symbol);

  // Latest intraday quote per symbol
  const allQuotes = await prisma.quoteIntraday.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { ts: 'desc' },
  });
  const quoteBySymbol = new Map<string, typeof allQuotes[number]>();
  for (const q of allQuotes) if (!quoteBySymbol.has(q.symbol)) quoteBySymbol.set(q.symbol, q);

  // Latest financial period per symbol
  const allFins = await prisma.financial.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { asOf: 'desc' },
  });
  const finBySymbol = new Map<string, typeof allFins[number]>();
  for (const f of allFins) if (!finBySymbol.has(f.symbol)) finBySymbol.set(f.symbol, f);

  const hits: ScreenerHit[] = [];
  for (const t of tickers) {
    const q = quoteBySymbol.get(t.symbol);
    const f = finBySymbol.get(t.symbol);
    const data = (f?.data as Record<string, number | null> | undefined) ?? {};

    const fieldValue = (field: ScreenerField): number | string | null => {
      switch (field) {
        case 'per': return data.per ?? null;
        case 'pbr': return data.pbr ?? null;
        case 'roePct': return data.roePct ?? null;
        case 'price': return q ? Number(q.price) : null;
        case 'changePct': return q ? Number(q.changePct) : null;
        case 'marketCap': return (data.marketCapMillionUsd ?? data.marketCap ?? null) as number | null;
        case 'market': return t.market;
      }
    };

    const allMatch = conditions.every((c) => evalOp(fieldValue(c.field), c.op, c.value));
    if (!allMatch) continue;

    hits.push({
      symbol: t.symbol,
      name: t.nameKo ?? t.nameEn ?? t.symbol,
      market: t.market,
      exchange: t.exchange,
      currency: t.currency,
      price: q ? Number(q.price) : null,
      changePct: q ? Number(q.changePct) : null,
      per: (data.per ?? null) as number | null,
      pbr: (data.pbr ?? null) as number | null,
      roePct: (data.roePct ?? null) as number | null,
      marketCap: (data.marketCapMillionUsd ?? data.marketCap ?? null) as number | null,
    });
  }

  return hits.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
}
