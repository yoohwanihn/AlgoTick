import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pLimit from 'p-limit';
import { getPrisma } from '../../db.js';
import { getAdapter } from '../../adapters/router.js';
import { refreshTicker } from '../../services/tickerService.js';
import type { Market } from '@algotick/shared';

const CONCURRENCY = 5;

/**
 * 시드 파일(kr-top/us-top/jp-top)에 등록된 top-N 종목만 fan-out 페치.
 *
 * 전체 ticker 풀은 18K(검색·스크리너용)이지만 warmUp 대상은 ~125개로 좁힘:
 * - 시총 상위 (사용자가 자주 보는 종목)
 * - API rate limit 안전 (Finnhub 60req/min 보호)
 * - daily 완료 시간 짧음 (5-10분)
 *
 * watchlist/portfolio 종목은 pollActive(1분 cron)가 별도 처리.
 */
async function loadWarmUpTargets(): Promise<string[]> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataDir = join(__dirname, '..', '..', 'seed', 'data');
  const files = ['kr-top.json', 'us-top.json', 'jp-top.json'];
  const symbols = new Set<string>();
  for (const f of files) {
    try {
      const raw = await readFile(join(dataDir, f), 'utf-8');
      const arr = JSON.parse(raw) as Array<{ symbol: string }>;
      for (const t of arr) symbols.add(t.symbol);
    } catch { /* file missing — skip */ }
  }
  return Array.from(symbols);
}

export async function warmUpSeed(): Promise<{ symbols: number; updated: number; errors: number }> {
  const prisma = getPrisma();
  const targetSymbols = await loadWarmUpTargets();
  const tickers = await prisma.ticker.findMany({
    where: { symbol: { in: targetSymbols } },
    select: { symbol: true, market: true },
  });
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
