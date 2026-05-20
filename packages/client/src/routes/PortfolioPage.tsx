import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio, useLots, useAddLot, useDeleteLot } from '../hooks/usePortfolio.js';

function fmt(v: number | null | undefined, currency = 'USD'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  if (currency === 'KRW') return `${Math.round(v).toLocaleString('ko-KR')}원`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
function inputDateNow(): string {
  return new Date().toISOString().slice(0, 16);
}

export function PortfolioPage() {
  const { data: pf, isLoading } = usePortfolio();
  const { data: lotsData } = useLots();
  const addLot = useAddLot();
  const deleteLot = useDeleteLot();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: '', side: 'BUY' as 'BUY' | 'SELL', qty: '', price: '', tradedAt: inputDateNow(), note: '' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(form.qty); const price = Number(form.price);
    if (!form.symbol || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) return;
    addLot.mutate(
      { symbol: form.symbol, side: form.side, qty, price, tradedAt: new Date(form.tradedAt).toISOString(), note: form.note || undefined },
      { onSuccess: () => { setForm({ ...form, symbol: '', qty: '', price: '', note: '' }); setShowForm(false); } }
    );
  }

  if (isLoading) return <div className="py-12 text-center text-slate-500">로딩 중...</div>;
  const positions = pf?.positions ?? [];

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">포트폴리오</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-accent text-slate-900 font-medium rounded text-sm">
          {showForm ? '닫기' : '+ 매매 추가'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <input className="px-2 py-1.5 border rounded col-span-2 dark:bg-slate-900 dark:border-slate-700" placeholder="티커 (AAPL, 005930.KS)" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} required />
          <select className="px-2 py-1.5 border rounded dark:bg-slate-900 dark:border-slate-700" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as 'BUY' | 'SELL' })}>
            <option value="BUY">매수</option><option value="SELL">매도</option>
          </select>
          <input className="px-2 py-1.5 border rounded dark:bg-slate-900 dark:border-slate-700" type="number" step="any" placeholder="수량" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} required />
          <input className="px-2 py-1.5 border rounded dark:bg-slate-900 dark:border-slate-700" type="number" step="any" placeholder="단가" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          <input className="px-2 py-1.5 border rounded col-span-2 dark:bg-slate-900 dark:border-slate-700" type="datetime-local" value={form.tradedAt} onChange={(e) => setForm({ ...form, tradedAt: e.target.value })} />
          <input className="px-2 py-1.5 border rounded col-span-3 dark:bg-slate-900 dark:border-slate-700" placeholder="메모 (선택)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button type="submit" className="px-3 py-1.5 bg-slate-800 text-white rounded col-span-1">저장</button>
        </form>
      )}

      {pf && positions.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase">총 매수금액 ({pf.baseCurrency})</div>
              <div className="text-lg font-semibold mt-1">${pf.totalCostBasis.toFixed(0)}</div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase">평가금액 ({pf.baseCurrency})</div>
              <div className="text-lg font-semibold mt-1">{pf.totalMarketValue !== null ? `$${pf.totalMarketValue.toFixed(0)}` : '-'}</div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase">평가손익 ({pf.baseCurrency})</div>
              <div className={`text-lg font-semibold mt-1 ${(pf.totalUnrealizedPnl ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>
                {pf.totalUnrealizedPnl !== null ? `${pf.totalUnrealizedPnl >= 0 ? '+' : ''}$${pf.totalUnrealizedPnl.toFixed(0)}` : '-'}
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase">수익률</div>
              <div className={`text-lg font-semibold mt-1 ${(pf.totalUnrealizedPnlPct ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>{fmtPct(pf.totalUnrealizedPnlPct)}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            기준 통화: {pf.baseCurrency}
            {Object.entries(pf.fxRates).filter(([c]) => c !== pf.baseCurrency).map(([c, r]) => (
              <span key={c}> · 1 {c} = ${r.toFixed(6)}</span>
            ))}
          </p>
        </>
      )}

      {positions.length === 0 ? (
        <p className="text-center text-slate-500 py-12">매매 기록이 없습니다. 상단의 "+ 매매 추가"로 시작하세요.</p>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">종목</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">수량</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">평단</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">현재가</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">평가금액</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">손익</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">수익률</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <Link to={`/ticker/${encodeURIComponent(p.symbol)}`} className="hover:text-accent">
                      <div className="font-mono font-bold">{p.symbol}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                    </Link>
                  </td>
                  <td className="text-right px-3 py-2 font-mono">{p.qty.toFixed(2)}</td>
                  <td className="text-right px-3 py-2 font-mono text-slate-500">{fmt(p.avgCost, p.currency)}</td>
                  <td className="text-right px-3 py-2 font-mono">{fmt(p.currentPrice, p.currency)}</td>
                  <td className="text-right px-3 py-2 font-mono">{fmt(p.marketValue, p.currency)}</td>
                  <td className={`text-right px-3 py-2 font-mono ${(p.unrealizedPnl ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>{fmt(p.unrealizedPnl, p.currency)}</td>
                  <td className={`text-right px-3 py-2 font-mono ${(p.unrealizedPnlPct ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>{fmtPct(p.unrealizedPnlPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lotsData && lotsData.lots.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">매매 기록 ({lotsData.lots.length})</h3>
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">일시</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">종목</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">거래</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">수량</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">단가</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">메모</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lotsData.lots.map((l) => (
                  <tr key={l.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(l.tradedAt).toLocaleString('ko-KR')}</td>
                    <td className="px-3 py-2 font-mono">{l.symbol}</td>
                    <td className="text-center px-3 py-2">
                      <span className={l.side === 'BUY' ? 'text-bull font-semibold' : 'text-bear font-semibold'}>{l.side === 'BUY' ? '▲ 매수' : '▼ 매도'}</span>
                    </td>
                    <td className="text-right px-3 py-2 font-mono">{l.qty}</td>
                    <td className="text-right px-3 py-2 font-mono">{l.price}</td>
                    <td className="px-3 py-2 text-slate-500">{l.note}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteLot.mutate(l.id)} className="text-xs text-bear hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
