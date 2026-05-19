import { getPrisma } from '../db.js';

export interface PortfolioPosition {
  symbol: string;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  qty: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  costBasis: number;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  lotsCount: number;
}

export interface PortfolioSummary {
  totalCostBasis: number;
  totalMarketValue: number | null;
  totalUnrealizedPnl: number | null;
  totalUnrealizedPnlPct: number | null;
  positions: PortfolioPosition[];
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  const prisma = getPrisma();
  const lots = await prisma.portfolioLot.findMany({
    include: { ticker: true },
    orderBy: { tradedAt: 'asc' },
  });

  // Group by symbol, FIFO weighted-average cost
  const bySymbol = new Map<string, typeof lots>();
  for (const l of lots) {
    if (!bySymbol.has(l.symbol)) bySymbol.set(l.symbol, []);
    bySymbol.get(l.symbol)!.push(l);
  }

  // 최신 시세 일괄 조회
  const symbols = Array.from(bySymbol.keys());
  const latestQuotes = symbols.length > 0 ? await prisma.quoteIntraday.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { ts: 'desc' },
  }) : [];
  const priceBySymbol = new Map<string, number>();
  for (const q of latestQuotes) {
    if (!priceBySymbol.has(q.symbol)) priceBySymbol.set(q.symbol, Number(q.price));
  }

  const positions: PortfolioPosition[] = [];
  let totalCost = 0;
  let totalMv: number | null = 0;

  for (const [symbol, symLots] of bySymbol.entries()) {
    let qty = 0;
    let cost = 0;
    for (const l of symLots) {
      const lotQty = Number(l.qty);
      const lotPrice = Number(l.price);
      if (l.side === 'BUY') {
        qty += lotQty;
        cost += lotQty * lotPrice;
      } else { // SELL
        // 가중평균 단가로 차감
        if (qty > 0) {
          const avgCost = cost / qty;
          const reduceQty = Math.min(lotQty, qty);
          cost -= reduceQty * avgCost;
          qty -= reduceQty;
        }
      }
    }
    if (qty <= 0) continue; // 전부 매도된 종목은 제외

    const first = symLots[0]!;
    const ticker = first.ticker;
    const avgCost = qty > 0 ? cost / qty : 0;
    const currentPrice = priceBySymbol.get(symbol) ?? null;
    const marketValue = currentPrice !== null ? currentPrice * qty : null;
    const unrealizedPnl = marketValue !== null ? marketValue - cost : null;
    const unrealizedPnlPct = unrealizedPnl !== null && cost > 0 ? (unrealizedPnl / cost) * 100 : null;

    positions.push({
      symbol,
      name: ticker.nameEn ?? ticker.nameKo ?? symbol,
      market: ticker.market,
      exchange: ticker.exchange,
      currency: ticker.currency,
      qty,
      avgCost,
      currentPrice,
      marketValue,
      costBasis: cost,
      unrealizedPnl,
      unrealizedPnlPct,
      lotsCount: symLots.length,
    });

    totalCost += cost;
    if (marketValue !== null && totalMv !== null) totalMv += marketValue;
    else totalMv = null;
  }

  const totalUnrealizedPnl = totalMv !== null ? totalMv - totalCost : null;
  const totalUnrealizedPnlPct = totalUnrealizedPnl !== null && totalCost > 0 ? (totalUnrealizedPnl / totalCost) * 100 : null;

  return {
    totalCostBasis: totalCost,
    totalMarketValue: totalMv,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct,
    positions: positions.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)),
  };
}
