import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveProvider, resolveFallbackModel, resolveUpstreamModel, clearProvidersCache } from '../lib/providers/resolver';
import {
  saveCustomProvider,
  __adminConfigCacheForTests,
  createMemoryMockKV,
} from '../lib/admin/admin-config';

describe('GPT provider resolution tests', () => {
  it('should route GPT models to OpenAI', async () => {
    const gpt55Provider = await resolveProvider('gpt-5.5');
    expect(gpt55Provider).not.toBeNull();
    expect(gpt55Provider?.name).toBe('openai');

    const gpt54Provider = await resolveProvider('gpt-5.4');
    expect(gpt54Provider).not.toBeNull();
    expect(gpt54Provider?.name).toBe('openai');

    const gpt54MiniProvider = await resolveProvider('gpt-5.4-mini');
    expect(gpt54MiniProvider).not.toBeNull();
    expect(gpt54MiniProvider?.name).toBe('openai');

    const gpt53CodexProvider = await resolveProvider('gpt-5.3-codex');
    expect(gpt53CodexProvider).not.toBeNull();
    expect(gpt53CodexProvider?.name).toBe('openai');

    const otherGptProvider = await resolveProvider('gpt-6-preview');
    expect(otherGptProvider).not.toBeNull();
    expect(otherGptProvider?.name).toBe('openai');
  });
});

describe('mimo-v2.5 provider resolution and mapping tests', () => {
  it('should resolve the correct provider for each mimo-v2.5 variant', async () => {
    // mimo-v2.5-coding should resolve to xiaomi_coding
    const codingProvider = await resolveProvider('mimo-v2.5-coding');
    expect(codingProvider).not.toBeNull();
    expect(codingProvider?.name).toBe('xiaomi_coding');

    // mimo-v2.5-sgp should resolve to xiaomi_sgp_coding
    const sgpProvider = await resolveProvider('mimo-v2.5-sgp');
    expect(sgpProvider).not.toBeNull();
    expect(sgpProvider?.name).toBe('xiaomi_sgp_coding');

    // mimo-v2.5 should resolve to xiaomi (since prefix is 'mimo-', which matches, and is standard)
    const baseProvider = await resolveProvider('mimo-v2.5');
    expect(baseProvider).not.toBeNull();
    expect(baseProvider?.name).toBe('xiaomi');
  });

  it('should map the virtual model names to correct upstream model ID', async () => {
    const xiaomiProvider = await resolveProvider('mimo-v2.5');
    const sgpProvider = await resolveProvider('mimo-v2.5-sgp');
    const codingProvider = await resolveProvider('mimo-v2.5-coding');

    expect(resolveUpstreamModel('mimo-v2.5-coding', codingProvider!)).toBe('mimo-v2.5');
    expect(resolveUpstreamModel('mimo-v2.5-sgp', sgpProvider!)).toBe('mimo-v2.5');
    expect(resolveUpstreamModel('mimo-v2.5', xiaomiProvider!)).toBe('mimo-v2.5');
  });

  it('should resolve correct fallback model for base mimo-v2.5 models', async () => {
    // Fallback to xiaomi_sgp_coding with base mimo-v2.5 model should resolve to mimo-v2.5-sgp
    const sgpFallback = await resolveFallbackModel('mimo-v2.5', 'xiaomi_sgp_coding');
    expect(sgpFallback).toBe('mimo-v2.5-sgp');

    // Fallback to xiaomi with base mimo-v2.5 should resolve to mimo-v2.5
    const xiaomiFallback = await resolveFallbackModel('mimo-v2.5', 'xiaomi');
    expect(xiaomiFallback).toBe('mimo-v2.5');

    // Fallback to xiaomi_coding with base mimo-v2.5 should resolve to mimo-v2.5-coding
    const codingFallback = await resolveFallbackModel('mimo-v2.5', 'xiaomi_coding');
    expect(codingFallback).toBe('mimo-v2.5-coding');

  });

  it('should resolve correct fallback model for pro model variants', async () => {
    // Fallback to xiaomi_sgp_coding with mimo-v2.5-pro should resolve to mimo-v2.5-pro-sgp
    const sgpFallback = await resolveFallbackModel('mimo-v2.5-pro', 'xiaomi_sgp_coding');
    expect(sgpFallback).toBe('mimo-v2.5-pro-sgp');

    // Fallback to xiaomi with mimo-v2.5-pro should resolve to mimo-v2.5-pro
    const xiaomiFallback = await resolveFallbackModel('mimo-v2.5-pro', 'xiaomi');
    expect(xiaomiFallback).toBe('mimo-v2.5-pro');

    // Fallback to xiaomi_coding with mimo-v2.5-pro should resolve to mimo-v2.5-pro-coding
    const codingFallback = await resolveFallbackModel('mimo-v2.5-pro', 'xiaomi_coding');
    expect(codingFallback).toBe('mimo-v2.5-pro-coding');

  });

  it('should support vision for all mimo-v2.5 and pro variants', async () => {
    const xiaomiProvider = await resolveProvider('mimo-v2.5');
    const sgpProvider = await resolveProvider('mimo-v2.5-sgp');
    const codingProvider = await resolveProvider('mimo-v2.5-coding');
    const proProvider = await resolveProvider('mimo-v2.5-pro');

    expect(xiaomiProvider?.models?.find(m => m.id === 'mimo-v2.5')?.supportsVision).toBe(true);
    expect(xiaomiProvider?.models?.find(m => m.id === 'mimo-v2.5-pro')?.supportsVision).toBe(true);

    expect(sgpProvider?.models?.find(m => m.id === 'mimo-v2.5-sgp')?.supportsVision).toBe(true);
    expect(sgpProvider?.models?.find(m => m.id === 'mimo-v2.5-pro-sgp')?.supportsVision).toBe(true);

    expect(codingProvider?.models?.find(m => m.id === 'mimo-v2.5-coding')?.supportsVision).toBe(true);
    expect(codingProvider?.models?.find(m => m.id === 'mimo-v2.5-pro-coding')?.supportsVision).toBe(true);

    expect(proProvider?.models?.find(m => m.id === 'mimo-v2.5')?.supportsVision).toBe(true);
    expect(proProvider?.models?.find(m => m.id === 'mimo-v2.5-pro')?.supportsVision).toBe(true);
  });
});

describe('Custom provider exact match and wildcard prefix routing tests', () => {
  beforeEach(() => {
    __adminConfigCacheForTests.clear();
    clearProvidersCache();
    const mock = createMemoryMockKV();
    (global as any)._mockKVInstance = mock;
    (global as any)._mockKVInstance._isMock = true;
  });

  afterEach(() => {
    delete (global as any)._mockKVInstance;
    __adminConfigCacheForTests.clear();
    clearProvidersCache();
  });

  it('should only resolve exact match or wildcard prefixes, avoiding hijacking similar models', async () => {
    await saveCustomProvider({
      name: 'my_custom_provider',
      displayName: 'My Custom Provider',
      baseUrl: 'https://custom.example.com/v1',
      modelPrefixes: ['gpt-4'],
      headerFormat: 'openai',
      envKeyField: 'MY_CUSTOM_PROVIDER_KEYS',
      models: [{ id: 'gpt-4', displayName: 'GPT 4', contextWindow: 8192 }],
    });

    const gpt4Provider = await resolveProvider('gpt-4');
    expect(gpt4Provider).not.toBeNull();
    expect(gpt4Provider?.name).toBe('my_custom_provider');

    const gpt4oProvider = await resolveProvider('gpt-4o');
    expect(gpt4oProvider).not.toBeNull();
    expect(gpt4oProvider?.name).toBe('openai');

    const gpt41Provider = await resolveProvider('gpt-4.1');
    expect(gpt41Provider).not.toBeNull();
    expect(gpt41Provider?.name).toBe('openai');
  });

  it('should resolve wildcard prefixes correctly', async () => {
    await saveCustomProvider({
      name: 'wildcard_provider',
      displayName: 'Wildcard Provider',
      baseUrl: 'https://wildcard.example.com/v1',
      modelPrefixes: ['my-model-'],
      headerFormat: 'openai',
      envKeyField: 'WILDCARD_PROVIDER_KEYS',
      models: [{ id: 'my-model-v1', displayName: 'My Model V1', contextWindow: 8192 }],
    });

    const v2Provider = await resolveProvider('my-model-v2');
    expect(v2Provider).not.toBeNull();
    expect(v2Provider?.name).toBe('wildcard_provider');

    const baseProvider = await resolveProvider('my-model');
    expect(baseProvider).toBeNull();
  });

  it('should override built-in providers when a custom provider registers a duplicate model ID', async () => {
    // Save a custom provider registering 'gpt-5.4-mini' (which is otherwise a built-in openai model)
    await saveCustomProvider({
      name: 'custom_override_provider',
      displayName: 'Custom Override Provider',
      baseUrl: 'https://override.example.com/v1',
      modelPrefixes: ['gpt-5.4-mini'],
      headerFormat: 'openai',
      envKeyField: 'CUSTOM_OVERRIDE_KEYS',
      models: [{ id: 'gpt-5.4-mini', displayName: 'Custom GPT 5.4 Mini Override', contextWindow: 128000 }],
    });

    const provider = await resolveProvider('gpt-5.4-mini');
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe('custom_override_provider');
  });
});

import { validateBase64ImageSizes } from '../lib/relay/validation';

describe('base64 image size validation tests', () => {
  it('should pass validation for small base64 images', () => {
    const smallBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const body = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${smallBase64}` } }
          ]
        }
      ]
    };
    const result = validateBase64ImageSizes(body);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should fail validation and return error message for base64 images exceeding 1MB', () => {
    const largeString = 'A'.repeat(2800000);
    const body = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this large image' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${largeString}` } }
          ]
        }
      ]
    };
    const result = validateBase64ImageSizes(body);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Base64 image size exceeds the limit of 1MB');
  });
});
