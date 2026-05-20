import { useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCompare } from '../hooks/useCompare.js';
import type { ComparePosition } from '../hooks/useCompare.js';
import { formatPrice as fmtPrice, formatPct as fmtPct } from '../util/format.js';

const COLORS = ['#3b82f6', '#10b981', '#ef4444'];

function fmtMul(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  return `${v.toFixed(2)}배`;
}

function NormalizedOverlay({ items }: { items: ComparePosition[] }) {
  const width = 1000;
  const height = 200;
  const series = items.map((it, idx) => {
    if (it.candles.length < 2) return null;
    const first = it.candles[0]!.close;
    if (first <= 0) return null;
    const normalized = it.candles.map((c) => (c.close / first) * 100);
    const min = Math.min(...normalized);
    const max = Math.max(...normalized);
    return { symbol: it.symbol, normalized, color: COLORS[idx] ?? '#94a3b8', min, max };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  if (series.length === 0) return <p className="text-xs text-slate-500 py-4 text-center">차트 데이터 없음</p>;

  const globalMin = Math.min(...series.map((s) => s.min)) - 5;
  const globalMax = Math.max(...series.map((s) => s.max)) + 5;
  const range = Math.max(0.0001, globalMax - globalMin);
  const len = Math.max(...series.map((s) => s.normalized.length));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950">
        <line
          x1="0"
          y1={height - ((100 - globalMin) / range) * height}
          x2={width}
          y2={height - ((100 - globalMin) / range) * height}
          stroke="#94a3b8"
          strokeDasharray="2,2"
        />
        {series.map((s) => {
          const points = s.normalized.map((v, i) => {
            const x = (i / Math.max(1, len - 1)) * width;
            const y = height - ((v - globalMin) / range) * height;
            return `${x},${y}`;
          }).join(' ');
          return <polyline key={s.symbol} points={points} fill="none" stroke={s.color} strokeWidth="1.5" />;
        })}
      </svg>
      <div className="flex gap-3 mt-2 text-xs">
        {series.map((s) => (
          <span key={s.symbol} className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ background: s.color }} />
            {s.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ComparePage() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get('s') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const [symbols, setSymbols] = useState<string[]>(initial.length > 0 ? initial : []);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (symbols.length > 0) setParams({ s: symbols.join(',') });
    else setParams({});
  }, [symbols, setParams]);

  const { data, isLoading, error } = useCompare(symbols);

  function add() {
    const sym = input.trim().toUpperCase();
    if (!sym || symbols.length >= 3 || symbols.includes(sym)) return;
    setSymbols([...symbols, sym]);
    setInput('');
  }

  function remove(sym: string) {
    setSymbols(symbols.filter((s) => s !== sym));
  }

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold mb-4">종목 비교</h2>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {symbols.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded text-sm">
            <span className="font-mono font-bold" style={{ color: COLORS[i] }}>{s}</span>
            <button onClick={() => remove(s)} className="text-slate-400 hover:text-bear" aria-label={`remove ${s}`}>✕</button>
          </span>
        ))}
        {symbols.length < 3 && (
          <>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="티커 추가 (AAPL, 005930.KS)"
              className="px-2 py-1 text-sm border rounded dark:bg-slate-900 dark:border-slate-700 w-56"
            />
            <button onClick={add} className="px-3 py-1 bg-accent text-slate-900 rounded text-sm font-medium">+ 추가</button>
          </>
        )}
      </div>

      {symbols.length === 0 && (
        <p className="text-slate-500 text-sm py-12 text-center">티커를 추가하면 비교가 시작됩니다. 최대 3개.</p>
      )}

      {isLoading && symbols.length > 0 && <p className="text-slate-500">로딩 중...</p>}
      {error && <p className="text-bear">{(error as Error).message}</p>}

      {data && data.missingSymbols.length > 0 && (
        <p className="text-amber-500 text-sm mb-3">마스터에 없음: {data.missingSymbols.join(', ')}</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={`grid gap-4 mb-6 ${data.items.length === 1 ? 'grid-cols-1' : data.items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {data.items.map((it, idx) => {
              const up = (it.quote?.changePct ?? 0) >= 0;
              const fin = (it.financial ?? {}) as Record<string, number | null>;
              return (
                <div key={it.symbol} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <Link to={`/ticker/${encodeURIComponent(it.symbol)}`} className="font-mono font-bold text-lg" style={{ color: COLORS[idx] }}>
                      {it.symbol}
                    </Link>
                    <span className="text-xs text-slate-500">{it.exchange}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 truncate mb-3">{it.name}</p>

                  <div className="mb-4">
                    <div className="text-2xl font-semibold">{fmtPrice(it.quote?.price, it.currency)}</div>
                    <div className={up ? 'text-bull text-sm' : 'text-bear text-sm'}>
                      {fmtPct(it.quote?.changePct, { sign: true })}
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ['PER', fmtMul(fin.per)],
                        ['PBR', fmtMul(fin.pbr)],
                        ['ROE', fmtPct(fin.roePct)],
                        ['EPS', fin.eps !== null && fin.eps !== undefined ? String(fin.eps) : '-'],
                        ['배당수익률', fmtPct(fin.dividendYieldPct)],
                      ].map(([label, val]) => (
                        <tr key={label as string} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="py-1.5 text-xs text-slate-500">{label}</td>
                          <td className="py-1.5 text-right font-mono">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-3 flex gap-3 text-xs text-slate-500">
                    <span>내부자 {it.insiderCount}건</span>
                    <span>뉴스 {it.newsCount}건</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 text-slate-600 dark:text-slate-400">180일 가격 흐름 (시작일=100)</h3>
            <NormalizedOverlay items={data.items} />
          </div>
        </>
      )}
    </div>
  );
}
