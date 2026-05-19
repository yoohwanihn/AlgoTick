import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWatchlist, addWatchlist, removeWatchlist, hasWatchlist } from '../api/watchlist.js';

export function useWatchlist() {
  return useQuery({ queryKey: ['watchlist'], queryFn: listWatchlist });
}

export function useIsWatched(symbol: string | undefined) {
  return useQuery({
    queryKey: ['watchlist', 'has', symbol],
    queryFn: () => hasWatchlist(symbol!),
    enabled: !!symbol,
  });
}

export function useToggleWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { symbol: string; watched: boolean }) => {
      if (args.watched) await removeWatchlist(args.symbol);
      else await addWatchlist(args.symbol);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['watchlist', 'has', vars.symbol] });
    },
  });
}
