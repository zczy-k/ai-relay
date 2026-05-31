// ============================================================
// AI API Relay — Storage Factory
// ============================================================
// Returns the correct UsageStorage implementation based on
// the current runtime environment (Vercel KV vs CF D1).

import { KVUsageStorage } from './storage/kv-storage';
import { D1UsageStorage } from './storage/d1-usage-storage';
import type { UsageStorage } from './sdk';
import { getCFEnv } from '@/lib/cf-env';

export async function createUsageStorage(): Promise<UsageStorage> {
  const cfEnv = await getCFEnv();
  if (cfEnv?.DB) {
    return new D1UsageStorage(cfEnv.DB);
  }
  return new KVUsageStorage();
}
