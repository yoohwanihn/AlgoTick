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

/**
 * 시세 시각을 사용자 친화 문자열로.
 * - 1분 이내 → "방금"
 * - 1시간 이내 → "N분 전"
 * - 같은 날 → "오늘 HH:MM"
 * - 어제 → "어제 HH:MM"
 * - 그 외 → "M/D HH:MM"
 *
 * 외부 API가 어제 마감 데이터만 반환할 때 사용자가 "왜 stale인지" 알 수 있도록
 * 대시보드/워치리스트 카드에 표시 권장.
 */
export function formatQuoteTime(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `오늘 ${hh}:${mm}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `어제 ${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}
