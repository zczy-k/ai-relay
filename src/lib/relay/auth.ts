// ============================================================
// AI API Relay — Auth Validation
// ============================================================

function base64urlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64url');
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf8');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Get the signing secret for generating/validating temporary keys.
 */
function getSigningSecret(): string {
  const secret = process.env.RELAY_SIGNING_SECRET;
  if (secret) return secret;

  // Fallback to first admin key
  const adminKeys = (process.env.RELAY_ADMIN_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (adminKeys.length > 0) return adminKeys[0];

  // Fallback to first api key
  const apiKeys = (process.env.RELAY_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (apiKeys.length > 0) return apiKeys[0];

  return 'default-fallback-signing-secret-123456';
}

/**
 * Sign payload using HMAC-SHA256. Works in both Edge and Node.js.
 */
async function signPayload(payloadStr: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretData = encoder.encode(secret);
  const payloadData = encoder.encode(payloadStr);

  const key = await crypto.subtle.importKey(
    'raw',
    secretData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, payloadData);
  
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a cryptographically signed temporary request key.
 */
export async function generateTempKey(durationSeconds: number): Promise<{ key: string; expiresAt: string }> {
  const exp = Date.now() + durationSeconds * 1000;
  const payload = {
    exp,
    created: Date.now(),
  };
  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = base64urlEncode(payloadStr);
  const signature = await signPayload(payloadBase64, getSigningSecret());
  const key = `sk-relay-temp-${payloadBase64}.${signature}`;
  return {
    key,
    expiresAt: new Date(exp).toISOString(),
  };
}

/**
 * Validate a temporary request key.
 */
export async function validateTempKey(token: string): Promise<boolean> {
  try {
    const prefix = 'sk-relay-temp-';
    if (!token.startsWith(prefix)) return false;

    const parts = token.slice(prefix.length).split('.');
    if (parts.length !== 2) return false;

    const [payloadBase64, signature] = parts;
    const payloadStr = base64urlDecode(payloadBase64);
    const payload = JSON.parse(payloadStr);

    if (typeof payload.exp !== 'number') return false;
    if (Date.now() > payload.exp) {
      return false; // Expired
    }

    const expectedSignature = await signPayload(payloadBase64, getSigningSecret());
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Validate the relay API key from the Authorization header.
 * Returns true if valid, false otherwise.
 */
export async function validateAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const anthropicKeyHeader = request.headers.get('x-api-key');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || anthropicKeyHeader || '';
  if (!token) return false;

  if (token.startsWith('sk-relay-temp-')) {
    return await validateTempKey(token);
  }

  const validKeys = getRelayApiKeys();
  return validKeys.includes(token);
}

/**
 * Get all configured relay API keys.
 */
export function getRelayApiKeys(): string[] {
  return (process.env.RELAY_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Validate auth and return error response if invalid.
 * Returns null if auth is valid.
 */
export async function requireAuth(request: Request): Promise<Response | null> {
  if (!(await validateAuth(request))) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Invalid API key. Provide a valid key in the Authorization header.',
          type: 'authentication_error',
          code: 401,
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
