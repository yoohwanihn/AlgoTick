import { useState } from 'react';
import { ChartPanel } from './ChartPanel.js';
import { ValuationTab } from './ValuationTab.js';
import { NewsTab } from './NewsTab.js';
import { InstitutionalTab } from './InstitutionalTab.js';
import { OverviewTab } from './OverviewTab.js';
import type { TickerCandle, Signal, FinancialPeriod, NewsItem, InsiderTrade, InstitutionalHolding, CompanyProfile } from '../../types/api.js';

type TabKey = 'chart' | 'valuation' | 'institutional' | 'news' | 'overview';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'chart', label: '차트', icon: '📊' },
  { key: 'valuation', label: '가치평가', icon: '💎' },
  { key: 'institutional', label: '기관/내부자', icon: '🏛️' },
  { key: 'news', label: '뉴스', icon: '📰' },
  { key: 'overview', label: '개요', icon: '📋' },
];

interface Props {
  candles: TickerCandle[];
  signals?: Signal[];
  financials?: FinancialPeriod[];
  news?: NewsItem[];
  insiderTrades?: InsiderTrade[];
  institutionalHoldings?: InstitutionalHolding[];
  profile?: CompanyProfile | null;
  symbol: string;
  market: string;
  exchange: string;
  currency: string;
}

export function TickerTabs({ candles, signals = [], financials = [], news = [], insiderTrades = [], institutionalHoldings = [], profile = null, symbol, market, exchange, currency }: Props) {
  const [active, setActive] = useState<TabKey>('chart');
  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              active === t.key
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div>
        {active === 'chart' && <ChartPanel candles={candles} signals={signals} />}
        {active === 'valuation' && <ValuationTab financials={financials} symbol={symbol} />}
        {active === 'institutional' && <InstitutionalTab trades={insiderTrades} holdings={institutionalHoldings} />}
        {active === 'news' && <NewsTab news={news} />}
        {active === 'overview' && <OverviewTab profile={profile} symbol={symbol} market={market} exchange={exchange} currency={currency} />}
      </div>
    </div>
  );
}
