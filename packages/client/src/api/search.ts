import { apiFetch } from './client.js';
import type { SearchResponse } from '../types/api.js';

export function searchTickers(query: string, limit = 10): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiFetch<SearchResponse>(`/api/search?${params.toString()}`);
}
