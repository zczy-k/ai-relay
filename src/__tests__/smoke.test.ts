import { describe, it, expect } from 'vitest';
import {
  deleteCustomProvider,
  getCustomProviders,
  saveCustomProvider,
  tryDecodeBase64,
} from '../lib/admin/admin-config';
import { clearProvidersCache } from '../lib/providers/resolver';
import type { ProviderConfig } from '../lib/providers/types';

describe('smoke test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have expected env structure', () => {
    // Placeholder: verify config shape when DB is available
    const config = {
      nodeVersion: process.version,
      platform: process.platform,
    };
    expect(config.nodeVersion).toBeTruthy();
    expect(config.platform).toBeTruthy();
  });
});

describe('tryDecodeBase64 tests', () => {
  it('should not modify standard API keys (e.g. OpenAI key with hyphens)', () => {
    const openaiKey = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
    expect(tryDecodeBase64(openaiKey)).toBe(openaiKey);
  });

  it('should decode valid standard base64-encoded key', () => {
    const rawKey = 'sk-proj-decoded-key-123';
    const base64Key = Buffer.from(rawKey).toString('base64');
    expect(tryDecodeBase64(base64Key)).toBe(rawKey);
  });

  it('should decode base64-encoded JSON service account credentials', () => {
    const jsonCreds = '{"type": "service_account", "private_key": "-----BEGIN PRIVATE KEY-----..."}';
    const base64Creds = Buffer.from(jsonCreds).toString('base64');
    expect(tryDecodeBase64(base64Creds)).toBe(jsonCreds);
  });

  it('should not modify a 32-character hex key (valid base64 but decodes to non-printable binary)', () => {
    const hexKey = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
    expect(tryDecodeBase64(hexKey)).toBe(hexKey);
  });

  it('should handle non-base64 input gracefully', () => {
    const input = 'This is a normal plain text string that is not base64';
    expect(tryDecodeBase64(input)).toBe(input);
  });
});

describe('custom provider deletion tests', () => {
  it('deletes by provider id and rejects display names that do not exist', async () => {
    const provider: ProviderConfig = {
      name: 'custom_delete_test',
      displayName: 'Custom Delete Test',
      baseUrl: 'https://example.com/v1',
      headerFormat: 'openai',
      envKeyField: 'CUSTOM_DELETE_TEST_KEYS',
      modelPrefixes: ['custom-delete-'],
      models: [],
      isCustom: true,
    };

    await saveCustomProvider(provider);

    await expect(deleteCustomProvider(provider.displayName)).rejects.toThrow('Custom provider not found');

    let customProviders = await getCustomProviders(true);
    expect(customProviders[provider.name]).toBeTruthy();

    await deleteCustomProvider(provider.name);

    customProviders = await getCustomProviders(true);
    expect(customProviders[provider.name]).toBeUndefined();

    clearProvidersCache();
  });
});
