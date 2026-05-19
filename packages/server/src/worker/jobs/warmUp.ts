import { pollActive } from './pollActive.js';

export async function warmUp(): Promise<void> {
  await pollActive();
}
