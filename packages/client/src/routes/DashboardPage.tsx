import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useWatchlist } from '../hooks/useWatchlist.js';

function fmtPrice(price: number, currency: string): string {
  if (currency === 'KRW') return `${Math.round(price).toLocaleString('ko-KR')}원`;
  return `$${price.toFixed(2)}`;
}

export function DashboardPage() {
  const { data, isLoading } = useWatchlist();
  if (isLoading) return <div className="py-12 text-center text-slate-500">로딩 중...</div>;
  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="py-6">
        <h2 className="text-2xl font-bold mb-6">대시보드</h2>
        <EmptyState
          icon="⭐"
          title="관심종목이 비어있어요"
          description="상단 검색바로 종목을 찾아 ⭐ 버튼으로 추가하세요."
          action={
            <div className="flex gap-2 justify-center flex-wrap">
              <Link to="/ticker/AAPL" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">AAPL</Link>
              <Link to="/ticker/MSFT" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">MSFT</Link>
              <Link to="/ticker/005930.KS" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">삼성전자</Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold mb-6">대시보드 · 관심종목 ({items.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => {
          const up = (it.quote?.changePct ?? 0) >= 0;
          return (
            <Link
              key={it.symbol}
              to={`/ticker/${encodeURIComponent(it.symbol)}`}
              className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-accent hover:shadow"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono font-bold">{it.symbol}</span>
                <span className="text-xs text-slate-500">{it.exchange}</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 truncate mb-2">{it.name}</div>
              {it.quote ? (
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">{fmtPrice(it.quote.price, it.currency)}</span>
                  <span className={up ? 'text-bull text-sm' : 'text-bear text-sm'}>
                    {up ? '+' : ''}{it.quote.changePct.toFixed(2)}%
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400">시세 없음 (페치 대기)</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
