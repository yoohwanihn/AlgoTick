import cron, { type ScheduledTask } from 'node-cron';
import { pollActive } from './jobs/pollActive.js';
import { warmUp } from './jobs/warmUp.js';
import { warmUpSeed } from './jobs/warmUpSeed.js';
import { refreshMarket } from './jobs/refreshMarket.js';
import { loadConfig } from '../config.js';

let pollTask: ScheduledTask | undefined;
let marketTask: ScheduledTask | undefined;
let seedTask: ScheduledTask | undefined;

export async function startWorker(): Promise<void> {
  const cfg = loadConfig();
  if (cfg.warmUpOnStart) {
    await warmUp().catch((e) => console.error('warm-up failed:', e));
    await refreshMarket().catch((e) => console.error('market warm-up failed:', e));
    // 시드 전체 페치는 시간이 오래 걸리므로 백그라운드로 fan-out
    void warmUpSeed()
      .then((r) => console.log(`warmUpSeed: ${r.updated}/${r.symbols} updated (${r.errors} errors)`))
      .catch((e) => console.error('warmUpSeed failed:', e));
  }
  pollTask = cron.schedule('* * * * *', () => {
    pollActive().catch((e) => console.error('pollActive failed:', e));
  });
  pollTask.start();

  marketTask = cron.schedule('*/5 * * * *', () => {
    refreshMarket().catch((e) => console.error('refreshMarket failed:', e));
  });
  marketTask.start();

  // 매일 KST 05:00 (UTC 20:00) 시드 전체 새로고침 — 미국장 마감 후
  seedTask = cron.schedule('0 20 * * *', () => {
    warmUpSeed()
      .then((r) => console.log(`[daily] warmUpSeed: ${r.updated}/${r.symbols} updated (${r.errors} errors)`))
      .catch((e) => console.error('daily warmUpSeed failed:', e));
  });
  seedTask.start();
}

export function stopWorker(): void {
  pollTask?.stop(); pollTask = undefined;
  marketTask?.stop(); marketTask = undefined;
  seedTask?.stop(); seedTask = undefined;
}
