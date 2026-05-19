import type { FinancialPeriod } from '../../types/api.js';
import { Metric } from '../ui/Metric.js';

const ROW_LABELS: Array<{ key: string; label: string; format: 'amount' | 'percent' | 'multiple' | 'price' | 'beta' }> = [
  // KR-style (네이버) fields
  { key: 'revenue', label: '매출액', format: 'amount' },
  { key: 'opIncome', label: '영업이익', format: 'amount' },
  { key: 'netIncome', label: '당기순이익', format: 'amount' },
  { key: 'operatingMarginPct', label: '영업이익률', format: 'percent' },
  { key: 'netMarginPct', label: '순이익률', format: 'percent' },
  // Common
  { key: 'roePct', label: 'ROE', format: 'percent' },
  { key: 'eps', label: 'EPS', format: 'price' },
  { key: 'per', label: 'PER', format: 'multiple' },
  { key: 'pbr', label: 'PBR', format: 'multiple' },
  { key: 'psr', label: 'PSR', format: 'multiple' },
  { key: 'dividendYieldPct', label: '배당수익률', format: 'percent' },
  // US-only (Finnhub)
  { key: 'revenueGrowthYoyPct', label: '매출 성장률 (YoY)', format: 'percent' },
  { key: 'beta', label: '베타', format: 'beta' },
  { key: 'debtToEquity', label: '부채/자기자본', format: 'multiple' },
  // KR-only
  { key: 'debtRatioPct', label: '부채비율', format: 'percent' },
  { key: 'bps', label: 'BPS', format: 'price' },
];

function formatVal(v: number | null | undefined, fmt: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  if (fmt === 'percent') return `${v.toFixed(2)}%`;
  if (fmt === 'multiple') return `${v.toFixed(2)}배`;
  if (fmt === 'beta') return v.toFixed(2);
  if (fmt === 'price') return v.toLocaleString();
  // amount (억원 단위 가정 — 네이버는 모든 금액을 백만원 단위로 주는데, 표시할 땐 적당히 포맷)
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

export function ValuationTab({ financials }: { financials: FinancialPeriod[] }) {
  if (financials.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500">
        <p className="text-sm">재무 데이터 없음</p>
        <p className="text-xs mt-1">미주 종목은 Stage 5b(Finnhub 통합) 이후 표시됩니다.</p>
      </div>
    );
  }

  // 최근 4개 기간만 표시
  const periods = financials.slice(-4);
  const latest = periods[periods.length - 1];

  // 모든 기간에서 null/undefined인 행은 표시하지 않음
  const visibleRows = ROW_LABELS.filter((r) => periods.some((p) => p.data[r.key] !== null && p.data[r.key] !== undefined));

  return (
    <div className="space-y-6">
      {/* 핵심 지표 카드 */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="PER" value={formatVal(latest.data.per, 'multiple')} confidence="estimated" source={latest.source as never} asOf={latest.period} />
          <Metric label="PBR" value={formatVal(latest.data.pbr, 'multiple')} confidence="estimated" source={latest.source as never} asOf={latest.period} />
          <Metric label="ROE" value={formatVal(latest.data.roePct, 'percent')} confidence="estimated" source={latest.source as never} asOf={latest.period} />
          <Metric label="배당수익률" value={formatVal(latest.data.dividendYieldPct, 'percent')} confidence="estimated" source={latest.source as never} asOf={latest.period} />
        </div>
      )}

      {/* 재무 시계열 테이블 */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase text-xs">항목</th>
              {periods.map((p) => (
                <th key={p.period} className="text-right px-3 py-2 font-mono text-xs text-slate-500">
                  {p.period.includes('TTM') ? p.period : `${p.period.slice(0, 4)}.${p.period.slice(4, 6)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.key} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.label}</td>
                {periods.map((p) => (
                  <td key={p.period} className="text-right px-3 py-2 font-mono">
                    {formatVal(p.data[r.key], r.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        출처: {latest?.source ?? 'n/a'} · 단위는 회사 공시 단위(억원/원). DCF/Comps/민감도는 Stage 5b 이후.
      </p>
    </div>
  );
}
