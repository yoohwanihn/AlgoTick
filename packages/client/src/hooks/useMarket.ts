import { useQuery } from '@tanstack/react-query';
import { fetchIndices, fetchSectors, fetchMovers, fetchMarketEvents, fetchMarketNews } from '../api/market.js';

export type { IndexSnapshot, SectorRow, MoverRow, MarketEventRow, MarketNewsRow } from '../api/market.js';

export function useIndices(market?: string) {
  return useQuery({
    queryKey: ['market', 'indices', market],
    queryFn: () => fetchIndices(market),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useSectors(market?: string) {
  return useQuery({
    queryKey: ['market', 'sectors', market],
    queryFn: () => fetchSectors(market),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMovers(direction: 'up' | 'down' | 'volume' = 'up', market?: string, limit = 10) {
  return useQuery({
    queryKey: ['market', 'movers', direction, market, limit],
    queryFn: () => fetchMovers(direction, market, limit),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMarketEvents(market?: string) {
  return useQuery({
    queryKey: ['market', 'events', market],
    queryFn: () => fetchMarketEvents(market),
    staleTime: 5 * 60_000,
  });
}

export function useMarketNews() {
  return useQuery({
    queryKey: ['market', 'news'],
    queryFn: () => fetchMarketNews(),
    staleTime: 5 * 60_000,
  });
}
