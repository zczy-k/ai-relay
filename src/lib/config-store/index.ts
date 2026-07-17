// ============================================================
// AI API Relay — Config Store Factory
// ============================================================

import type { ConfigStore } from './types';
import { VercelKVConfigStore } from './vercel-kv-store';
import { PostgresConfigStore } from './postgres-store';

let _defaultStore: ConfigStore | null = null;

export function getDefaultConfigStore(): ConfigStore {
  if (!_defaultStore) {
    // VPS/Server: Postgres
    if (process.env.DATABASE_URL && !process.env.VERCEL && !process.env.CF_PAGES) {
      _defaultStore = new PostgresConfigStore();
    }
    // Cloud: Vercel KV / Cloudflare KV / dev mock
    else {
      _defaultStore = new VercelKVConfigStore();
    }
  }
  return _defaultStore;
}

export function setDefaultConfigStore(store: ConfigStore): void {
  _defaultStore = store;
}

export * from './types';
