import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DART_API_KEY: z.string().optional(),
  SEC_USER_AGENT: z.string().min(5),
  FINNHUB_API_KEY: z.string().optional(),
  POLLING_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  WARM_UP_ON_START: z.coerce.boolean().default(true),
  YAHOO_CONCURRENCY: z.coerce.number().int().positive().default(2),
  NAVER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  SEC_CONCURRENCY: z.coerce.number().int().positive().default(1),
});

export type AppConfig = {
  databaseUrl: string;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dartApiKey?: string;
  secUserAgent: string;
  finnhubApiKey?: string;
  pollingIntervalMs: number;
  warmUpOnStart: boolean;
  yahooConcurrency: number;
  naverConcurrency: number;
  secConcurrency: number;
};

export function loadConfig(): AppConfig {
  const parsed = ConfigSchema.parse(process.env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    dartApiKey: parsed.DART_API_KEY,
    secUserAgent: parsed.SEC_USER_AGENT,
    finnhubApiKey: parsed.FINNHUB_API_KEY,
    pollingIntervalMs: parsed.POLLING_INTERVAL_MS,
    warmUpOnStart: parsed.WARM_UP_ON_START,
    yahooConcurrency: parsed.YAHOO_CONCURRENCY,
    naverConcurrency: parsed.NAVER_CONCURRENCY,
    secConcurrency: parsed.SEC_CONCURRENCY,
  };
}
