import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useIndices, useSectors, useMovers, useMarketEvents, useMarketNews,
} from '../hooks/useMarket.js';
import type { IndexSnapshot, SectorRow, MoverRow, MarketEventRow, MarketNewsRow } from '../hooks/useMarket.js';

type MarketFilter = 'US' | 'KR' | 'GLOBAL';

function pctColor(v: number | null): string {
  if (v === null) return '';
  return v >= 0 ? 'text-bull' : 'text-bear';
}

function fmtPct(v: number | null, sign = true): string {
  if (v === null || !Number.isFinite(v)) return '-';
  const prefix = sign && v > 0 ? '+' : '';
  return `${prefix}${v.toFixed(2)}%`;
}

function fmtNum(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '-';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function heatColor(avgChangePct: number): string {
  if (avgChangePct >= 2) return 'bg-green-600 text-white';
  if (avgChangePct >= 0.5) return 'bg-green-400 text-white';
  if (avgChangePct >= 0) return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300';
  if (avgChangePct >= -0.5) return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300';
  if (avgChangePct >= -2) return 'bg-red-400 text-white';
  return 'bg-red-600 text-white';
}

// --- Index Grid ---
function IndexGrid({ market }: { market?: string }) {
  const { data, isLoading } = useIndices(market === 'GLOBAL' ? undefined : market);
  if (isLoading) return <div className="text-slate-400 text-sm py-4">로딩 중...</div>;
  const items = data?.items ?? [];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((idx: IndexSnapshot) => (
        <div key={idx.code} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 truncate">{idx.name}</div>
          <div className="text-xs text-slate-400 font-mono mb-1">{idx.code}</div>
          <div className="text-lg font-semibold font-mono">
            {idx.value !== null ? fmtNum(idx.value) : <span className="text-slate-400">-</span>}
          </div>
          <div className={`text-sm font-medium ${pctColor(idx.changePct)}`}>
            {fmtPct(idx.changePct)}
          </div>
          {idx.ts && (
            <div className="text-xs text-slate-400 mt-1">
              {new Date(idx.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="col-span-4 text-slate-400 text-sm py-4">지수 데이터 없음</p>}
    </div>
  );
}

// --- Sector Heatmap ---
function SectorHeatmap({ market }: { market?: string }) {
  const { data, isLoading } = useSectors(market === 'GLOBAL' ? undefined : market);
  if (isLoading) return <div className="text-slate-400 text-sm py-4">로딩 중...</div>;
  const items = data?.items ?? [];
  if (items.length === 0) return <p className="text-slate-400 text-sm py-4">섹터 데이터 없음 (종목 시세 업데이트 후 표시됩니다)</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {items.map((s: SectorRow) => (
        <div key={s.sector} className={`rounded p-2 text-center ${heatColor(s.avgChangePct)}`}>
          <div className="text-xs font-medium truncate">{s.sector}</div>
          <div className="text-sm font-bold">{fmtPct(s.avgChangePct)}</div>
          <div className="text-xs opacity-80">{s.count}종목</div>
        </div>
      ))}
    </div>
  );
}

// --- Movers Panel ---
function MoversPanel({ market }: { market?: string }) {
  const { data: upData, isLoading: upLoading } = useMovers('up', market === 'GLOBAL' ? undefined : market, 10);
  const { data: downData, isLoading: downLoading } = useMovers('down', market === 'GLOBAL' ? undefined : market, 10);
  const upItems = upData?.items ?? [];
  const downItems = downData?.items ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top 10 상승 */}
      <div>
        <h3 className="text-sm font-semibold text-bull mb-2">TOP 10 상승</h3>
        {upLoading ? <div className="text-slate-400 text-sm">로딩 중...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-1">종목</th>
                <th className="text-right py-1">가격</th>
                <th className="text-right py-1">등락률</th>
              </tr>
            </thead>
            <tbody>
              {upItems.length === 0 ? (
                <tr><td colSpan={3} className="text-slate-400 py-4 text-center">데이터 없음</td></tr>
              ) : upItems.map((m: MoverRow) => (
                <tr key={m.symbol} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-1.5">
                    <Link to={`/ticker/${encodeURIComponent(m.symbol)}`} className="font-mono font-bold hover:text-accent text-xs">{m.symbol}</Link>
                    <div className="text-xs text-slate-500 truncate max-w-[120px]">{m.name}</div>
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs">{fmtNum(m.price)}</td>
                  <td className={`py-1.5 text-right font-mono text-xs font-semibold ${pctColor(m.changePct)}`}>{fmtPct(m.changePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top 10 하락 */}
      <div>
        <h3 className="text-sm font-semibold text-bear mb-2">TOP 10 하락</h3>
        {downLoading ? <div className="text-slate-400 text-sm">로딩 중...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-1">종목</th>
                <th className="text-right py-1">가격</th>
                <th className="text-right py-1">등락률</th>
              </tr>
            </thead>
            <tbody>
              {downItems.length === 0 ? (
                <tr><td colSpan={3} className="text-slate-400 py-4 text-center">데이터 없음</td></tr>
              ) : downItems.map((m: MoverRow) => (
                <tr key={m.symbol} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="py-1.5">
                    <Link to={`/ticker/${encodeURIComponent(m.symbol)}`} className="font-mono font-bold hover:text-accent text-xs">{m.symbol}</Link>
                    <div className="text-xs text-slate-500 truncate max-w-[120px]">{m.name}</div>
                  </td>
                  <td className="py-1.5 text-right font-mono text-xs">{fmtNum(m.price)}</td>
                  <td className={`py-1.5 text-right font-mono text-xs font-semibold ${pctColor(m.changePct)}`}>{fmtPct(m.changePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- Market Calendar ---
function MarketCalendar({ market }: { market?: string }) {
  const { data, isLoading } = useMarketEvents(market === 'GLOBAL' ? undefined : market);
  if (isLoading) return <div className="text-slate-400 text-sm py-4">로딩 중...</div>;
  const items = data?.items ?? [];
  if (items.length === 0) return <p className="text-slate-400 text-sm py-4">향후 7일 이내 이벤트 없음</p>;
  return (
    <div className="space-y-2">
      {items.map((e: MarketEventRow) => {
        const dt = new Date(e.eventDate);
        const kindBadge = e.kind === 'earnings'
          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300';
        return (
          <div key={e.id} className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="text-xs text-slate-500 shrink-0 w-20">
              {dt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${kindBadge}`}>{e.kind}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{e.title}</div>
              <div className="text-xs text-slate-400">{e.market}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Market News ---
function MarketNews() {
  const { data, isLoading } = useMarketNews();
  if (isLoading) return <div className="text-slate-400 text-sm py-4">로딩 중...</div>;
  const items = data?.items ?? [];
  if (items.length === 0) return <p className="text-slate-400 text-sm py-4">시장 뉴스 없음</p>;
  return (
    <div className="space-y-3">
      {items.map((n: MarketNewsRow) => (
        <div key={n.id} className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-accent leading-snug block">
            {n.title}
          </a>
          <div className="flex gap-2 text-xs text-slate-400 mt-1">
            {n.source && <span>{n.source}</span>}
            <span>{new Date(n.publishedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {n.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.summary}</p>}
        </div>
      ))}
    </div>
  );
}

// --- Main Page ---
export function MarketPage() {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('US');

  const marketButtons: { value: MarketFilter; label: string }[] = [
    { value: 'US', label: '미국' },
    { value: 'KR', label: '한국' },
    { value: 'GLOBAL', label: '글로벌' },
  ];

  return (
    <div className="py-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">시황 분석</h2>
        <div className="flex gap-1 border border-slate-200 dark:border-slate-800 rounded-lg p-1 bg-slate-50 dark:bg-slate-900">
          {marketButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setMarketFilter(btn.value)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                marketFilter === btn.value
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Indices */}
      <section>
        <h3 className="text-base font-semibold mb-3 text-slate-700 dark:text-slate-300">주요 지수</h3>
        <IndexGrid market={marketFilter} />
      </section>

      {/* Sector Heatmap */}
      <section>
        <h3 className="text-base font-semibold mb-3 text-slate-700 dark:text-slate-300">섹터 히트맵</h3>
        <SectorHeatmap market={marketFilter} />
      </section>

      {/* Top Movers */}
      <section>
        <h3 className="text-base font-semibold mb-3 text-slate-700 dark:text-slate-300">상승/하락 TOP 10</h3>
        <MoversPanel market={marketFilter} />
      </section>

      {/* Two-column layout for calendar + news */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-base font-semibold mb-3 text-slate-700 dark:text-slate-300">시장 캘린더 (향후 7일)</h3>
          <MarketCalendar market={marketFilter} />
        </section>

        <section>
          <h3 className="text-base font-semibold mb-3 text-slate-700 dark:text-slate-300">시장 뉴스</h3>
          <MarketNews />
        </section>
      </div>
    </div>
  );
}
