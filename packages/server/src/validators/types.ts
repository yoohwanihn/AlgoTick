import type { ValidationResult } from '@algotick/shared';
import type { Market } from '@algotick/shared';

export interface ValidatorContext {
  symbol: string;
  market: Market;
}

export interface QuoteForValidation {
  symbol: string;
  price: number;
  volume: number;
  changePct: number;
  ts: Date;
  source: string;
  marketCap?: number;
  sharesOutstanding?: number;
}

export interface CandleForValidation {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Validator<T> = (data: T, ctx: ValidatorContext) => ValidationResult[];

export type CandleValidator = (
  data: CandleForValidation,
  previous: CandleForValidation | undefined,
  ctx: ValidatorContext,
) => ValidationResult[];

export type { ValidationResult };
