const numberFormatter = new Intl.NumberFormat('en-US');
const krwFormatter = new Intl.NumberFormat('ko-KR');

export function formatPrice(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '-';
  if (currency === 'KRW') return `${krwFormatter.format(Math.round(value))}원`;
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number, opts?: { sign?: boolean }): string {
  if (!Number.isFinite(value)) return '-';
  const sign = opts?.sign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return numberFormatter.format(value);
}

export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}
