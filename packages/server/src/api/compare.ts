import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { compareTickers } from '../services/compareService.js';

const QuerySchema = z.object({ s: z.string().min(1) });

export async function registerCompareRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/compare', async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'query "s" required (comma-separated symbols)' } };
    }
    const symbols = parsed.data.s.split(',').map((x) => x.trim()).filter(Boolean);
    if (symbols.length === 0 || symbols.length > 3) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'must provide 1~3 symbols' } };
    }
    const result = await compareTickers(symbols);
    return result;
  });
}
