import { formatPrice, formatPercent, formatRelativeTime } from '../../lib/format.js';
import { useSseTick, useLatestTick } from '../../hooks/useSseTick.js';
import type { TickerDetailResponse } from '../../types/api.js';

export function TickerHeader({ res }: { res: TickerDetailResponse }) {
  const { data, freshness, lastFetchedAt } = res;
  useSseTick(data.symbol);
  const tick = useLatestTick(data.symbol);
  const price = tick?.price ?? data.quote?.price;
  const changePct = tick?.changePct ?? data.quote?.changePct;
  const live = !!tick;
  const up = (changePct ?? 0) >= 0;
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">{data.symbol}</h1>
        <span className="text-sm text-slate-500">
          {data.name ?? data.symbol} · {data.exchange} · {data.currency}
        </span>
        {live && <span className="text-xs text-bull animate-pulse">● LIVE</span>}
      </div>
      {price !== undefined && changePct !== undefined ? (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold">{formatPrice(price, data.currency)}</span>
          <span className={up ? 'text-bull text-base font-semibold' : 'text-bear text-base font-semibold'}>
            {formatPercent(changePct, { sign: true })}
          </span>
          <span className="text-xs text-slate-400">
            마지막 갱신 {formatRelativeTime(tick?.ts ?? lastFetchedAt)}
            {freshness === 'stale' && !tick && <span className="ml-1 text-amber-500">· stale</span>}
            {freshness === 'offline' && <span className="ml-1 text-bear">· offline</span>}
          </span>
        </div>
      ) : (
        <p className="text-sm text-slate-500">시세 데이터 없음</p>
      )}
    </div>
  );
}
