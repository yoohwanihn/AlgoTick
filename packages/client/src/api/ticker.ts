import { apiFetch } from './client.js';
import type { TickerDetailResponse } from '../types/api.js';

export function getTickerDetail(symbol: string): Promise<TickerDetailResponse> {
  return apiFetch<TickerDetailResponse>(`/api/ticker/${encodeURIComponent(symbol)}`);
}
