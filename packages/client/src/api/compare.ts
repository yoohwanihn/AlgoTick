import { apiFetch } from './client.js';

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

export function compareTickers(symbols: string[]): Promise<CompareResponse> {
  const s = symbols.map((x) => encodeURIComponent(x)).join(',');
  return apiFetch<CompareResponse>(`/api/compare?s=${s}`);
}
