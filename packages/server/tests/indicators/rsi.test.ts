import { describe, expect, it } from 'vitest';
import { rsi } from '../../src/indicators';

describe('rsi', () => {
  it('returns nulls before period fills', () => {
    const r = rsi([10, 11, 12, 13], 14);
    expect(r.every((v) => v === null)).toBe(true);
  });
  it('produces values within [0, 100]', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 10 + Math.sin(i / 3) * 5);
    const r = rsi(closes, 14);
    const valid = r.filter((v): v is number => v !== null);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid.every((v) => v >= 0 && v <= 100)).toBe(true);
  });
  it('strong uptrend → high RSI', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const r = rsi(closes, 14);
    expect(r[r.length - 1]).toBeGreaterThan(70);
  });
});
