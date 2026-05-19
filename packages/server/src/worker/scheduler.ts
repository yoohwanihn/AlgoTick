import cron, { type ScheduledTask } from 'node-cron';
import { pollActive } from './jobs/pollActive.js';
import { warmUp } from './jobs/warmUp.js';
import { refreshMarket } from './jobs/refreshMarket.js';
import { loadConfig } from '../config.js';

let pollTask: ScheduledTask | undefined;
let marketTask: ScheduledTask | undefined;

export async function startWorker(): Promise<void> {
  const cfg = loadConfig();
  if (cfg.warmUpOnStart) {
    await warmUp().catch((e) => console.error('warm-up failed:', e));
    await refreshMarket().catch((e) => console.error('market warm-up failed:', e));
  }
  pollTask = cron.schedule('* * * * *', () => {
    pollActive().catch((e) => console.error('pollActive failed:', e));
  });
  pollTask.start();

  marketTask = cron.schedule('*/5 * * * *', () => {
    refreshMarket().catch((e) => console.error('refreshMarket failed:', e));
  });
  marketTask.start();
}

export function stopWorker(): void {
  pollTask?.stop(); pollTask = undefined;
  marketTask?.stop(); marketTask = undefined;
}
