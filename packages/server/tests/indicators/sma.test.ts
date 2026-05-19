import { describe, expect, it } from 'vitest';
import { sma } from '../../src/indicators';

describe('sma', () => {
  it('returns nulls before window fills', () => {
    expect(sma([1, 2, 3], 5)).toEqual([null, null, null]);
  });
  it('computes 3-period moving average', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it('returns empty for empty input', () => {
    expect(sma([], 3)).toEqual([]);
  });
  it('throws for invalid period', () => {
    expect(() => sma([1, 2], 0)).toThrow();
  });
});
