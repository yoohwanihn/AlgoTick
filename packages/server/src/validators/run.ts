import type { ValidationResult } from '@algotick/shared';
import type {
  QuoteForValidation,
  CandleForValidation,
  ValidatorContext,
} from './types.js';
import { quoteRules, candleRules } from './rules.js';

export function validateQuote(quote: QuoteForValidation, ctx: ValidatorContext): ValidationResult[] {
  return quoteRules(quote, ctx);
}

export function validateCandle(
  candle: CandleForValidation,
  previous: CandleForValidation | undefined,
  ctx: ValidatorContext,
): ValidationResult[] {
  return candleRules(candle, previous, ctx);
}

export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'error');
}

export function pickWarnings(results: ValidationResult[]): ValidationResult[] {
  return results.filter((r) => r.severity === 'warning' || r.severity === 'info');
}
