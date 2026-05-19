import type { FastifyInstance } from 'fastify';

export async function registerErrorHandlers(app: FastifyInstance): Promise<void> {
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    });
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const code = status === 500 ? 'INTERNAL_ERROR' : (err.code ?? 'ERROR');
    reply.code(status).send({
      error: { code, message: err.message ?? 'Internal server error' },
    });
  });
}
