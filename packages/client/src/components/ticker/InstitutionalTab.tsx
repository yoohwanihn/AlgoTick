import type { InsiderTrade, InstitutionalHolding } from '../../types/api.js';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtShares(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtPrice(p?: number): string {
  if (p == null) return '-';
  return `$${p.toFixed(2)}`;
}

function fmtValue(shares: number, price?: number): string {
  if (price == null) return '-';
  const v = shares * price;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const CODE_LABEL: Record<string, string> = {
  S: '매도', P: '매수', A: '주식 부여', D: '처분', M: '옵션 행사', F: '세금 원천징수', G: '증여',
};

export function InstitutionalTab({ trades, holdings }: { trades: InsiderTrade[]; holdings: InstitutionalHolding[] }) {
  if (trades.length === 0 && holdings.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500">
        <p className="text-sm">내부자 거래 데이터 없음</p>
        <p className="text-xs mt-1">한국 종목은 DART corp_code 매핑 이후 표시됩니다.</p>
      </div>
    );
  }

  const totalBuy = trades.filter((t) => t.side === 'BUY').reduce((s, t) => s + t.shares, 0);
  const totalSell = trades.filter((t) => t.side === 'SELL').reduce((s, t) => s + t.shares, 0);

  return (
    <div className="space-y-6">
      {/* 5% 대량보유 섹션 */}
      {holdings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-slate-600 dark:text-slate-400">🏦 5% 이상 대량보유 ({holdings.length})</h3>
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">보고일</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">보고자</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">보유 주식수</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">지분율</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">변동</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const delta = h.prevPctOfFloat !== undefined && h.pctOfFloat !== undefined
                    ? h.pctOfFloat - h.prevPctOfFloat
                    : null;
                  return (
                    <tr key={h.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(h.reportDate)}</td>
                      <td className="px-3 py-2">{h.holderName}</td>
                      <td className="text-right px-3 py-2 font-mono">{h.shares.toLocaleString()}</td>
                      <td className="text-right px-3 py-2 font-mono">{h.pctOfFloat?.toFixed(2)}%</td>
                      <td className={`text-right px-3 py-2 font-mono ${(delta ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>
                        {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%p` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 내부자 거래 섹션 */}
      {trades.length > 0 && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase">총 거래 건수</div>
              <div className="text-lg font-semibold mt-1">{trades.length}건</div>
            </div>
            <div className="border border-bull rounded-lg p-3 bg-bull/5">
              <div className="text-xs text-bull uppercase">총 매수</div>
              <div className="text-lg font-semibold mt-1 text-bull">{fmtShares(totalBuy)}주</div>
            </div>
            <div className="border border-bear rounded-lg p-3 bg-bear/5">
              <div className="text-xs text-bear uppercase">총 매도</div>
              <div className="text-lg font-semibold mt-1 text-bear">{fmtShares(totalSell)}주</div>
            </div>
          </div>

          {/* 내부자 거래 타임라인 */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">거래일</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">이름</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">거래</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">수량</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">가격</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">거래대금</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(t.tradeDate)}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{t.personName}{t.role && <span className="text-xs text-slate-500 ml-1">({t.role})</span>}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={t.side === 'BUY' ? 'text-bull font-semibold' : 'text-bear font-semibold'}>
                        {t.side === 'BUY' ? '▲ 매수' : '▼ 매도'}
                      </span>
                      {t.transactionCode && (
                        <div className="text-xs text-slate-400">{CODE_LABEL[t.transactionCode] ?? t.transactionCode}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtShares(t.shares)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{fmtPrice(t.price)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtValue(t.shares, t.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-slate-400">
        출처: DART 전자공시 (임원·주요주주 특정증권 소유상황 + 5% 대량보유)
      </p>
    </div>
  );
}
