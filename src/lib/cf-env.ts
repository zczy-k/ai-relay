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

export async function getCFEnv(): Promise<CFEnv | null> {
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true });
    if (context && context.env) {
      return context.env as unknown as CFEnv;
    }
  } catch {}
  return null;
}

export async function isCloudflare(): Promise<boolean> {
  return (await getCFEnv()) !== null;
}

