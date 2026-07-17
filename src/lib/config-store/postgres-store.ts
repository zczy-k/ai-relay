// ============================================================
// AI Relay — Postgres Config Store (for VPS deployment)
// ============================================================

import type { ConfigStore, ModelAliasConfig } from './types';
import type { ProviderConfig } from '../providers/types';
import type { PriorityRule } from '../admin/priority-rules-core';

export class PostgresConfigStore implements ConfigStore {
  private connectionString: string;

  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.DATABASE_URL || '';
  }

  async getProviders(): Promise<Record<string, ProviderConfig>> {
    // TODO: SELECT * FROM providers
    throw new Error('PostgresConfigStore not implemented');
  }

  async getProviderKeys(provider: string): Promise<string[] | null> {
    // TODO: SELECT keys FROM provider_keys WHERE provider = ?
    return null;
  }

  async getModelAliases(): Promise<ModelAliasConfig> {
    // TODO: SELECT * FROM model_aliases
    return { aliases: {}, hidden: [] };
  }

  async getPriorityRules(): Promise<PriorityRule[]> {
    // TODO: SELECT * FROM priority_rules
    return [];
  }

  async getFallbackChain(provider: string, staticFallbacks?: string[] | string): Promise<string[]> {
    // TODO: SELECT fallback_chain FROM providers WHERE name = ?
    if (!staticFallbacks) return [];
    return Array.isArray(staticFallbacks) ? staticFallbacks : [staticFallbacks];
  }

  async getConfigVersion(): Promise<number> {
    // TODO: SELECT version FROM config_metadata
    return Date.now();
  }
}
