import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchTickers } from '../services/searchService.js';

const QuerySchema = z.object({
  q: z.string().min(1, 'query is required'),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export async function registerSearchRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/search', async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'invalid query', details: parsed.error.flatten() } };
    }
    const results = await searchTickers(parsed.data.q, parsed.data.limit);
    return { results };
  });
}
