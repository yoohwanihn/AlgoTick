import cron, { type ScheduledTask } from 'node-cron';
import { pollActive } from './jobs/pollActive.js';
import { warmUp } from './jobs/warmUp.js';
import { loadConfig } from '../config.js';

let task: ScheduledTask | undefined;

export async function startWorker(): Promise<void> {
  const cfg = loadConfig();
  if (cfg.warmUpOnStart) {
    await warmUp().catch((e) => console.error('warm-up failed:', e));
  }
  task = cron.schedule('* * * * *', () => {
    pollActive().catch((e) => console.error('pollActive failed:', e));
  });
  task.start();
}

export function stopWorker(): void {
  task?.stop();
  task = undefined;
}
