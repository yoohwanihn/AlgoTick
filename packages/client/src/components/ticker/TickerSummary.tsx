import { formatVolume } from '../../lib/format.js';
import { Metric } from '../ui/Metric.js';
import type { TickerDetailResponse } from '../../types/api.js';

export function TickerSummary({ res }: { res: TickerDetailResponse }) {
  const { data } = res;
  const quote = data.quote;
  const candles = data.candles;
  const high52 = candles.length > 0 ? Math.max(...candles.slice(-252).map((c) => c.high)) : null;
  const low52 = candles.length > 0 ? Math.min(...candles.slice(-252).map((c) => c.low)) : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Metric label="거래량" value={quote ? formatVolume(quote.volume) : '-'} confidence={quote ? 'actual' : undefined} source="yahoo" />
      <Metric label="52주 최고" value={high52 !== null ? high52.toFixed(2) : '-'} confidence="estimated" source="calc" formula="max(high, last 252 candles)" />
      <Metric label="52주 최저" value={low52 !== null ? low52.toFixed(2) : '-'} confidence="estimated" source="calc" formula="min(low, last 252 candles)" />
      <Metric label="일봉 데이터" value={`${candles.length}건`} confidence="actual" source="yahoo" />
    </div>
  );
}
