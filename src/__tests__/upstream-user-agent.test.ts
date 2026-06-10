// ============================================================
// Upstream User-Agent sanitization
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveUpstreamUserAgent, buildHeaders } from '@/lib/relay/transform';

// Neutral defaults must never reveal the relay (no "ai-relay", "relay", "proxy").
const RELAY_IDENTIFIERS = /ai-relay|relay|proxy/i;

describe('resolveUpstreamUserAgent', () => {
  const originalOverride = process.env.RELAY_DEFAULT_USER_AGENT;

  beforeEach(() => {
    delete process.env.RELAY_DEFAULT_USER_AGENT;
  });

  afterEach(() => {
    if (originalOverride === undefined) {
      delete process.env.RELAY_DEFAULT_USER_AGENT;
    } else {
      process.env.RELAY_DEFAULT_USER_AGENT = originalOverride;
    }
  });

  it('forwards a legitimate client UA unchanged', () => {
    expect(resolveUpstreamUserAgent('claude-cli/1.2.3 (external)', 'anthropic')).toBe(
      'claude-cli/1.2.3 (external)'
    );
  });

  it('forwards a browser-like UA unchanged', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    expect(resolveUpstreamUserAgent(ua, 'openai')).toBe(ua);
  });

  it('replaces python-requests UA with a neutral default', () => {
    const resolved = resolveUpstreamUserAgent('python-requests/2.32.5', 'openai');
    expect(resolved).not.toContain('python-requests');
    expect(resolved).not.toMatch(RELAY_IDENTIFIERS);
  });

  it('replaces curl UA with a neutral default', () => {
    const resolved = resolveUpstreamUserAgent('curl/8.4.0', 'openai');
    expect(resolved).not.toMatch(RELAY_IDENTIFIERS);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('matches blocked patterns case-insensitively', () => {
    const resolved = resolveUpstreamUserAgent('Python-Requests/2.32.5', 'openai');
    expect(resolved).not.toContain('Python-Requests');
    expect(resolved).not.toMatch(RELAY_IDENTIFIERS);
  });

  it('replaces a missing UA with a neutral default', () => {
    const resolved = resolveUpstreamUserAgent(undefined, 'openai');
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).not.toMatch(RELAY_IDENTIFIERS);
  });

  it('replaces an empty/whitespace UA with a neutral default', () => {
    const resolved = resolveUpstreamUserAgent('   ', 'openai');
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).not.toMatch(RELAY_IDENTIFIERS);
  });

  it('uses a format-appropriate default per upstream', () => {
    const openai = resolveUpstreamUserAgent(undefined, 'openai');
    const anthropic = resolveUpstreamUserAgent(undefined, 'anthropic');
    expect(openai).not.toBe(anthropic);
    expect(openai).toMatch(/openai/i);
    expect(anthropic).toMatch(/anthropic/i);
  });

  it('honors RELAY_DEFAULT_USER_AGENT override for blocked UAs', () => {
    process.env.RELAY_DEFAULT_USER_AGENT = 'custom-client/9.9';
    expect(resolveUpstreamUserAgent('python-requests/2.32.5', 'openai')).toBe(
      'custom-client/9.9'
    );
  });

  it('does not let the override affect legitimate client UAs', () => {
    process.env.RELAY_DEFAULT_USER_AGENT = 'custom-client/9.9';
    expect(resolveUpstreamUserAgent('claude-cli/1.0', 'anthropic')).toBe('claude-cli/1.0');
  });
});

describe('buildHeaders User-Agent integration', () => {
  it('always sets a neutral User-Agent header when client UA is absent', () => {
    const headers = buildHeaders('openai', 'sk-test', false, undefined);
    expect(headers['User-Agent']).toBeTruthy();
    expect(headers['User-Agent']).not.toMatch(RELAY_IDENTIFIERS);
  });

  it('sanitizes a blocked client UA in the built headers', () => {
    const headers = buildHeaders('anthropic', 'sk-test', true, 'python-requests/2.32.5');
    expect(headers['User-Agent']).not.toContain('python-requests');
    expect(headers['User-Agent']).not.toMatch(RELAY_IDENTIFIERS);
  });

  it('forwards a legitimate client UA through buildHeaders', () => {
    const headers = buildHeaders('openai', 'sk-test', false, 'claude-cli/1.2.3');
    expect(headers['User-Agent']).toBe('claude-cli/1.2.3');
  });
});
