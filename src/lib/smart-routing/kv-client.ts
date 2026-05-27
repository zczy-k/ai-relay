// ============================================================
// AI API Relay — KV Client (shared by smart routing modules)
// ============================================================
// Thin wrapper to share the KV connection across smart-routing modules.
// Falls back gracefully if KV is not configured.

let _kv: any = null;

export async function getKV(): Promise<any> {
  if (_kv) return _kv;

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const mod = await import('@vercel/kv');
      _kv = mod.kv || mod.createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      return _kv;
    } catch {
      return null;
    }
  }

  return null;
}
