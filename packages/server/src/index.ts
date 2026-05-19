import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadConfig } from './config.js';
import { getPrisma, disconnectPrisma } from './db.js';
import { registerHealthRoute } from './api/health.js';
import { registerSearchRoute } from './api/search.js';
import { registerTickerRoute } from './api/ticker.js';
import { registerWatchlistRoutes } from './api/watchlist.js';
import { registerErrorHandlers } from './errors.js';
import { registerSseRoutes } from './sse/routes.js';
import { startWorker, stopWorker } from './worker/index.js';

async function buildApp() {
  const cfg = loadConfig();
  const app = Fastify({
    logger: {
      level: cfg.logLevel,
      transport: cfg.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  await app.register(sensible);
  await app.register(cors, { origin: true });

  await registerErrorHandlers(app);

  await registerHealthRoute(app);
  await registerSearchRoute(app);
  await registerTickerRoute(app);
  await registerWatchlistRoutes(app);
  await registerSseRoutes(app);

  return app;
}

async function start() {
  const cfg = loadConfig();
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    stopWorker();
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: cfg.port, host: '0.0.0.0' });
    app.log.info(`AlgoTick server listening on port ${cfg.port}`);
    await startWorker();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  void start();
}

export { buildApp };
