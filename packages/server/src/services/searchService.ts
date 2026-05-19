import { getPrisma } from '../db.js';
import type { Ticker } from '@algotick/shared';

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
    take: limit,
    orderBy: [{ symbol: 'asc' }],
  });

  return rows.map((r) => ({
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
