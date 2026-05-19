import { sma } from './sma.js';
import { rsi } from './rsi.js';
import { macd } from './macd.js';
import { bollinger } from './bollinger.js';

export type SignalCode =
  | 'GOLDEN_CROSS' | 'DEAD_CROSS'
  | 'BULLISH_ALIGNMENT' | 'BEARISH_ALIGNMENT'
  | 'BOLLINGER_SQUEEZE' | 'BOLLINGER_EXPANSION'
  | 'RSI_OVERBOUGHT' | 'RSI_OVERSOLD'
  | 'MACD_BULLISH_CROSS' | 'MACD_BEARISH_CROSS'
  | 'VOLUME_SPIKE';

export type SignalSeverity = 'info' | 'warning' | 'positive' | 'negative';

export interface Signal {
  code: SignalCode;
  date: string;
  message: string;
  severity: SignalSeverity;
}

const SIGNAL_MESSAGES: Record<SignalCode, (ctx: Record<string, unknown>) => string> = {
  GOLDEN_CROSS: () => '5일선이 20일선을 상향 돌파 — 단기 상승 추세 진입 신호',
  DEAD_CROSS: () => '5일선이 20일선을 하향 돌파 — 단기 하락 추세 진입 신호',
  BULLISH_ALIGNMENT: () => '정배열 (5>20>60>120) — 강한 상승 추세',
  BEARISH_ALIGNMENT: () => '역배열 (5<20<60<120) — 강한 하락 추세',
  BOLLINGER_SQUEEZE: (c) => `볼린저 스퀴즈 — 밴드 폭이 60일 평균의 ${((c.ratio as number) * 100).toFixed(0)}% 수준, 변동성 확대 임박`,
  BOLLINGER_EXPANSION: (c) => `볼린저 익스팬션 — 밴드 폭이 60일 평균의 ${((c.ratio as number) * 100).toFixed(0)}%로 확대, 큰 가격 변동 진행 중`,
  RSI_OVERBOUGHT: (c) => `RSI ${(c.rsi as number).toFixed(1)} — 과매수 영역 (70 초과), 단기 조정 가능성`,
  RSI_OVERSOLD: (c) => `RSI ${(c.rsi as number).toFixed(1)} — 과매도 영역 (30 미만), 단기 반등 가능성`,
  MACD_BULLISH_CROSS: () => 'MACD가 시그널선 상향 돌파 — 상승 모멘텀',
  MACD_BEARISH_CROSS: () => 'MACD가 시그널선 하향 돌파 — 하락 모멘텀',
  VOLUME_SPIKE: (c) => `거래량 ${(c.ratio as number).toFixed(1)}배 급증 — 평소(20일 평균) 대비 이상 거래량`,
};

const SIGNAL_SEVERITY: Record<SignalCode, SignalSeverity> = {
  GOLDEN_CROSS: 'positive', DEAD_CROSS: 'negative',
  BULLISH_ALIGNMENT: 'positive', BEARISH_ALIGNMENT: 'negative',
  BOLLINGER_SQUEEZE: 'info', BOLLINGER_EXPANSION: 'warning',
  RSI_OVERBOUGHT: 'warning', RSI_OVERSOLD: 'info',
  MACD_BULLISH_CROSS: 'positive', MACD_BEARISH_CROSS: 'negative',
  VOLUME_SPIKE: 'warning',
};

function pushSignal(out: Signal[], code: SignalCode, date: string, ctx: Record<string, unknown> = {}) {
  out.push({ code, date, message: SIGNAL_MESSAGES[code](ctx), severity: SIGNAL_SEVERITY[code] });
}

export interface CandleForSignals {
  date: string;
  close: number;
  volume: number;
}

const BOLLINGER_SQUEEZE_RATIO = 0.70;
const BOLLINGER_EXPANSION_RATIO = 1.30;
const VOLUME_SPIKE_RATIO = 2.0;

export function detectSignals(input: number[] | CandleForSignals[]): Signal[] {
  const isCandles = input.length > 0 && typeof (input[0] as CandleForSignals).close === 'number' && 'date' in (input[0] as object);
  const closeArr: number[] = isCandles ? (input as CandleForSignals[]).map((c) => c.close) : (input as number[]);
  const dates: string[] = isCandles ? (input as CandleForSignals[]).map((c) => c.date) : closeArr.map((_, i) => String(i));
  const volumes: number[] = isCandles ? (input as CandleForSignals[]).map((c) => c.volume) : [];

  if (closeArr.length < 20) return [];

  const out: Signal[] = [];
  const ma5 = sma(closeArr, 5);
  const ma20 = sma(closeArr, 20);
  const ma60 = sma(closeArr, 60);
  const ma120 = sma(closeArr, 120);
  const rsiSeries = rsi(closeArr, 14);
  const macdResult = macd(closeArr);
  const boll = bollinger(closeArr, 20, 2);

  const last = closeArr.length - 1;
  const prev = last - 1;
  const lastDate = dates[last]!;

  if (ma5[last] !== null && ma20[last] !== null && ma5[prev] !== null && ma20[prev] !== null) {
    const wasBelow = ma5[prev]! < ma20[prev]!;
    const nowAbove = ma5[last]! > ma20[last]!;
    if (wasBelow && nowAbove) pushSignal(out, 'GOLDEN_CROSS', lastDate);
    const wasAbove = ma5[prev]! > ma20[prev]!;
    const nowBelow = ma5[last]! < ma20[last]!;
    if (wasAbove && nowBelow) pushSignal(out, 'DEAD_CROSS', lastDate);
  }

  if (ma5[last] !== null && ma20[last] !== null && ma60[last] !== null && ma120[last] !== null) {
    if (ma5[last]! > ma20[last]! && ma20[last]! > ma60[last]! && ma60[last]! > ma120[last]!) {
      pushSignal(out, 'BULLISH_ALIGNMENT', lastDate);
    } else if (ma5[last]! < ma20[last]! && ma20[last]! < ma60[last]! && ma60[last]! < ma120[last]!) {
      pushSignal(out, 'BEARISH_ALIGNMENT', lastDate);
    }
  }

  if (boll.upper[last] !== null && boll.lower[last] !== null && closeArr.length >= 80) {
    const bandwidths: number[] = [];
    for (let i = last - 60; i <= last; i++) {
      if (boll.upper[i] !== null && boll.lower[i] !== null) {
        bandwidths.push(boll.upper[i]! - boll.lower[i]!);
      }
    }
    if (bandwidths.length >= 20) {
      const avg = bandwidths.slice(0, -1).reduce((a, b) => a + b, 0) / (bandwidths.length - 1);
      const current = bandwidths[bandwidths.length - 1]!;
      const ratio = current / avg;
      if (ratio <= BOLLINGER_SQUEEZE_RATIO) pushSignal(out, 'BOLLINGER_SQUEEZE', lastDate, { ratio });
      else if (ratio >= BOLLINGER_EXPANSION_RATIO) pushSignal(out, 'BOLLINGER_EXPANSION', lastDate, { ratio });
    }
  }

  const lastRsi = rsiSeries[last] ?? null;
  if (lastRsi !== null) {
    if (lastRsi > 70) pushSignal(out, 'RSI_OVERBOUGHT', lastDate, { rsi: lastRsi });
    else if (lastRsi < 30) pushSignal(out, 'RSI_OVERSOLD', lastDate, { rsi: lastRsi });
  }

  const macdLast = macdResult.macd[last], macdPrev = macdResult.macd[prev];
  const sigLast = macdResult.signal[last], sigPrev = macdResult.signal[prev];
  if (macdLast != null && macdPrev != null && sigLast != null && sigPrev != null) {
    if (macdPrev < sigPrev && macdLast > sigLast) pushSignal(out, 'MACD_BULLISH_CROSS', lastDate);
    else if (macdPrev > sigPrev && macdLast < sigLast) pushSignal(out, 'MACD_BEARISH_CROSS', lastDate);
  }

  if (volumes.length >= 20) {
    const recentVols = volumes.slice(-20);
    const avgVol = recentVols.slice(0, -1).reduce((a, b) => a + b, 0) / (recentVols.length - 1);
    const lastVol = volumes[volumes.length - 1]!;
    if (avgVol > 0 && lastVol / avgVol >= VOLUME_SPIKE_RATIO) {
      pushSignal(out, 'VOLUME_SPIKE', lastDate, { ratio: lastVol / avgVol });
    }
  }

  return out;
}
