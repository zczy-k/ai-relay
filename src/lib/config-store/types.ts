// ============================================================
// AI API Relay — Config Store Interface
// ============================================================

import type { ProviderConfig } from '../providers/types';
import type { PriorityRule } from '../admin/priority-rules-core';

export interface ModelAliasConfig {
  aliases: Record<string, string>;
  hidden: string[];
}

export interface ConfigStore {
  getProviders(): Promise<Record<string, ProviderConfig>>;
  getProviderKeys(provider: string): Promise<string[] | null>;
  getModelAliases(): Promise<ModelAliasConfig>;
  getPriorityRules(): Promise<PriorityRule[]>;
  getFallbackChain(provider: string, staticFallbacks?: string[] | string): Promise<string[]>;
  getConfigVersion(): Promise<number>;
}

export interface ConfigSnapshot {
  version: number;
  generatedAt: string;
  providers: Record<string, ProviderConfig>;
  providerKeys: Record<string, string[]>;
  modelAliases: ModelAliasConfig;
  priorityRules: PriorityRule[];
  fallbackChains: Record<string, string[]>;
}
