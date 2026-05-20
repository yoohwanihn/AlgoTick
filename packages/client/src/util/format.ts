/**
 * 통화 단위에 맞춰 가격 포매팅.
 * - USD → $1,234.56
 * - KRW → 1,234,560원   (정수)
 * - JPY → ¥3,250        (정수, 일본은 일상에서 소수점 미사용)
 * - 기타 → 1,234.56 {ccy}
 */
export function formatPrice(value: number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const ccy = (currency ?? 'USD').toUpperCase();
  switch (ccy) {
    case 'USD':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'KRW':
      return `${Math.round(value).toLocaleString('ko-KR')}원`;
    case 'JPY':
      return `¥${Math.round(value).toLocaleString('ja-JP')}`;
    default:
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${ccy}`;
  }
}

export function formatPct(value: number | null | undefined, opts?: { sign?: boolean; digits?: number }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const digits = opts?.digits ?? 2;
  const sign = opts?.sign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
