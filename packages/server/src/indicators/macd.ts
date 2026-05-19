function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i]!;
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export interface MacdResult {
  macd: Array<number | null>;
  signal: Array<number | null>;
  histogram: Array<number | null>;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const macdLine = values.map((_, i) =>
    fastE[i] !== null && slowE[i] !== null ? fastE[i]! - slowE[i]! : null,
  );
  const definedFrom = macdLine.findIndex((v) => v !== null);
  const macdValues = definedFrom >= 0 ? macdLine.slice(definedFrom).map((v) => v!) : [];
  const signalSub = ema(macdValues, signalPeriod);
  const signalLine: Array<number | null> = new Array(values.length).fill(null);
  if (definedFrom >= 0) {
    for (let i = 0; i < signalSub.length; i++) signalLine[definedFrom + i] = signalSub[i] ?? null;
  }
  const histogram = macdLine.map((m, i) =>
    m !== null && signalLine[i] !== null ? m - signalLine[i]! : null,
  );
  return { macd: macdLine, signal: signalLine, histogram };
}
