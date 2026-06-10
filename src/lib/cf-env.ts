// ============================================================
// AI API Relay — CF Bindings Helper
// ============================================================
// Provides access to Cloudflare KV and D1 bindings when running
// on Cloudflare Pages. Returns null outside CF environment.
//
// Uses getCloudflareContext() from @opennextjs/cloudflare so that
// bindings are always request-scoped — no module-level state, no
// race conditions between concurrent requests.
//
// require() is used intentionally (not import) to keep this module
// invisible to TypeScript's global type resolution — a static import
// of @opennextjs/cloudflare would pull in @cloudflare/workers-types
// globally and override DOM types like Response.json() → unknown.

export interface CFEnv {
  KV: import('@cloudflare/workers-types').KVNamespace;
  DB: import('@cloudflare/workers-types').D1Database;
}

function shouldSkipCloudflareContext(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_ENV ||
    !!process.env.VERCEL_URL
  );
}

export function getCFEnvSync(): CFEnv | null {
  if (shouldSkipCloudflareContext()) {
    return null;
  }

  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const context = getCloudflareContext();
    if (context && context.env) {
      return context.env as unknown as CFEnv;
    }
  } catch {}
  return null;
}

export async function getCFEnv(): Promise<CFEnv | null> {
  const syncEnv = getCFEnvSync();
  if (syncEnv) return syncEnv;

  if (shouldSkipCloudflareContext()) {
    return null;
  }

  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true });
    if (context && context.env) {
      return context.env as unknown as CFEnv;
    }
  } catch {}
  return null;
}

export function isCloudflareSync(): boolean {
  return getCFEnvSync() !== null;
}

export async function isCloudflare(): Promise<boolean> {
  return (await getCFEnv()) !== null;
}
