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

export interface FinancialPeriod {
  period: string;          // "202312"
  periodType: 'A' | 'Q';
  asOf: Date;              // 분기/연간 마감일
  source: string;
  data: Record<string, number | null>;  // revenue, op_income, net_income, roe, per, pbr, eps, bps, debtRatio, ...
}

export interface NewsItem {
  externalId: string;     // adapter-side stable id for upsert
  title: string;
  source?: string;
  url: string;
  summary?: string;
  publishedAt: Date;
}

export interface InsiderTradeItem {
  externalId: string;
  tradeDate: Date;
  filingDate?: Date;
  personName: string;
  role?: string;
  side: 'BUY' | 'SELL';
  shares: number;
  price?: number;
  transactionCode?: string;
  isDerivative?: boolean;
  source: string;
}

export interface MarketAdapter {
  readonly market: Market;
  getQuote(symbol: string): Promise<QuoteResult>;
  getDailyOHLCV(symbol: string, from: Date, to: Date): Promise<CandleResult[]>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  getFinancials(symbol: string): Promise<FinancialPeriod[]>;  // NEW
  getNews(symbol: string, limit?: number): Promise<NewsItem[]>;
  getInsiderTrades(symbol: string, limit?: number): Promise<InsiderTradeItem[]>;
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
