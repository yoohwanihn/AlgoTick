import { apiFetch } from './client.js';

export interface WatchlistItem {
  symbol: string;
  memo?: string | null;
  addedAt: string;
  position: number;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  quote: { price: number; changePct: number; volume: number; ts: string } | null;
}

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export function listWatchlist(): Promise<{ items: WatchlistItem[] }> {
  return apiFetch<{ items: WatchlistItem[] }>('/api/watchlist');
}

export async function addWatchlist(symbol: string, memo?: string): Promise<void> {
  await fetch(`${API}/api/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, memo }),
  });
}

export async function removeWatchlist(symbol: string): Promise<void> {
  await fetch(`${API}/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
}

export async function hasWatchlist(symbol: string): Promise<boolean> {
  const r = await apiFetch<{ exists: boolean }>(`/api/watchlist/has/${encodeURIComponent(symbol)}`);
  return r.exists;
}
