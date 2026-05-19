import { useParams } from 'react-router-dom';
import { useTicker } from '../hooks/useTicker.js';
import { TickerHeader } from '../components/ticker/TickerHeader.js';
import { TickerSummary } from '../components/ticker/TickerSummary.js';
import { TickerTabs } from '../components/ticker/TickerTabs.js';
import { WarningBadge } from '../components/ui/WarningBadge.js';

export function TickerDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { data, isLoading, error } = useTicker(symbol);

  if (isLoading) return <div className="py-12 text-center text-slate-500">{symbol} 로딩 중...</div>;
  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-bear">에러: {(error as Error).message}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="py-4">
      <div className="flex items-start justify-between mb-2">
        <TickerHeader res={data} />
        <WarningBadge warnings={data.warnings ?? []} />
      </div>
      <TickerSummary res={data} />
      <TickerTabs candles={data.data.candles} />
    </div>
  );
}
