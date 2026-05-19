import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});
afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('loadConfig', () => {
  it('loads valid config from env', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'info';
    process.env.SEC_USER_AGENT = 'AlgoTick test@example.com';
    process.env.POLLING_INTERVAL_MS = '60000';
    process.env.WARM_UP_ON_START = 'true';
    process.env.YAHOO_CONCURRENCY = '2';
    process.env.NAVER_CONCURRENCY = '3';
    process.env.SEC_CONCURRENCY = '1';

    const { loadConfig } = await import('../src/config');
    const cfg = loadConfig();
    expect(cfg.port).toBe(4000);
    expect(cfg.pollingIntervalMs).toBe(60000);
    expect(cfg.warmUpOnStart).toBe(true);
  });

  it('throws when DATABASE_URL missing', async () => {
    delete process.env.DATABASE_URL;
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('throws when PORT is not a number', async () => {
    process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';
    process.env.PORT = 'abc';
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow();
  });
});
