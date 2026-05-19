import { apiFetch } from './client.js';

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

export interface ScreenerRule {
  id: string;
  name: string;
  conditions: ScreenerCondition[];
  createdAt: string;
}

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function runScreener(conditions: ScreenerCondition[]): Promise<{ hits: ScreenerHit[]; total: number }> {
  const res = await fetch(`${API}/api/screener/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditions }),
  });
  return res.json() as Promise<{ hits: ScreenerHit[]; total: number }>;
}

export async function listRules(): Promise<{ rules: ScreenerRule[] }> {
  return apiFetch<{ rules: ScreenerRule[] }>('/api/screener/rules');
}

export async function saveRule(name: string, conditions: ScreenerCondition[]): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`${API}/api/screener/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, conditions }),
  });
  return res.json() as Promise<{ ok: boolean; id: string }>;
}

export async function deleteRule(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/api/screener/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json() as Promise<{ ok: boolean }>;
}
