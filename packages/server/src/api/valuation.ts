import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { calculateValuation, ValuationUnavailableError } from '../services/valuationService.js';

const InputSchema = z.object({
  rf: z.number().optional(),
  erp: z.number().optional(),
  beta: z.number().optional(),
  taxRate: z.number().optional(),
  terminalGrowth: z.number().optional(),
  forecastYears: z.number().int().min(3).max(15).optional(),
  fcfBaseOverride: z.number().optional(),
  scenarios: z.object({
    bull: z.object({ growthHigh: z.number(), prob: z.number().min(0).max(1) }),
    base: z.object({ growthHigh: z.number(), prob: z.number().min(0).max(1) }),
    bear: z.object({ growthHigh: z.number(), prob: z.number().min(0).max(1) }),
  }).optional(),
});

export async function registerValuationRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { symbol: string } }>('/api/valuation/:symbol', async (req, reply) => {
    const parsed = InputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'BAD_REQUEST', message: 'invalid inputs', details: parsed.error.flatten() } };
    }
    try {
      const result = await calculateValuation(req.params.symbol, parsed.data);
      return result;
    } catch (e) {
      if (e instanceof ValuationUnavailableError) {
        reply.code(503);
        return { error: { code: 'VALUATION_UNAVAILABLE', reason: e.reason, message: e.message } };
      }
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: (e as Error).message } };
    }
  });
}
