const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface ValuationInputs {
  rf?: number; erp?: number; beta?: number; taxRate?: number;
  terminalGrowth?: number; forecastYears?: number; fcfBaseOverride?: number;
  scenarios?: {
    bull: { growthHigh: number; prob: number };
    base: { growthHigh: number; prob: number };
    bear: { growthHigh: number; prob: number };
  };
}

export interface ValuationResult {
  symbol: string; currency: string;
  currentPrice: number | null; sharesOutstanding: number | null;
  inputs: { wacc: number; rf: number; erp: number; beta: number; taxRate: number; terminalGrowth: number; forecastYears: number; fcfBase: number; fcfBaseOriginEstimate: string };
  reverseDcf: { impliedGrowthHigh: number | null; note: string };
  forwardDcf: {
    scenarios: Array<{ name: 'bull' | 'base' | 'bear'; growthHigh: number; prob: number; enterpriseValue: number; equityValue: number; perShare: number; upside: number | null }>;
    probabilityWeightedPerShare: number;
    upsideToWeighted: number | null;
  };
  comps: { peerSector: string | null; peersUsed: number; avgPer: number | null; avgPbr: number | null; avgPsr: number | null; impliedPriceByPer: number | null; impliedPriceByPbr: number | null };
  sensitivity: { waccRange: number[]; growthRange: number[]; matrix: number[][] };
}

export class ValuationUnavailableError extends Error {
  constructor(public reason: string, message: string) {
    super(message);
    this.name = 'ValuationUnavailableError';
  }
}

export async function calculateValuation(symbol: string, inputs: ValuationInputs = {}): Promise<ValuationResult> {
  const res = await fetch(`${API}/api/valuation/${encodeURIComponent(symbol)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? {};
    throw new ValuationUnavailableError(err.reason ?? 'unknown', err.message ?? '가치평가 불가');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
