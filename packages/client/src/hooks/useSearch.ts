import { useQuery } from '@tanstack/react-query';
import { searchTickers } from '../api/search.js';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTickers(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}
