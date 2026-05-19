import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadConfig } from './config.js';
import { getPrisma, disconnectPrisma } from './db.js';

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

  // 라우트는 후속 task에서 등록
  return app;
}

async function start() {
  const cfg = loadConfig();
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: cfg.port, host: '0.0.0.0' });
    app.log.info(`AlgoTick server listening on port ${cfg.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();

export { buildApp };
