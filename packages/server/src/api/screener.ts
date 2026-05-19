import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { runScreener } from '../services/screenerService.js';

const CondSchema = z.object({
  field: z.enum(['per', 'pbr', 'roePct', 'price', 'changePct', 'marketCap', 'market']),
  op: z.enum(['<', '<=', '>', '>=', '==', '!=']),
  value: z.union([z.number(), z.string()]),
});

const RunBody = z.object({ conditions: z.array(CondSchema).max(20) });
const SaveBody = z.object({ name: z.string().min(1), conditions: z.array(CondSchema).max(20) });

export async function registerScreenerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/screener/run', async (req, reply) => {
    const parsed = RunBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'invalid', details: parsed.error.flatten() } };
    }
    const hits = await runScreener(parsed.data.conditions);
    return { hits, total: hits.length };
  });

  app.get('/api/screener/rules', async () => {
    const rules = await getPrisma().screenerRule.findMany({ orderBy: { createdAt: 'desc' } });
    return {
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        conditions: r.conditions,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post('/api/screener/rules', async (req, reply) => {
    const parsed = SaveBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'invalid', details: parsed.error.flatten() } };
    }
    const rule = await getPrisma().screenerRule.create({
      data: { name: parsed.data.name, conditions: parsed.data.conditions as object },
    });
    return { ok: true, id: rule.id };
  });

  app.delete<{ Params: { id: string } }>('/api/screener/rules/:id', async (req, reply) => {
    try {
      await getPrisma().screenerRule.delete({ where: { id: req.params.id } });
      return { ok: true };
    } catch (_e) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: 'Rule not found' } };
    }
  });
}
