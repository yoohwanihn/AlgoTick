import { useParams } from 'react-router-dom';
import { useTicker } from '../hooks/useTicker.js';
import { TickerHeader } from '../components/ticker/TickerHeader.js';
import { TickerSummary } from '../components/ticker/TickerSummary.js';
import { TickerTabs } from '../components/ticker/TickerTabs.js';
import { WarningBadge } from '../components/ui/WarningBadge.js';
import { SignalPanel } from '../components/ticker/SignalPanel.js';
import { WatchlistButton } from '../components/ticker/WatchlistButton.js';

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
        <div className="flex items-center gap-2">
          <WatchlistButton symbol={data.data.symbol} />
          <WarningBadge warnings={data.warnings ?? []} />
        </div>
      </div>
      <TickerSummary res={data} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <TickerTabs
          candles={data.data.candles}
          signals={data.data.signals}
          financials={data.data.financials}
          news={data.data.news}
          insiderTrades={data.data.insiderTrades}
          profile={data.data.profile}
          symbol={data.data.symbol}
          market={data.data.market}
          exchange={data.data.exchange}
          currency={data.data.currency}
        />
        <SignalPanel signals={data.data.signals} />
      </div>
    </div>
  );
}
