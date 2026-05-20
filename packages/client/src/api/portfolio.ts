import { apiFetch } from './client.js';

export interface PortfolioPosition {
  symbol: string; name: string; market: string; exchange: string; currency: string;
  qty: number; avgCost: number;
  currentPrice: number | null; marketValue: number | null; costBasis: number;
  unrealizedPnl: number | null; unrealizedPnlPct: number | null; lotsCount: number;
  costBasisBase: number;
  marketValueBase: number | null;
  unrealizedPnlBase: number | null;
}
export interface PortfolioSummary {
  baseCurrency: string;
  fxRates: Record<string, number>;
  totalCostBasis: number;
  totalMarketValue: number | null;
  totalUnrealizedPnl: number | null;
  totalUnrealizedPnlPct: number | null;
  positions: PortfolioPosition[];
}
export interface Lot {
  id: string; symbol: string; name: string;
  side: 'BUY' | 'SELL'; qty: number; price: number;
  tradedAt: string; note?: string | null;
}

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export const getPortfolio = (): Promise<PortfolioSummary> => apiFetch<PortfolioSummary>('/api/portfolio');
export const listLots = (): Promise<{ lots: Lot[] }> => apiFetch<{ lots: Lot[] }>('/api/portfolio/lots');

export interface AddLotBody {
  symbol: string; side: 'BUY' | 'SELL'; qty: number; price: number;
  tradedAt?: string; note?: string;
}
export async function addLot(body: AddLotBody): Promise<void> {
  await fetch(`${API}/api/portfolio/lots`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
export async function deleteLot(id: string): Promise<void> {
  await fetch(`${API}/api/portfolio/lots/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
