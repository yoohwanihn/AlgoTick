import { useEffect } from 'react';
import { connectSse, subscribeSymbols, unsubscribeSymbols, onTick } from '../sse/connection.js';
import { useSseStore, type Tick } from '../store/sseStore.js';

export function useSseTick(symbol: string | undefined): void {
  const setTick = useSseStore((s) => s.setTick);
  useEffect(() => {
    connectSse();
    const unsubscribe = onTick((t: Tick) => setTick(t));
    return unsubscribe;
  }, [setTick]);
  useEffect(() => {
    if (!symbol) return;
    void subscribeSymbols([symbol]);
    return () => { void unsubscribeSymbols([symbol]); };
  }, [symbol]);
}

export function useLatestTick(symbol: string | undefined): Tick | undefined {
  return useSseStore((s) => (symbol ? s.ticks[symbol] : undefined));
}
