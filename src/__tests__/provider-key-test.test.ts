import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ProviderConfig } from '@/lib/providers/types';

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/providers/newapi_root/keys/test', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer admin-test-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const provider: ProviderConfig = {
  name: 'newapi_root',
  displayName: 'NewAPI Root',
  baseUrl: 'https://example.com/v1',
  headerFormat: 'openai' as const,
  modelPrefixes: ['deepseek-'],
  envKeyField: 'NEWAPI_ROOT_KEYS',
  models: [{ id: 'deepseek-v4-pro', displayName: 'deepseek-v4-pro', contextWindow: 128000 }],
};

async function loadRoute(customProvider = provider) {
  vi.doMock('@/lib/providers', () => ({
    getAllProviders: vi.fn(async () => ({ newapi_root: customProvider })),
  }));
  return import('../app/api/admin/providers/[provider]/keys/test/route');
}

describe('admin provider key test', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RELAY_ADMIN_KEY', 'admin-test-key');
    vi.restoreAllMocks();
  });

  it('retries with a browser-compatible User-Agent when the default SDK User-Agent is blocked by HTML 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('<!doctype html><title>403 | Forbidden</title>', {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'pong' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadRoute();
    const res = await POST(req({ key: 'sk-test-key', model: 'deepseek-v4-pro' }), {
      params: Promise.resolve({ provider: 'newapi_root' }),
    });

    expect(await res.json()).toEqual({ valid: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ 'User-Agent': 'openai-python/2.40.0' }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('Chrome/148') }),
    }));
  });

  it('retries /v1/chat/completions when a bare provider base URL returns an HTML page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('<!doctype html><title>New API</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
      .mockResolvedValueOnce(new Response('<!doctype html><title>New API</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
      .mockResolvedValueOnce(new Response('<!doctype html><title>New API</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'pong' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadRoute({
      ...provider,
      baseUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
    });
    const res = await POST(req({ key: 'sk-test-key', model: 'deepseek-v4-pro' }), {
      params: Promise.resolve({ provider: 'newapi_root' }),
    });

    expect(await res.json()).toEqual({ valid: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/chat/completions', expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://example.com/v1/chat/completions', expect.anything());
  });

  it('summarizes upstream HTML failures instead of returning the full HTML page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <!doctype html>
      <html>
        <head>
          <title>403 | Forbidden</title>
          <meta name="description" content="Access is forbidden to the requested page.">
        </head>
        <body>${'<svg></svg>'.repeat(50)}</body>
      </html>
    `, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));

    const { POST } = await loadRoute({ ...provider, userAgent: 'Mozilla/5.0' });
    const res = await POST(req({ key: 'sk-test-key', model: 'deepseek-v4-pro' }), {
      params: Promise.resolve({ provider: 'newapi_root' }),
    });

    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.status).toBe(403);
    expect(json.error).toContain('403 | Forbidden');
    expect(json.error).toContain('Access is forbidden');
    expect(json.error).not.toContain('<html');
    expect(json.error).not.toContain('<svg');
  });
});
