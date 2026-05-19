import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { getPortfolio } from '../services/portfolioService.js';

const AddLotSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  qty: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
  tradedAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

export async function registerPortfolioRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/portfolio', async () => getPortfolio());

  app.get('/api/portfolio/lots', async () => {
    const prisma = getPrisma();
    const rows = await prisma.portfolioLot.findMany({
      orderBy: { tradedAt: 'desc' },
      include: { ticker: true },
    });
    return {
      lots: rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.ticker.nameEn ?? r.ticker.nameKo ?? r.symbol,
        side: r.side,
        qty: Number(r.qty),
        price: Number(r.price),
        tradedAt: r.tradedAt.toISOString(),
        note: r.note,
      })),
    };
  });

  app.post('/api/portfolio/lots', async (req, reply) => {
    const parsed = AddLotSchema.safeParse(req.body);
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
    const lot = await prisma.portfolioLot.create({
      data: {
        symbol: parsed.data.symbol,
        side: parsed.data.side,
        qty: parsed.data.qty,
        price: parsed.data.price,
        tradedAt: parsed.data.tradedAt ? new Date(parsed.data.tradedAt) : new Date(),
        note: parsed.data.note,
      },
    });
    return { ok: true, id: lot.id };
  });

  app.delete<{ Params: { id: string } }>('/api/portfolio/lots/:id', async (req, reply) => {
    const prisma = getPrisma();
    try {
      await prisma.portfolioLot.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch (_e) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: 'Lot not found' } };
    }
  });
}
