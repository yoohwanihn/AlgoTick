import { describe, expect, it } from 'vitest';
import { macd } from '../../src/indicators';

describe('macd', () => {
  it('returns three series of correct length', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const r = macd(closes);
    expect(r.macd).toHaveLength(50);
    expect(r.signal).toHaveLength(50);
    expect(r.histogram).toHaveLength(50);
  });
  it('histogram = macd - signal where both defined', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 4) * 10);
    const r = macd(closes);
    for (let i = 0; i < r.histogram.length; i++) {
      if (r.macd[i] !== null && r.signal[i] !== null) {
        expect(r.histogram[i]).toBeCloseTo(r.macd[i]! - r.signal[i]!, 5);
      }
    }
  });
});
