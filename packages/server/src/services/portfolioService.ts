import { getPrisma } from '../db.js';

const BASE_CURRENCY = 'USD';

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
  // base(USD) 환산
  costBasisBase: number;
  marketValueBase: number | null;
  unrealizedPnlBase: number | null;
}

export interface PortfolioSummary {
  baseCurrency: string;
  fxRates: Record<string, number>; // currency → 1 unit = X base
  totalCostBasis: number;          // base 단위
  totalMarketValue: number | null; // base 단위
  totalUnrealizedPnl: number | null;
  totalUnrealizedPnlPct: number | null;
  positions: PortfolioPosition[];
}

async function loadFxRates(prisma: ReturnType<typeof getPrisma>): Promise<Record<string, number>> {
  // KRW=X 값이 N이면 1 USD = N KRW → 1 KRW = 1/N USD
  const rates: Record<string, number> = { USD: 1 };
  const latest = await prisma.indexQuoteIntraday.findMany({
    where: { code: { in: ['KRW=X', 'JPY=X'] } },
    orderBy: { ts: 'desc' },
  });
  const byCode = new Map<string, number>();
  for (const q of latest) {
    if (!byCode.has(q.code)) byCode.set(q.code, Number(q.value));
  }
  const krw = byCode.get('KRW=X');
  const jpy = byCode.get('JPY=X');
  if (krw && krw > 0) rates.KRW = 1 / krw;
  if (jpy && jpy > 0) rates.JPY = 1 / jpy;
  return rates;
}

function toBase(amount: number, currency: string, rates: Record<string, number>): number | null {
  const r = rates[currency];
  if (r === undefined) return null; // 환율 없음
  return amount * r;
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

  const fxRates = await loadFxRates(prisma);

  const positions: PortfolioPosition[] = [];
  let totalCostBase = 0;
  let totalMvBase: number | null = 0;

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

    const costBasisBase = toBase(cost, ticker.currency, fxRates);
    const marketValueBase = marketValue !== null ? toBase(marketValue, ticker.currency, fxRates) : null;
    const unrealizedPnlBase = marketValueBase !== null && costBasisBase !== null ? marketValueBase - costBasisBase : null;

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
      costBasisBase: costBasisBase ?? cost, // 환율 없으면 native 그대로(예외상황)
      marketValueBase,
      unrealizedPnlBase,
    });

    // 환율 모르는 종목이 하나라도 있으면 totals를 null로 떨어뜨림
    if (costBasisBase === null) {
      totalCostBase = NaN;
    } else {
      totalCostBase += costBasisBase;
    }
    if (marketValueBase !== null && totalMvBase !== null) totalMvBase += marketValueBase;
    else totalMvBase = null;
  }

  const totalCostFinal = Number.isFinite(totalCostBase) ? totalCostBase : 0;
  const totalUnrealizedPnl = totalMvBase !== null ? totalMvBase - totalCostFinal : null;
  const totalUnrealizedPnlPct = totalUnrealizedPnl !== null && totalCostFinal > 0 ? (totalUnrealizedPnl / totalCostFinal) * 100 : null;

  return {
    baseCurrency: BASE_CURRENCY,
    fxRates,
    totalCostBasis: totalCostFinal,
    totalMarketValue: totalMvBase,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct,
    positions: positions.sort((a, b) => (b.marketValueBase ?? 0) - (a.marketValueBase ?? 0)),
  };
}
