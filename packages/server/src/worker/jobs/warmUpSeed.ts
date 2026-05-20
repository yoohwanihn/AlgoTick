import pLimit from 'p-limit';
import { getPrisma } from '../../db.js';
import { getAdapter } from '../../adapters/router.js';
import { refreshTicker } from '../../services/tickerService.js';
import type { Market } from '@algotick/shared';

const CONCURRENCY = 5;

/**
 * 모든 시드 종목의 quote+candles+financials+news를 백그라운드로 페치.
 * 호출자: 서버 startup, daily cron.
 * 시드 종목 100+개 × 종목당 2-5초 → p-limit 5로 보호.
 */
export async function warmUpSeed(): Promise<{ symbols: number; updated: number; errors: number }> {
  const prisma = getPrisma();
  const tickers = await prisma.ticker.findMany({ select: { symbol: true, market: true } });
  const limit = pLimit(CONCURRENCY);
  let updated = 0;
  let errors = 0;
  await Promise.all(tickers.map((t) => limit(async () => {
    try {
      const adapter = getAdapter(t.market as Market);
      await refreshTicker(t.symbol, adapter, t.market as Market);
      updated++;
    } catch {
      errors++;
    }
  })));
  return { symbols: tickers.length, updated, errors };
}
