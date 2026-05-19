import { sma } from './sma.js';

export interface BollingerResult {
  middle: Array<number | null>;
  upper: Array<number | null>;
  lower: Array<number | null>;
}

export function bollinger(values: number[], period = 20, stdDevMult = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: Array<number | null> = new Array(values.length).fill(null);
  const lower: Array<number | null> = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (middle[i] === null) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (values[j]! - middle[i]!) ** 2;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i]! + std * stdDevMult;
    lower[i] = middle[i]! - std * stdDevMult;
  }
  return { middle, upper, lower };
}
