import { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type LineData,
  ColorType,
} from 'lightweight-charts';
import type { TickerCandle } from '../../types/api.js';

function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

const MA_PERIODS = [5, 20, 60, 120] as const;
const MA_COLORS: Record<(typeof MA_PERIODS)[number], string> = {
  5: '#fbbf24',
  20: '#a78bfa',
  60: '#60a5fa',
  120: '#f472b6',
};

export function ChartPanel({ candles }: { candles: TickerCandle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#0f172a' : '#ffffff' },
        textColor: isDark ? '#cbd5e1' : '#334155',
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
        horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      },
      timeScale: { timeVisible: false, secondsVisible: false },
      rightPriceScale: { borderColor: isDark ? '#1e293b' : '#e2e8f0' },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.date as CandlestickData['time'],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    const closes = candles.map((c) => c.close);
    for (const p of MA_PERIODS) {
      const maSeries = chart.addLineSeries({
        color: MA_COLORS[p],
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const maValues = sma(closes, p);
      const maData: LineData[] = candles
        .map((c, i) => ({ time: c.date as LineData['time'], value: maValues[i] }))
        .filter((d): d is LineData => d.value !== null && d.value !== undefined);
      maSeries.setData(maData);
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles]);

  if (candles.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500">
        차트 데이터 없음
      </div>
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
        <span className="text-slate-500">이평선:</span>
        {MA_PERIODS.map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ background: MA_COLORS[p] }}></span>
            {p}일
          </span>
        ))}
      </div>
      <div ref={containerRef} className="h-[420px]" />
    </div>
  );
}
