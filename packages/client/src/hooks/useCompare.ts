import { useQuery } from '@tanstack/react-query';
import { compareTickers } from '../api/compare.js';

export type { ComparePosition, CompareResponse } from '../api/compare.js';

export function useCompare(symbols: string[]) {
  return useQuery({
    queryKey: ['compare', symbols.join(',')],
    queryFn: () => compareTickers(symbols),
    enabled: symbols.length > 0,
  });
}
