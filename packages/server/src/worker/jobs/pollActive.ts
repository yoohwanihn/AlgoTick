import { getPrisma } from '../../db.js';
import { UsYahooAdapter } from '../../adapters/us-yahoo.js';
import { broadcast, activeSymbols } from '../../sse/hub.js';
import { validateQuote, hasErrors, pickWarnings } from '../../validators/index.js';

const usYahoo = new UsYahooAdapter();

export async function pollActive(): Promise<{ symbols: string[]; updated: number }> {
  const envList = (process.env.WATCHLIST_SYMBOLS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const sseSubs = Array.from(activeSymbols());
  const targets = Array.from(new Set([...envList, ...sseSubs]));
  if (targets.length === 0) return { symbols: [], updated: 0 };

  const prisma = getPrisma();
  let updated = 0;
  for (const symbol of targets) {
    const master = await prisma.ticker.findUnique({ where: { symbol } });
    if (!master || master.market !== 'US') continue;
    try {
      const q = await usYahoo.getQuote(symbol);
      const results = validateQuote(q, { symbol, market: 'US' });
      if (hasErrors(results)) continue;
      const warnings = pickWarnings(results);
      await prisma.$transaction([
        prisma.quoteIntraday.upsert({
          where: { symbol_ts: { symbol, ts: q.ts } },
          update: { price: q.price, volume: BigInt(q.volume), changePct: q.changePct, source: q.source },
          create: { symbol, ts: q.ts, price: q.price, volume: BigInt(q.volume), changePct: q.changePct, source: q.source },
        }),
        prisma.ingestionLog.upsert({
          where: { symbol_kind: { symbol, kind: 'quote' } },
          update: { lastFetchedAt: new Date() },
          create: { symbol, kind: 'quote', lastFetchedAt: new Date() },
        }),
      ]);
      broadcast(symbol, 'quote-tick', {
        symbol, price: q.price, volume: q.volume, changePct: q.changePct, ts: q.ts.toISOString(), warnings,
      });
      updated++;
    } catch (_e) {
      // continue with next symbol
    }
  }
  return { symbols: targets, updated };
}
