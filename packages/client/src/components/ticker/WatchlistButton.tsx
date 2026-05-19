import { useIsWatched, useToggleWatchlist } from '../../hooks/useWatchlist.js';

export function WatchlistButton({ symbol }: { symbol: string }) {
  const { data: watched, isLoading } = useIsWatched(symbol);
  const toggle = useToggleWatchlist();
  const isWatched = !!watched;
  return (
    <button
      onClick={() => toggle.mutate({ symbol, watched: isWatched })}
      disabled={isLoading || toggle.isPending}
      className={`px-3 py-1.5 rounded text-sm font-medium ${
        isWatched
          ? 'bg-accent/20 text-accent border border-accent hover:bg-accent/30'
          : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
      aria-pressed={isWatched}
    >
      {isWatched ? '⭐ 관심종목' : '☆ 관심추가'}
    </button>
  );
}
