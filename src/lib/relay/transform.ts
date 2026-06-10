// ============================================================
// AI API Relay — Request Transformation
// ============================================================

import type { ChatCompletionRequest } from '../types';

/**
 * Transform OpenAI-format request to Anthropic format.
 */
export function transformToAnthropic(body: ChatCompletionRequest): Record<string, unknown> {
  const { messages, model, max_tokens, temperature, top_p, stream, stop } = body;

  // Extract system message
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

  const anthropicBody: Record<string, unknown> = {
    model,
    max_tokens: max_tokens || 4096,
    messages: nonSystemMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    })),
  };

  if (systemMsg?.content) {
    anthropicBody.system = systemMsg.content;
  }
  if (temperature !== undefined) anthropicBody.temperature = temperature;
  if (top_p !== undefined) anthropicBody.top_p = top_p;
  if (stream !== undefined) anthropicBody.stream = stream;
  if (stop) anthropicBody.stop_sequences = Array.isArray(stop) ? stop : [stop];

  return anthropicBody;
}

/**
 * Neutral default User-Agents by upstream header format, used when the client
 * UA is missing or a blocked script UA. These present as ordinary SDK clients
 * that upstreams expect, and intentionally do NOT reveal that the request
 * passed through a relay. Override any of them with RELAY_DEFAULT_USER_AGENT.
 */
const DEFAULT_USER_AGENTS: Record<'openai' | 'anthropic' | 'azure', string> = {
  openai: 'openai-python/2.40.0',
  azure: 'openai-python/2.40.0',
  anthropic: 'anthropic-sdk-python/0.105.2',
};

/**
 * Lowercased prefixes/substrings of generic scripting-client User-Agents that
 * some upstream providers reject outright. These carry no useful identity, so
 * we replace them with a neutral default UA rather than forwarding them.
 */
const BLOCKED_USER_AGENT_PATTERNS = [
  'python-requests',
  'python-httpx',
  'python-urllib',
  'aiohttp',
  'go-http-client',
  'curl/',
  'wget/',
  'okhttp',
  'node-fetch',
  'axios/',
  'undici',
  'java/',
  'libwww-perl',
];

/**
 * Decide which User-Agent to present to the upstream provider.
 *
 * A legitimate client UA (e.g. `claude-cli/1.2.3`) is forwarded unchanged so
 * the upstream sees the real caller. A missing UA, or one belonging to a
 * generic scripting library known to be blocked, is replaced with a neutral
 * SDK UA matching the upstream format — never anything that identifies the
 * relay — so the request is accepted without leaking relay identity.
 */
export function resolveUpstreamUserAgent(
  clientUserAgent: string | undefined,
  headerFormat: 'openai' | 'anthropic' | 'azure'
): string {
  const ua = clientUserAgent?.trim();
  if (ua && !isBlockedUserAgent(ua)) return ua;
  return defaultUserAgent(headerFormat);
}

function isBlockedUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BLOCKED_USER_AGENT_PATTERNS.some(p => lower.includes(p));
}

function defaultUserAgent(headerFormat: 'openai' | 'anthropic' | 'azure'): string {
  return process.env.RELAY_DEFAULT_USER_AGENT?.trim() || DEFAULT_USER_AGENTS[headerFormat];
}

/**
 * Build upstream request headers based on provider format.
 */
export function buildHeaders(
  headerFormat: 'openai' | 'anthropic' | 'azure',
  apiKey: string,
  isStream: boolean,
  userAgent?: string,
  customUserAgent?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (headerFormat === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (headerFormat === 'azure') {
    headers['api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (isStream) {
    headers['Accept'] = 'text/event-stream';
  }

  // Priority: custom provider UA > client UA > default SDK UA
  headers['User-Agent'] = customUserAgent || resolveUpstreamUserAgent(userAgent, headerFormat);

  return headers;
}
