import type { ValidationResult } from './schema/validation.js';

export type StaleFlag = 'fresh' | 'stale' | 'offline';

export interface CachedResponse<T> {
  data: T;
  freshness: StaleFlag;
  lastFetchedAt: string;
  warnings?: ValidationResult[];
}
