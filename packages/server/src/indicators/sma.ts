export function sma(values: number[], period: number): Array<number | null> {
  if (period <= 0) throw new Error('period must be > 0');
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}
