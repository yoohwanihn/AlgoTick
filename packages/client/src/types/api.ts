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

export interface Signal {
  code: string;
  date: string;
  message: string;
  severity: 'info' | 'warning' | 'positive' | 'negative';
}

export interface IndicatorSeries {
  ma5: Array<number | null>;
  ma20: Array<number | null>;
  ma60: Array<number | null>;
  ma120: Array<number | null>;
  rsi14: Array<number | null>;
  macdLine: Array<number | null>;
  macdSignal: Array<number | null>;
  macdHistogram: Array<number | null>;
  bollingerMiddle: Array<number | null>;
  bollingerUpper: Array<number | null>;
  bollingerLower: Array<number | null>;
}

export interface FinancialPeriod {
  period: string;
  periodType: 'A' | 'Q';
  asOf: string;
  source: string;
  data: Record<string, number | null>;
}

export interface NewsItem {
  id: string;
  title: string;
  source?: string;
  url: string;
  summary?: string;
  publishedAt: string;
}

export interface TickerDetailData {
  symbol: string;
  market: string;
  exchange: string;
  name?: string;
  currency: string;
  quote: TickerQuote | null;
  candles: TickerCandle[];
  indicators: IndicatorSeries;
  signals: Signal[];
  financials: FinancialPeriod[];
  news: NewsItem[];
}

export interface TickerDetailResponse {
  data: TickerDetailData;
  freshness: 'fresh' | 'stale' | 'offline';
  lastFetchedAt: string;
  warnings?: ValidationResult[];
}
