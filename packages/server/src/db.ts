import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const cfg = loadConfig();
    prisma = new PrismaClient({
      log: cfg.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
      datasources: { db: { url: cfg.databaseUrl } },
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
