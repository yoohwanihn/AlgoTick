import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useScreenerRules, useRunScreener, useSaveRule, useDeleteRule } from '../hooks/useScreener.js';
import type { ScreenerCondition, ScreenerField, ScreenerOp, ScreenerHit } from '../api/screener.js';

const FIELD_OPTIONS: { value: ScreenerField; label: string }[] = [
  { value: 'per', label: 'PER' },
  { value: 'pbr', label: 'PBR' },
  { value: 'roePct', label: 'ROE (%)' },
  { value: 'price', label: '현재가' },
  { value: 'changePct', label: '등락률 (%)' },
  { value: 'marketCap', label: '시가총액 ($M, US-only)' },
  { value: 'market', label: '시장 (US/KR)' },
];

const OP_OPTIONS: { value: ScreenerOp; label: string }[] = [
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
];

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  return v.toLocaleString();
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function fmtPrice(v: number | null | undefined, currency: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  if (currency === 'KRW') return `${Math.round(v).toLocaleString('ko-KR')}원`;
  return `$${v.toFixed(2)}`;
}

function defaultCondition(): ScreenerCondition {
  return { field: 'per', op: '<', value: 20 };
}

export function ScreenerPage() {
  const [conditions, setConditions] = useState<ScreenerCondition[]>([defaultCondition()]);
  const [ruleName, setRuleName] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [results, setResults] = useState<ScreenerHit[] | null>(null);
  const [resultTotal, setResultTotal] = useState(0);

  const { data: rulesData, isLoading: rulesLoading } = useScreenerRules();
  const runScreener = useRunScreener();
  const saveRule = useSaveRule();
  const deleteRule = useDeleteRule();

  function addCondition() {
    setConditions((prev) => [...prev, defaultCondition()]);
  }

  function removeCondition(idx: number) {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, partial: Partial<ScreenerCondition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...partial } : c))
    );
  }

  function handleRun() {
    runScreener.mutate(conditions, {
      onSuccess: (data) => {
        setResults(data.hits);
        setResultTotal(data.total);
      },
    });
  }

  function handleSave() {
    if (!ruleName.trim()) return;
    saveRule.mutate({ name: ruleName.trim(), conditions }, {
      onSuccess: () => setRuleName(''),
    });
  }

  function loadRule(ruleConditions: ScreenerCondition[]) {
    setConditions(ruleConditions);
    setShowRules(false);
    setResults(null);
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">스크리너</h2>
        <button
          onClick={() => setShowRules(!showRules)}
          className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {showRules ? '조건 빌더' : '저장된 룰'} ({rulesData?.rules.length ?? 0})
        </button>
      </div>

      {/* Saved rules panel */}
      {showRules && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase">저장된 룰</h3>
          {rulesLoading && <p className="text-slate-500 text-sm">로딩 중...</p>}
          {!rulesLoading && (!rulesData?.rules.length) && (
            <p className="text-slate-500 text-sm">저장된 룰이 없습니다.</p>
          )}
          <ul className="space-y-2">
            {rulesData?.rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded px-3 py-2">
                <div>
                  <span className="font-medium text-sm">{rule.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{rule.conditions.length}개 조건</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadRule(rule.conditions)}
                    className="text-xs text-accent hover:underline"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => deleteRule.mutate(rule.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Condition builder */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase">조건</h3>
        <div className="space-y-2 mb-4">
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              {idx > 0 && <span className="text-xs text-slate-500 font-semibold w-8">AND</span>}
              {idx === 0 && <span className="text-xs text-slate-500 w-8 invisible">AND</span>}
              <select
                className="px-2 py-1.5 border rounded text-sm dark:bg-slate-900 dark:border-slate-700"
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value as ScreenerField })}
              >
                {FIELD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                className="px-2 py-1.5 border rounded text-sm dark:bg-slate-900 dark:border-slate-700 w-16"
                value={cond.op}
                onChange={(e) => updateCondition(idx, { op: e.target.value as ScreenerOp })}
              >
                {OP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                className="px-2 py-1.5 border rounded text-sm dark:bg-slate-900 dark:border-slate-700 w-28"
                value={String(cond.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  updateCondition(idx, { value: Number.isFinite(num) && raw !== '' ? num : raw });
                }}
                placeholder="값"
              />
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(idx)}
                  className="text-xs text-red-500 hover:underline px-1"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={addCondition}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            + 조건 추가
          </button>
          <button
            onClick={handleRun}
            disabled={runScreener.isPending || conditions.length === 0}
            className="px-5 py-1.5 bg-accent text-slate-900 font-semibold rounded text-sm disabled:opacity-50"
          >
            {runScreener.isPending ? '실행 중...' : '실행'}
          </button>
        </div>

        {/* Save rule */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <input
            className="px-2 py-1.5 border rounded text-sm dark:bg-slate-900 dark:border-slate-700 flex-1 max-w-xs"
            placeholder="룰 이름"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
          />
          <button
            onClick={handleSave}
            disabled={!ruleName.trim() || saveRule.isPending}
            className="px-3 py-1.5 bg-slate-700 text-white rounded text-sm disabled:opacity-50"
          >
            {saveRule.isPending ? '저장 중...' : '이 룰 저장'}
          </button>
        </div>
      </div>

      {/* Results */}
      {runScreener.isError && (
        <div className="text-red-500 text-sm mb-4">실행 중 오류가 발생했습니다.</div>
      )}

      {results !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold">결과 ({resultTotal}개 종목)</h3>
          </div>
          {results.length === 0 ? (
            <p className="text-center text-slate-500 py-8 border border-slate-200 dark:border-slate-800 rounded-lg">
              조건에 맞는 종목이 없습니다.
            </p>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">종목</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">시장</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">현재가</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">등락률</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">PER</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">PBR</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">ROE</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">시가총액($M)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((hit) => (
                    <tr key={hit.symbol} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-3 py-2">
                        <Link to={`/ticker/${encodeURIComponent(hit.symbol)}`} className="hover:text-accent">
                          <div className="font-mono font-bold">{hit.symbol}</div>
                          <div className="text-xs text-slate-500">{hit.name}</div>
                        </Link>
                      </td>
                      <td className="text-center px-3 py-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${hit.market === 'US' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                          {hit.market}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2 font-mono">
                        {fmtPrice(hit.price, hit.currency)}
                      </td>
                      <td className={`text-right px-3 py-2 font-mono ${(hit.changePct ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>
                        {fmtPct(hit.changePct)}
                      </td>
                      <td className="text-right px-3 py-2 font-mono">{fmtNum(hit.per)}</td>
                      <td className="text-right px-3 py-2 font-mono">{fmtNum(hit.pbr)}</td>
                      <td className="text-right px-3 py-2 font-mono">{hit.roePct !== null ? `${hit.roePct.toFixed(1)}%` : '-'}</td>
                      <td className="text-right px-3 py-2 font-mono">{hit.marketCap !== null ? `$${hit.marketCap.toLocaleString()}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
