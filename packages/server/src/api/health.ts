import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    let db: 'connected' | 'disconnected' = 'disconnected';
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      db = 'connected';
    } catch {
      db = 'disconnected';
    }
    return { status: 'ok', db, ts: new Date().toISOString() };
  });
}
