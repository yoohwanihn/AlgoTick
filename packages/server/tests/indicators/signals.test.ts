import { describe, expect, it } from 'vitest';
import { detectSignals } from '../../src/indicators';

describe('detectSignals', () => {
  it('detects RSI_OVERBOUGHT in strong uptrend', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const signals = detectSignals(closes);
    expect(signals.some((s) => s.code === 'RSI_OVERBOUGHT')).toBe(true);
  });
  it('returns empty for too-short series', () => {
    expect(detectSignals([1, 2, 3])).toEqual([]);
  });
  it('accepts CandleForSignals input with volumes', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, close: 100 + i, volume: 1000 }));
    const signals = detectSignals(candles);
    expect(Array.isArray(signals)).toBe(true);
  });
});
