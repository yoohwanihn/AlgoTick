import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { getAdapter } from '../adapters/router.js';
import { getTickerDetail } from '../services/tickerService.js';

const AddSchema = z.object({ symbol: z.string().min(1), memo: z.string().optional() });

export async function registerWatchlistRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/watchlist - 관심종목 리스트 + 각 종목의 최신 quote
  app.get('/api/watchlist', async () => {
    const prisma = getPrisma();
    const rows = await prisma.watchlist.findMany({
      orderBy: [{ position: 'asc' }, { addedAt: 'desc' }],
      include: { ticker: true },
    });
    // 최신 시세 함께 조회
    const symbols = rows.map((r) => r.symbol);
    const quotes = await prisma.quoteIntraday.findMany({
      where: { symbol: { in: symbols } },
      orderBy: { ts: 'desc' },
    });
    const latestBySymbol = new Map<string, typeof quotes[number]>();
    for (const q of quotes) if (!latestBySymbol.has(q.symbol)) latestBySymbol.set(q.symbol, q);

    return {
      items: rows.map((r) => {
        const q = latestBySymbol.get(r.symbol);
        return {
          symbol: r.symbol,
          memo: r.memo,
          addedAt: r.addedAt.toISOString(),
          position: r.position,
          name: r.ticker.nameKo ?? r.ticker.nameEn ?? r.symbol,
          market: r.ticker.market,
          exchange: r.ticker.exchange,
          currency: r.ticker.currency,
          quote: q ? {
            price: Number(q.price),
            changePct: Number(q.changePct),
            volume: Number(q.volume),
            ts: q.ts.toISOString(),
          } : null,
        };
      }),
    };
  });

  // POST /api/watchlist - 추가
  app.post('/api/watchlist', async (req, reply) => {
    const parsed = AddSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'invalid body', details: parsed.error.flatten() } };
    }
    const prisma = getPrisma();
    const master = await prisma.ticker.findUnique({ where: { symbol: parsed.data.symbol } });
    if (!master) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: `Ticker ${parsed.data.symbol} not found` } };
    }
    // 마지막 position 다음으로 추가
    const last = await prisma.watchlist.findFirst({ orderBy: { position: 'desc' } });
    const item = await prisma.watchlist.upsert({
      where: { symbol: parsed.data.symbol },
      update: { memo: parsed.data.memo },
      create: { symbol: parsed.data.symbol, memo: parsed.data.memo, position: (last?.position ?? 0) + 1 },
    });
    // 추가 직후 데이터 페치 트리거 (best-effort)
    void getTickerDetail(parsed.data.symbol, getAdapter(master.market as 'US' | 'KR' | 'JP')).catch(() => undefined);
    return { ok: true, item };
  });

  // DELETE /api/watchlist/:symbol
  app.delete<{ Params: { symbol: string } }>('/api/watchlist/:symbol', async (req, reply) => {
    const prisma = getPrisma();
    try {
      await prisma.watchlist.delete({ where: { symbol: req.params.symbol } });
      return { ok: true };
    } catch (_e) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: `Not in watchlist: ${req.params.symbol}` } };
    }
  });

  // GET /api/watchlist/has/:symbol
  app.get<{ Params: { symbol: string } }>('/api/watchlist/has/:symbol', async (req) => {
    const prisma = getPrisma();
    const exists = await prisma.watchlist.findUnique({ where: { symbol: req.params.symbol } });
    return { exists: !!exists };
  });
}
