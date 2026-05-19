import { apiFetch } from './client.js';

export interface IndexSnapshot {
  code: string;
  name: string;
  market: string;
  kind: string;
  value: number | null;
  changePct: number | null;
  ts: string | null;
}

export interface SectorRow {
  sector: string;
  avgChangePct: number;
  count: number;
  totalVolume: number;
}

export interface MoverRow {
  symbol: string;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  price: number;
  changePct: number;
  volume: number;
}

export interface MarketEventRow {
  id: string;
  eventDate: string;
  market: string;
  kind: string;
  symbol: string | null;
  title: string;
  meta: Record<string, unknown> | null;
}

export interface MarketNewsRow {
  id: string;
  title: string;
  source: string | null;
  url: string;
  summary: string | null;
  publishedAt: string;
}

export function fetchIndices(market?: string): Promise<{ items: IndexSnapshot[] }> {
  const q = market ? `?market=${encodeURIComponent(market)}` : '';
  return apiFetch<{ items: IndexSnapshot[] }>(`/api/market/indices${q}`);
}

export function fetchSectors(market?: string): Promise<{ items: SectorRow[] }> {
  const q = market ? `?market=${encodeURIComponent(market)}` : '';
  return apiFetch<{ items: SectorRow[] }>(`/api/market/sectors${q}`);
}

export function fetchMovers(direction: 'up' | 'down' | 'volume' = 'up', market?: string, limit = 10): Promise<{ items: MoverRow[] }> {
  const params = new URLSearchParams({ direction, limit: String(limit) });
  if (market) params.set('market', market);
  return apiFetch<{ items: MoverRow[] }>(`/api/market/movers?${params.toString()}`);
}

export function fetchMarketEvents(market?: string): Promise<{ items: MarketEventRow[] }> {
  const q = market ? `?market=${encodeURIComponent(market)}` : '';
  return apiFetch<{ items: MarketEventRow[] }>(`/api/market/events${q}`);
}

export function fetchMarketNews(): Promise<{ items: MarketNewsRow[] }> {
  return apiFetch<{ items: MarketNewsRow[] }>('/api/market/news');
}
