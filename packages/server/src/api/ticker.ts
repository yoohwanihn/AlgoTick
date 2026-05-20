import type { FastifyInstance } from 'fastify';
import { getAdapter } from '../adapters/router.js';
import { getTickerDetail } from '../services/tickerService.js';
import { getPrisma } from '../db.js';

export async function registerTickerRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { symbol: string } }>('/api/ticker/:symbol', async (req, reply) => {
    const { symbol } = req.params;
    const master = await getPrisma().ticker.findUnique({ where: { symbol } });
    if (!master) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: `Ticker ${symbol} not found` } };
    }
    try {
      const adapter = getAdapter(master.market as 'US' | 'KR' | 'JP');
      const result = await getTickerDetail(symbol, adapter);
      return result;
    } catch (e) {
      req.log.error({ err: e }, 'ticker detail failed');
      reply.code(502);
      return { error: { code: 'UPSTREAM_FAILED', message: 'Failed to fetch ticker data' } };
    }
  });
}
