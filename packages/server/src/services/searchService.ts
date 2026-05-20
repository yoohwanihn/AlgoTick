import { getPrisma } from '../db.js';
import type { Ticker } from '@algotick/shared';

/**
 * 18K ticker에서 검색.
 * - DB는 take(limit*5)로 over-fetch (정렬 보정용 풀)
 * - 후처리: score 기반 정렬 (symbol 정확 매치 > prefix > nameKo/nameEn 정확 매치 > contains)
 * - 같은 score 내에서는 이름 길이 짧은 순 (정확 매치에 가까움)
 */
function score(row: { symbol: string; nameEn: string | null; nameKo: string | null }, q: string): number {
  const ql = q.toLowerCase();
  const symL = row.symbol.toLowerCase();
  if (symL === ql) return 1000;
  if (symL.startsWith(ql)) return 500;
  const enL = row.nameEn?.toLowerCase() ?? '';
  const koL = row.nameKo?.toLowerCase() ?? '';
  if (enL === ql || koL === ql) return 400;
  if (enL.startsWith(ql) || koL.startsWith(ql)) return 300;
  if (enL.includes(ql) || koL.includes(ql)) return 200;
  return 100;
}

export async function searchTickers(query: string, limit = 10): Promise<Ticker[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const rows = await getPrisma().ticker.findMany({
    where: {
      OR: [
        { symbol: { startsWith: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameKo: { contains: q } },
      ],
    },
    take: limit * 5,
  });

  rows.sort((a, b) => {
    const sa = score(a, q);
    const sb = score(b, q);
    if (sa !== sb) return sb - sa;
    const lenA = (a.nameKo ?? a.nameEn ?? a.symbol).length;
    const lenB = (b.nameKo ?? b.nameEn ?? b.symbol).length;
    return lenA - lenB;
  });

  return rows.slice(0, limit).map((r) => ({
    symbol: r.symbol,
    market: r.market as Ticker['market'],
    exchange: r.exchange as Ticker['exchange'],
    nameEn: r.nameEn ?? undefined,
    nameKo: r.nameKo ?? undefined,
    sector: r.sector ?? undefined,
    industry: r.industry ?? undefined,
    currency: r.currency as Ticker['currency'],
    listedAt: r.listedAt?.toISOString(),
    delistedAt: r.delistedAt?.toISOString(),
  }));
}
