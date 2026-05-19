import { create } from 'zustand';

export interface Tick {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
  ts: string;
}

interface SseState {
  ticks: Record<string, Tick>;
  setTick: (t: Tick) => void;
}

export const useSseStore = create<SseState>((set) => ({
  ticks: {},
  setTick: (t) => set((s) => ({ ticks: { ...s.ticks, [t.symbol]: t } })),
}));
