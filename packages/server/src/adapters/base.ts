import type { Market } from '@algotick/shared';

export interface QuoteResult {
  symbol: string;
  price: number;
  volume: number;
  changePct: number;
  ts: Date;
  source: string;
  // §14.2 self-consistency 검증용 — Adapter가 채울 수 있으면 채움
  marketCap?: number;
  sharesOutstanding?: number;
}

export interface CandleResult {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
}

export interface MarketAdapter {
  readonly market: Market;
  getQuote(symbol: string): Promise<QuoteResult>;
  getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export class AdapterError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`[${source}] ${message}`);
    this.name = 'AdapterError';
  }
}
