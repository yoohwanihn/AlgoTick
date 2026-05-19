import { useQuery } from '@tanstack/react-query';
import { getTickerDetail } from '../api/ticker.js';

export function useTicker(symbol: string | undefined) {
  return useQuery({
    queryKey: ['ticker', symbol],
    queryFn: () => getTickerDetail(symbol!),
    enabled: !!symbol,
    staleTime: 30_000,
    retry: 1,
  });
}
