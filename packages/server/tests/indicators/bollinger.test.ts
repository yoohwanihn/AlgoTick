import { describe, expect, it } from 'vitest';
import { bollinger } from '../../src/indicators';

describe('bollinger', () => {
  it('returns three series of correct length', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const b = bollinger(closes, 20, 2);
    expect(b.middle).toHaveLength(30);
    expect(b.upper).toHaveLength(30);
    expect(b.lower).toHaveLength(30);
  });
  it('upper > middle > lower when defined', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 4) * 10);
    const b = bollinger(closes, 20, 2);
    for (let i = 0; i < closes.length; i++) {
      if (b.upper[i] !== null) {
        expect(b.upper[i]!).toBeGreaterThanOrEqual(b.middle[i]!);
        expect(b.middle[i]!).toBeGreaterThanOrEqual(b.lower[i]!);
      }
    }
  });
});
