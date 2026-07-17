// ============================================================
// AI Relay — Runtime Capabilities
// ============================================================

export interface RuntimeCapabilities {
  runtime: 'vercel' | 'cloudflare' | 'local' | 'server';
  persistentProcess: boolean;
  publicEndpoint: boolean;
  localAgentSetup: boolean;
  storage: 'kv' | 'd1' | 'sqlite' | 'postgres';
}

export function detectRuntime(): RuntimeCapabilities {
  if (process.env.VERCEL) {
    return {
      runtime: 'vercel',
      persistentProcess: false,
      publicEndpoint: true,
      localAgentSetup: false,
      storage: 'kv',
    };
  }

  if (process.env.CF_PAGES) {
    return {
      runtime: 'cloudflare',
      persistentProcess: false,
      publicEndpoint: true,
      localAgentSetup: false,
      storage: 'd1',
    };
  }

  // Assume local if running via CLI
  return {
    runtime: 'local',
    persistentProcess: true,
    publicEndpoint: false,
    localAgentSetup: true,
    storage: 'sqlite',
  };
}
