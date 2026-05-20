import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listIndices, sectorHeatmap, topMovers, listMarketEvents, listMarketNews,
} from '../services/marketService.js';

const MarketQuery = z.object({ market: z.enum(['US', 'KR', 'JP', 'GLOBAL']).optional() });
const MoverQuery = MarketQuery.extend({
  direction: z.enum(['up', 'down', 'volume']).default('up'),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export async function registerMarketRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/market/indices', async (req) => {
    const parsed = MarketQuery.safeParse(req.query);
    const market = parsed.success ? parsed.data.market : undefined;
    return { items: await listIndices(market) };
  });

  app.get('/api/market/sectors', async (req) => {
    const parsed = MarketQuery.safeParse(req.query);
    const market = parsed.success ? parsed.data.market : undefined;
    return { items: await sectorHeatmap(market) };
  });

  app.get('/api/market/movers', async (req, reply) => {
    const parsed = MoverQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400); return { error: { code: 'BAD_REQUEST', message: 'invalid query' } };
    }
    return { items: await topMovers(parsed.data.direction, parsed.data.market, parsed.data.limit) };
  });

  app.get('/api/market/events', async (req) => {
    const parsed = MarketQuery.safeParse(req.query);
    const market = parsed.success ? parsed.data.market : undefined;
    return { items: await listMarketEvents(7, market) };
  });

  app.get('/api/market/news', async () => ({ items: await listMarketNews(30) }));
}
