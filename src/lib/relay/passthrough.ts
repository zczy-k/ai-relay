// ============================================================
// AI API Relay — Header Passthrough
//
// Collects client headers for forwarding to upstream providers.
// Uses a blocklist approach to filter out sensitive/conflicting headers.
// ============================================================

/**
 * Headers that should NOT be forwarded to upstream providers.
 *
 * Categories:
 * - Authentication: authorization, x-api-key, api-key (we set these with provider keys)
 * - Connection/Transport: host, content-length, connection, transfer-encoding, etc.
 * - PII/Privacy: cookie, x-forwarded-for, x-real-ip, forwarded (client IP/tracking)
 * - Proxy: proxy-authorization, te, trailer, upgrade
 */
const BLOCKED_PASSTHROUGH_HEADERS = new Set([
  // Authentication - we set these ourselves with provider keys
  'authorization',
  'x-api-key',
  'api-key',

  // Connection and transport headers - managed by fetch API
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',

  // PII and privacy - should not leak client identity/location to upstream
  'cookie',
  'set-cookie',
  'x-forwarded-for',
  'x-real-ip',
  'forwarded',
  'x-forwarded-host',
  'x-forwarded-proto',

  // Proxy authentication
  'proxy-authorization',
  'proxy-authenticate',
]);

/**
 * Collect client-supplied headers worth forwarding to upstream providers.
 *
 * This includes:
 * - Anthropic-specific headers (anthropic-beta, anthropic-version, anthropic-dangerous-direct-browser-access)
 * - Client identification headers (x-app, x-claude-code-session-id, user-agent)
 * - SDK tracking headers (x-stainless-*, openai-*, etc.)
 * - Any other non-sensitive headers
 *
 * Headers in BLOCKED_PASSTHROUGH_HEADERS are filtered out for security:
 * - Authentication headers (we use provider keys instead)
 * - PII/privacy headers (cookie, x-forwarded-for, x-real-ip)
 * - Connection headers (managed by fetch API)
 *
 * @param headers - Request headers object (NextRequest.headers or Headers API)
 * @returns Record of headers safe to forward upstream
 */
export function collectPassthroughHeaders(
  headers: Headers | { forEach: (callback: (value: string, key: string) => void) => void }
): Record<string, string> {
  const out: Record<string, string> = {};

  // Iterate through all request headers
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    // Skip blocked headers
    if (BLOCKED_PASSTHROUGH_HEADERS.has(lowerKey)) {
      return;
    }

    // Forward all other headers
    out[key] = value;
  });

  return out;
}
