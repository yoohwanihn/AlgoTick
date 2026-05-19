import { describe, expect, it } from 'vitest';
import { validateQuote, validateCandle } from '../../src/validators';

const ctx = { symbol: 'AAPL', market: 'US' as const };

describe('validateQuote', () => {
  it('passes a healthy quote', () => {
    const results = validateQuote({
      symbol: 'AAPL',
      price: 234.52,
      volume: 50000000,
      changePct: 1.24,
      ts: new Date('2026-05-19T15:00:00Z'),
      source: 'yahoo',
      marketCap: 3_600_000_000_000,
      sharesOutstanding: 15_357_000_000,
    }, ctx);
    expect(results.filter(r => r.severity === 'error')).toHaveLength(0);
  });

  it('flags MARKET_CAP_MISMATCH when mcap ≠ price × shares (>5%)', () => {
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: 1000, changePct: 0, ts: new Date(), source: 'yahoo',
      marketCap: 1_000_000, sharesOutstanding: 5_000,
    }, ctx);
    expect(results.find(r => r.code === 'MARKET_CAP_MISMATCH')).toBeDefined();
  });

  it('flags MARKET_CAP_POSITIVE when zero', () => {
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: 1000, changePct: 0, ts: new Date(), source: 'yahoo',
      marketCap: 0,
    }, ctx);
    expect(results.find(r => r.code === 'MARKET_CAP_POSITIVE')?.severity).toBe('error');
  });

  it('flags VOLUME_NEGATIVE', () => {
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: -1, changePct: 0, ts: new Date(), source: 'yahoo',
    }, ctx);
    expect(results.find(r => r.code === 'VOLUME_NEGATIVE')?.severity).toBe('error');
  });

  it('flags FUTURE_DATE if ts > now', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const results = validateQuote({
      symbol: 'AAPL', price: 100, volume: 1000, changePct: 0, ts: future, source: 'yahoo',
    }, ctx);
    expect(results.find(r => r.code === 'FUTURE_DATE')).toBeDefined();
  });
});

describe('validateCandle', () => {
  const baseCandle = { symbol: 'AAPL', date: '2026-05-15', open: 100, high: 105, low: 95, close: 102, volume: 10000 };

  it('passes a healthy candle', () => {
    const r = validateCandle(baseCandle, undefined, ctx);
    expect(r.filter(x => x.severity === 'error')).toHaveLength(0);
  });

  it('flags OHLC_INVARIANT when high < close', () => {
    const r = validateCandle({ ...baseCandle, high: 90 }, undefined, ctx);
    expect(r.find(x => x.code === 'OHLC_INVARIANT')?.severity).toBe('error');
  });

  it('flags OHLC_INVARIANT when low > open', () => {
    const r = validateCandle({ ...baseCandle, low: 110 }, undefined, ctx);
    expect(r.find(x => x.code === 'OHLC_INVARIANT')).toBeDefined();
  });

  it('flags PRICE_JUMP_LARGE when close jumps >20% from previous', () => {
    const prev = { ...baseCandle, date: '2026-05-14', close: 100 };
    const today = { ...baseCandle, date: '2026-05-15', close: 130, high: 130, low: 100 };
    const r = validateCandle(today, prev, ctx);
    expect(r.find(x => x.code === 'PRICE_JUMP_LARGE')?.severity).toBe('warning');
  });

  it('flags VOLUME_ZERO as info', () => {
    const r = validateCandle({ ...baseCandle, volume: 0 }, undefined, ctx);
    expect(r.find(x => x.code === 'VOLUME_ZERO')?.severity).toBe('info');
  });

  it('flags FUTURE_DATE when date > today', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = validateCandle({ ...baseCandle, date: tomorrow }, undefined, ctx);
    expect(r.find(x => x.code === 'FUTURE_DATE')?.severity).toBe('error');
  });
});
