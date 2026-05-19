import { formatVolume } from '../../lib/format.js';
import type { TickerDetailResponse } from '../../types/api.js';

export function TickerSummary({ res }: { res: TickerDetailResponse }) {
  const { data } = res;
  const quote = data.quote;
  const candles = data.candles;
  const high52 = candles.length > 0 ? Math.max(...candles.slice(-252).map((c) => c.high)) : null;
  const low52 = candles.length > 0 ? Math.min(...candles.slice(-252).map((c) => c.low)) : null;

  const cells: Array<{ label: string; value: string }> = [
    { label: '거래량', value: quote ? formatVolume(quote.volume) : '-' },
    { label: '52주 최고', value: high52 !== null ? high52.toFixed(2) : '-' },
    { label: '52주 최저', value: low52 !== null ? low52.toFixed(2) : '-' },
    { label: '일봉 데이터', value: `${candles.length}건` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {cells.map((c) => (
        <div key={c.label} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-500 uppercase">{c.label}</div>
          <div className="text-lg font-semibold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
