import type {
  QuoteForValidation,
  CandleForValidation,
  ValidatorContext,
} from './types.js';
import type { ValidationResult } from '@algotick/shared';

const MARKET_CAP_TOLERANCE = 0.05;
const PRICE_JUMP_THRESHOLD = 0.20;

export function quoteRules(q: QuoteForValidation, _ctx: ValidatorContext): ValidationResult[] {
  const out: ValidationResult[] = [];

  if (q.marketCap !== undefined && q.marketCap <= 0) {
    out.push({
      severity: 'error',
      code: 'MARKET_CAP_POSITIVE',
      message: `market_cap must be > 0 (observed ${q.marketCap})`,
      details: { marketCap: q.marketCap },
    });
  }

  if (q.volume < 0) {
    out.push({
      severity: 'error',
      code: 'VOLUME_NEGATIVE',
      message: `volume must be ≥ 0 (observed ${q.volume})`,
      details: { volume: q.volume },
    });
  }

  if (q.marketCap && q.sharesOutstanding && q.price > 0 && q.sharesOutstanding > 0) {
    const calc = q.price * q.sharesOutstanding;
    const diff = Math.abs(calc - q.marketCap) / q.marketCap;
    if (diff > MARKET_CAP_TOLERANCE) {
      out.push({
        severity: 'error',
        code: 'MARKET_CAP_MISMATCH',
        message: `market_cap differs from price × shares by ${(diff * 100).toFixed(1)}% (>${MARKET_CAP_TOLERANCE * 100}%)`,
        details: { calc, observed: q.marketCap, price: q.price, shares: q.sharesOutstanding },
      });
    }
  }

  if (q.ts.getTime() > Date.now() + 8 * 60 * 60 * 1000) {
    out.push({
      severity: 'error',
      code: 'FUTURE_DATE',
      message: `quote ts is in the future: ${q.ts.toISOString()}`,
      details: { ts: q.ts.toISOString() },
    });
  }

  return out;
}

export function candleRules(
  c: CandleForValidation,
  prev: CandleForValidation | undefined,
  _ctx: ValidatorContext,
): ValidationResult[] {
  const out: ValidationResult[] = [];

  const maxOC = Math.max(c.open, c.close);
  const minOC = Math.min(c.open, c.close);
  if (c.high < maxOC || c.low > minOC || c.high < c.low) {
    out.push({
      severity: 'error',
      code: 'OHLC_INVARIANT',
      message: `OHLC violates invariants (high ${c.high}, open ${c.open}, low ${c.low}, close ${c.close})`,
      details: { high: c.high, low: c.low, open: c.open, close: c.close },
    });
  }

  if (c.volume === 0) {
    out.push({
      severity: 'info',
      code: 'VOLUME_ZERO',
      message: 'volume is zero (휴장 가능성)',
      details: { date: c.date },
    });
  }

  if (c.volume < 0) {
    out.push({
      severity: 'error',
      code: 'VOLUME_NEGATIVE',
      message: `volume must be ≥ 0 (observed ${c.volume})`,
      details: { volume: c.volume },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (c.date > today) {
    out.push({
      severity: 'error',
      code: 'FUTURE_DATE',
      message: `candle date is in the future: ${c.date}`,
      details: { date: c.date, today },
    });
  }

  if (prev && prev.close > 0) {
    const change = Math.abs(c.close - prev.close) / prev.close;
    if (change > PRICE_JUMP_THRESHOLD) {
      out.push({
        severity: 'warning',
        code: 'PRICE_JUMP_LARGE',
        message: `close jumped ${(change * 100).toFixed(1)}% vs previous (분할/배당 가능성)`,
        details: { previousClose: prev.close, currentClose: c.close, change },
      });
    }
  }

  return out;
}
