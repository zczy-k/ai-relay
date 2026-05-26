import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/providers/models', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer admin-test-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('admin provider upstream model discovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RELAY_ADMIN_KEY', 'admin-test-key');
    vi.restoreAllMocks();
  });

  it('fetches OpenAI-compatible /models and normalizes model rows', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      object: 'list',
      data: [
        { id: 'gpt-5.4-mini', object: 'model' },
        { id: 'gpt-5.4', object: 'model' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/admin/providers/models/route');
    const res = await POST(req({
      providerConfig: {
        name: 'custom_openai',
        displayName: 'Custom OpenAI',
        baseUrl: 'https://example.com/v1/chat/completions',
        headerFormat: 'openai',
        modelPrefixes: ['gpt-'],
        envKeyField: 'CUSTOM_OPENAI_KEYS',
      },
      key: 'sk-test-key',
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/v1/models', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer sk-test-key' }),
    }));
    expect(json.models).toEqual([
      expect.objectContaining({ id: 'gpt-5.4', displayName: 'gpt-5.4', supportsStream: true }),
      expect.objectContaining({ id: 'gpt-5.4-mini', displayName: 'gpt-5.4-mini', supportsStream: true }),
    ]);
  });

  it('returns upstream error details when model discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'invalid api key' },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })));

    const { POST } = await import('../app/api/admin/providers/models/route');
    const res = await POST(req({
      providerConfig: {
        name: 'bad_provider',
        displayName: 'Bad Provider',
        baseUrl: 'https://example.com/v1',
        headerFormat: 'openai',
        modelPrefixes: ['bad-'],
        envKeyField: 'BAD_PROVIDER_KEYS',
      },
      key: 'sk-bad-key',
    }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.message).toContain('invalid api key');
  });
});
