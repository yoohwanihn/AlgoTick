import { getPrisma } from '../db.js';

export class ValuationUnavailableError extends Error {
  constructor(public reason: string, message: string) {
    super(message);
    this.name = 'ValuationUnavailableError';
  }
}

export interface ValuationInputs {
  // Optional overrides — server fills defaults from financials
  rf?: number;                  // default 0.04 (US treasury 10Y proxy)
  erp?: number;                 // default 0.055
  beta?: number;                // from financials (Finnhub) or 1.0
  taxRate?: number;             // default 0.20
  terminalGrowth?: number;      // default 0.025
  scenarios?: {
    bull: { growthHigh: number; prob: number };
    base: { growthHigh: number; prob: number };
    bear: { growthHigh: number; prob: number };
  };
  forecastYears?: number;       // default 5
  fcfBaseOverride?: number;     // 없으면 계산: revenue × operatingMargin × (1-tax) × 0.7 (rough)
}

export interface ValuationResult {
  symbol: string;
  currency: string;
  currentPrice: number | null;
  sharesOutstanding: number | null;
  inputs: {
    wacc: number;
    rf: number; erp: number; beta: number; taxRate: number;
    terminalGrowth: number; forecastYears: number;
    fcfBase: number;
    fcfBaseOriginEstimate: string;  // "user_override" | "estimated_from_revenue"
  };
  reverseDcf: {
    impliedGrowthHigh: number | null;  // 시장이 기대하는 high-growth phase 성장률 (Stage 1)
    note: string;
  };
  forwardDcf: {
    scenarios: Array<{
      name: 'bull' | 'base' | 'bear';
      growthHigh: number;
      prob: number;
      enterpriseValue: number;
      equityValue: number;
      perShare: number;
      upside: number | null;   // (perShare - currentPrice) / currentPrice * 100
    }>;
    probabilityWeightedPerShare: number;
    upsideToWeighted: number | null;
  };
  comps: {
    peerSector: string | null;
    peersUsed: number;
    avgPer: number | null;
    avgPbr: number | null;
    avgPsr: number | null;
    impliedPriceByPer: number | null;
    impliedPriceByPbr: number | null;
  };
  sensitivity: {
    // 5×5 matrix: rows = WACC offsets (-2pp..+2pp step 1pp), cols = growth offsets
    waccRange: number[];        // [wacc-0.02, wacc-0.01, wacc, wacc+0.01, wacc+0.02]
    growthRange: number[];      // base growth ± steps
    matrix: number[][];         // perShare prices
  };
}

const DEFAULT_INPUTS: Required<Omit<ValuationInputs, 'fcfBaseOverride' | 'scenarios'>> = {
  rf: 0.04, erp: 0.055, beta: 1.0, taxRate: 0.20,
  terminalGrowth: 0.025, forecastYears: 5,
};

const DEFAULT_SCENARIOS = {
  bull: { growthHigh: 0.20, prob: 0.25 },
  base: { growthHigh: 0.10, prob: 0.50 },
  bear: { growthHigh: 0.03, prob: 0.25 },
};

function computeWacc(rf: number, beta: number, erp: number): number {
  // 단순화 — 자기자본 100% 가정 (small/medium 기업 회사채 데이터 없음)
  return rf + beta * erp;
}

/** Forward DCF: 2-stage (5년 high-growth + terminal) */
function forwardValuation(fcfBase: number, growthHigh: number, growthTerminal: number, wacc: number, years: number, sharesOut: number): { ev: number; perShare: number } {
  let pv = 0;
  let fcf = fcfBase;
  for (let n = 1; n <= years; n++) {
    fcf = fcf * (1 + growthHigh);
    pv += fcf / Math.pow(1 + wacc, n);
  }
  // Terminal value at year N using Gordon growth
  const terminalFcf = fcf * (1 + growthTerminal);
  const terminalValue = terminalFcf / (wacc - growthTerminal);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, years);
  const ev = pv + pvTerminal;
  return { ev, perShare: sharesOut > 0 ? ev / sharesOut : 0 };
}

/** Reverse DCF: 이진 탐색으로 marketCap을 맞추는 growthHigh 찾기 */
function reverseDcfGrowth(fcfBase: number, marketCap: number, growthTerminal: number, wacc: number, years: number): number | null {
  if (fcfBase <= 0 || marketCap <= 0 || wacc <= growthTerminal) return null;
  // growth bound: -0.1 to +0.50
  let lo = -0.1, hi = 0.50;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { ev } = forwardValuation(fcfBase, mid, growthTerminal, wacc, years, 1);
    if (ev > marketCap) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export async function calculateValuation(symbol: string, inputs: ValuationInputs = {}): Promise<ValuationResult> {
  const prisma = getPrisma();
  const master = await prisma.ticker.findUnique({ where: { symbol } });
  if (!master) throw new Error(`Ticker not found: ${symbol}`);

  const latestQuote = await prisma.quoteIntraday.findFirst({ where: { symbol }, orderBy: { ts: 'desc' } });
  const latestFin = await prisma.financial.findFirst({ where: { symbol }, orderBy: { asOf: 'desc' } });

  const currentPrice = latestQuote ? Number(latestQuote.price) : null;
  const finData = (latestFin?.data ?? {}) as Record<string, number | null>;
  // marketCap 단위: US는 marketCapMillionUsd(USD백만), KR/JP는 marketCap(native currency).
  // sharesOut = marketCap(native) / currentPrice(native).
  let marketCap: number | null = null;
  if (master.currency === 'USD') {
    const marketCapM = finData.marketCapMillionUsd as number | null;
    if (marketCapM && marketCapM > 0) marketCap = marketCapM * 1_000_000;
  } else {
    const mcNative = finData.marketCap as number | null;
    if (mcNative && mcNative > 0) marketCap = mcNative;
  }
  const sharesOutstanding = marketCap && currentPrice ? marketCap / currentPrice : null;

  const rf = inputs.rf ?? DEFAULT_INPUTS.rf;
  const erp = inputs.erp ?? DEFAULT_INPUTS.erp;
  const beta = inputs.beta ?? (finData.beta as number | null) ?? DEFAULT_INPUTS.beta;
  const taxRate = inputs.taxRate ?? DEFAULT_INPUTS.taxRate;
  const terminalGrowth = inputs.terminalGrowth ?? DEFAULT_INPUTS.terminalGrowth;
  const forecastYears = inputs.forecastYears ?? DEFAULT_INPUTS.forecastYears;
  const wacc = computeWacc(rf, beta, erp);

  // FCF base estimate
  let fcfBase: number;
  let fcfBaseOrigin: string;
  if (typeof inputs.fcfBaseOverride === 'number' && inputs.fcfBaseOverride > 0) {
    fcfBase = inputs.fcfBaseOverride;
    fcfBaseOrigin = 'user_override';
  } else {
    // Rough: marketCap * (1 / per) * 0.7 (net income to FCF)
    const per = finData.per as number | null;
    if (marketCap && per && per > 0) {
      fcfBase = (marketCap / per) * 0.7;
      fcfBaseOrigin = 'estimated_from_per';
    } else if (marketCap) {
      // fallback: 5% of marketCap
      fcfBase = marketCap * 0.05;
      fcfBaseOrigin = 'estimated_5pct_marketcap';
    } else {
      throw new ValuationUnavailableError(
        'no_financials',
        'marketCap 또는 PER 데이터 없음 — financials 미수집 또는 외부 API 미지원 종목',
      );
    }
  }

  if (!sharesOutstanding || sharesOutstanding <= 0) {
    throw new ValuationUnavailableError(
      'no_shares_outstanding',
      'sharesOutstanding 추정 불가 — marketCap/price 부족',
    );
  }

  const scenarios = inputs.scenarios ?? DEFAULT_SCENARIOS;

  // Reverse DCF
  let impliedGrowthHigh: number | null = null;
  let reverseDcfNote = '';
  if (marketCap && fcfBase > 0 && wacc > terminalGrowth) {
    impliedGrowthHigh = reverseDcfGrowth(fcfBase, marketCap, terminalGrowth, wacc, forecastYears);
    if (impliedGrowthHigh !== null) {
      reverseDcfNote = `현재 주가 기준 시장은 향후 ${forecastYears}년 FCF 성장률 약 ${(impliedGrowthHigh * 100).toFixed(1)}%를 기대합니다.`;
    } else {
      reverseDcfNote = '입력 데이터 부족';
    }
  } else {
    reverseDcfNote = 'marketCap 또는 FCF base 없음';
  }

  // Forward DCF scenarios
  const forwardScenarios = (['bull', 'base', 'bear'] as const).map((name) => {
    const sc = scenarios[name];
    const { ev, perShare } = forwardValuation(fcfBase, sc.growthHigh, terminalGrowth, wacc, forecastYears, sharesOutstanding ?? 1);
    const upside = currentPrice && perShare > 0 ? ((perShare - currentPrice) / currentPrice) * 100 : null;
    return {
      name, growthHigh: sc.growthHigh, prob: sc.prob,
      enterpriseValue: ev, equityValue: ev,  // 부채 단순화: equity = ev
      perShare, upside,
    };
  });
  const weighted = forwardScenarios.reduce((s, x) => s + x.perShare * x.prob, 0);
  const upsideToWeighted = currentPrice && weighted > 0 ? ((weighted - currentPrice) / currentPrice) * 100 : null;

  // Comps — same-sector tickers with financials
  const sector = master.sector;
  let comps: ValuationResult['comps'] = {
    peerSector: sector,
    peersUsed: 0,
    avgPer: null, avgPbr: null, avgPsr: null,
    impliedPriceByPer: null, impliedPriceByPbr: null,
  };
  if (sector) {
    const peers = await prisma.ticker.findMany({
      where: { sector, market: master.market, symbol: { not: symbol } },
    });
    const peerSymbols = peers.map((p) => p.symbol);
    if (peerSymbols.length > 0) {
      const peerFins = await prisma.financial.findMany({
        where: { symbol: { in: peerSymbols } },
        orderBy: { asOf: 'desc' },
      });
      const latestByPeer = new Map<string, typeof peerFins[number]>();
      for (const f of peerFins) if (!latestByPeer.has(f.symbol)) latestByPeer.set(f.symbol, f);
      const peerData = Array.from(latestByPeer.values()).map((f) => (f.data as Record<string, number | null>));
      const pers = peerData.map((d) => d.per).filter((v): v is number => typeof v === 'number' && v > 0 && v < 1000);
      const pbrs = peerData.map((d) => d.pbr).filter((v): v is number => typeof v === 'number' && v > 0 && v < 100);
      const psrs = peerData.map((d) => d.psr).filter((v): v is number => typeof v === 'number' && v > 0 && v < 100);
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
      const avgPer = avg(pers);
      const avgPbr = avg(pbrs);
      const avgPsr = avg(psrs);
      const eps = finData.eps as number | null;
      const bps = finData.bps as number | null;
      comps = {
        peerSector: sector,
        peersUsed: latestByPeer.size,
        avgPer, avgPbr, avgPsr,
        impliedPriceByPer: avgPer && eps ? avgPer * eps : null,
        impliedPriceByPbr: avgPbr && bps ? avgPbr * bps : null,
      };
    }
  }

  // Sensitivity 5x5
  const waccRange = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => wacc + d);
  const baseGrowth = scenarios.base.growthHigh;
  const growthRange = [-0.04, -0.02, 0, 0.02, 0.04].map((d) => baseGrowth + d);
  const matrix: number[][] = waccRange.map((w) =>
    growthRange.map((g) => {
      if (w <= terminalGrowth) return 0;
      const { perShare } = forwardValuation(fcfBase, g, terminalGrowth, w, forecastYears, sharesOutstanding ?? 1);
      return perShare;
    })
  );

  return {
    symbol, currency: master.currency,
    currentPrice, sharesOutstanding,
    inputs: { wacc, rf, erp, beta, taxRate, terminalGrowth, forecastYears, fcfBase, fcfBaseOriginEstimate: fcfBaseOrigin },
    reverseDcf: { impliedGrowthHigh, note: reverseDcfNote },
    forwardDcf: { scenarios: forwardScenarios, probabilityWeightedPerShare: weighted, upsideToWeighted },
    comps,
    sensitivity: { waccRange, growthRange, matrix },
  };
}
