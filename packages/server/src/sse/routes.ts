import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { registerClient, removeClient, subscribe, unsubscribe } from './hub.js';

export async function registerSseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sse', (req, reply) => {
    const id = randomUUID();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ id })}\n\n`);
    registerClient(id, reply);
    const keepAlive = setInterval(() => {
      try { reply.raw.write(': keep-alive\n\n'); } catch { /* */ }
    }, 30_000);
    req.raw.on('close', () => { clearInterval(keepAlive); removeClient(id); });
  });

  app.post<{ Body: { clientId: string; symbols: string[] } }>('/sse/subscribe', async (req) => {
    subscribe(req.body.clientId, req.body.symbols);
    return { ok: true };
  });

  app.post<{ Body: { clientId: string; symbols: string[] } }>('/sse/unsubscribe', async (req) => {
    unsubscribe(req.body.clientId, req.body.symbols);
    return { ok: true };
  });
}
