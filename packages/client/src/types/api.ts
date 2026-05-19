import type { Ticker, ValidationResult } from '@algotick/shared';

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface SearchResponse {
  results: Ticker[];
}

export interface TickerCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerQuote {
  price: number;
  volume: number;
  changePct: number;
  ts: string;
}

export interface TickerDetailData {
  symbol: string;
  market: string;
  exchange: string;
  name?: string;
  currency: string;
  quote: TickerQuote | null;
  candles: TickerCandle[];
}

export interface TickerDetailResponse {
  data: TickerDetailData;
  freshness: 'fresh' | 'stale' | 'offline';
  lastFetchedAt: string;
  warnings?: ValidationResult[];
}
