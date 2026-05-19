import { useState } from 'react';
import { ChartPanel } from './ChartPanel.js';
import { ValuationTab } from './ValuationTab.js';
import type { TickerCandle, Signal, FinancialPeriod } from '../../types/api.js';

type TabKey = 'chart' | 'valuation' | 'institutional' | 'news' | 'overview';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'chart', label: '차트', icon: '📊' },
  { key: 'valuation', label: '가치평가', icon: '💎' },
  { key: 'institutional', label: '기관/내부자', icon: '🏛️' },
  { key: 'news', label: '뉴스', icon: '📰' },
  { key: 'overview', label: '개요', icon: '📋' },
];

function Pending({ stage }: { stage: number }) {
  return (
    <div className="py-12 text-center text-slate-500">
      Stage {stage}에서 구현 예정입니다.
    </div>
  );
}

interface Props {
  candles: TickerCandle[];
  signals?: Signal[];
  financials?: FinancialPeriod[];
}

export function TickerTabs({ candles, signals = [], financials = [] }: Props) {
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
        {active === 'valuation' && <ValuationTab financials={financials} />}
        {active === 'institutional' && <Pending stage={5} />}
        {active === 'news' && <Pending stage={5} />}
        {active === 'overview' && <Pending stage={5} />}
      </div>
    </div>
  );
}
