// ============================================================
// AI API Relay — Vercel KV Config Store
// ============================================================

import type { ConfigStore, ModelAliasConfig } from './types';
import type { ProviderConfig } from '../providers/types';
import type { PriorityRule } from '../admin/priority-rules-core';
import {
  getCustomProviders,
  getManagedKeys,
  getModelAliasConfig,
  getPriorityRules as getAdminPriorityRules,
  getFallbackChain as getAdminFallbackChain,
} from '../admin/admin-config';

export class VercelKVConfigStore implements ConfigStore {
  async getProviders(): Promise<Record<string, ProviderConfig>> {
    return await getCustomProviders();
  }

  async getProviderKeys(provider: string): Promise<string[] | null> {
    return await getManagedKeys(provider);
  }

  async getModelAliases(): Promise<ModelAliasConfig> {
    return await getModelAliasConfig();
  }

  async getPriorityRules(): Promise<PriorityRule[]> {
    return await getAdminPriorityRules();
  }

  async getFallbackChain(provider: string, staticFallbacks?: string[] | string): Promise<string[]> {
    return await getAdminFallbackChain(provider, staticFallbacks);
  }

  async getConfigVersion(): Promise<number> {
    return Date.now();
  }
}
