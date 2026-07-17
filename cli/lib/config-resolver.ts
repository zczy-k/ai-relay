// ============================================================
// AI API Relay — Config Source Resolver
//
// Resolves configuration source from multiple inputs with priority:
// 1. CLI --config argument
// 2. Environment variables
// 3. Local config file (~/.ai-relay/relay-config.json)
// 4. Stored profile cloudUrl (from login)
// 5. Returns null (triggers interactive prompt)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import {
  ConfigSource,
  CloudConfigSource,
  FileConfigSource,
  InlineConfigSource,
  FileConfig,
} from './config-source';
import type { LocalProfile } from '../local/profile';
import { getProfileDir } from '../local/profile';

export interface ResolveConfigOptions {
  /**
   * Explicit config argument from CLI (--config parameter).
   * Can be a URL (http://...) or file path.
   */
  configArg?: string;

  /**
   * Loaded local profile (may contain cloudUrl from login).
   */
  profile?: LocalProfile | null;

  /**
   * Environment variables to check.
   */
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve a config source from various inputs with priority.
 *
 * Priority order:
 * 1. CLI --config argument (URL or file path)
 * 2. Environment variables (RELAY_CONFIG_URL, RELAY_CONFIG_PATH)
 * 3. Inline config from env vars (OPENAI_KEYS, CLAUDE_KEYS, etc.)
 * 4. Local config file (~/.ai-relay/relay-config.json)
 * 5. Stored profile cloudUrl (from ai-relay login)
 * 6. null (no config source found)
 *
 * @returns ConfigSource or null if no source found
 */
export function resolveConfigSource(options: ResolveConfigOptions): ConfigSource | null {
  const { configArg, profile, env = process.env } = options;

  // 1. CLI --config argument
  if (configArg) {
    return createConfigSourceFromArg(configArg, profile);
  }

  // 2. Environment variables - explicit URL or path
  if (env.RELAY_CONFIG_URL || env.RELAY_CLOUD_URL) {
    const url = env.RELAY_CONFIG_URL || env.RELAY_CLOUD_URL;
    const deviceToken = profile?.deviceToken;
    return new CloudConfigSource(url!, deviceToken);
  }

  if (env.RELAY_CONFIG_PATH) {
    return new FileConfigSource(env.RELAY_CONFIG_PATH);
  }

  // 3. Inline config from environment variables
  const inlineConfig = buildInlineConfigFromEnv(env);
  if (inlineConfig) {
    return new InlineConfigSource(inlineConfig);
  }

  // 4. Local config file (default location)
  const defaultConfigPath = path.join(getProfileDir(), 'relay-config.json');
  if (fs.existsSync(defaultConfigPath)) {
    return new FileConfigSource(defaultConfigPath);
  }

  // 5. Stored profile cloudUrl (from login)
  if (profile?.cloudUrl) {
    return new CloudConfigSource(profile.cloudUrl, profile.deviceToken);
  }

  // 6. No config source found
  return null;
}

/**
 * Create config source from CLI argument.
 * Auto-detects whether it's a URL or file path.
 */
function createConfigSourceFromArg(
  configArg: string,
  profile?: LocalProfile | null
): ConfigSource {
  // Check if it's a URL
  if (configArg.startsWith('http://') || configArg.startsWith('https://')) {
    const deviceToken = profile?.deviceToken;
    return new CloudConfigSource(configArg, deviceToken);
  }

  // Otherwise treat as file path
  // Resolve relative paths from current directory
  const resolvedPath = path.isAbsolute(configArg)
    ? configArg
    : path.resolve(process.cwd(), configArg);

  return new FileConfigSource(resolvedPath);
}

/**
 * Build inline config from environment variables.
 * Supports provider keys and basic routing config.
 *
 * Automatically discovers providers from XXX_KEYS environment variables.
 * Example: OPENAI_KEYS=sk-xxx will create an 'openai' provider.
 */
function buildInlineConfigFromEnv(env: NodeJS.ProcessEnv): FileConfig | null {
  const providers: FileConfig['providers'] = {};

  // Well-known provider mappings (for display names and default base URLs)
  const knownProviders: Record<string, { name: string; defaultBaseUrl?: string }> = {
    'OPENAI': { name: 'OpenAI', defaultBaseUrl: 'https://api.openai.com' },
    'CLAUDE': { name: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com' },
    'ANTHROPIC': { name: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com' },
    'DEEPSEEK': { name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com' },
    'XIAOMI': { name: 'Xiaomi' },
    'XIAOMI_CODING': { name: 'Xiaomi Coding' },
    'XIAOMIMIMO_SGP_CODING': { name: 'Xiaomimimo SGP Coding' },
  };

  // Scan environment for XXX_KEYS patterns
  for (const [key, value] of Object.entries(env)) {
    if (!key.endsWith('_KEYS') || !value) {
      continue;
    }

    // Extract provider prefix (e.g., "OPENAI" from "OPENAI_KEYS")
    const providerPrefix = key.slice(0, -5); // Remove "_KEYS"
    const providerIdRaw = providerPrefix.toLowerCase().replace(/_/g, '-');

    // Special case: CLAUDE_KEYS → anthropic provider
    const providerId = providerIdRaw === 'claude' ? 'anthropic' : providerIdRaw;

    const knownInfo = knownProviders[providerPrefix];
    const baseUrlKey = `${providerPrefix}_BASE_URL`;

    providers[providerId] = {
      name: knownInfo?.name || toTitleCase(providerId),
      apiKeys: value.split(',').map(k => k.trim()).filter(Boolean),
      baseUrl: env[baseUrlKey] || knownInfo?.defaultBaseUrl,
    };
  }

  if (Object.keys(providers).length === 0) {
    return null;
  }

  return {
    version: 1,
    providers,
  };
}

/**
 * Convert kebab-case or snake_case to Title Case.
 * Example: "xiaomi-coding" → "Xiaomi Coding"
 */
function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the default config file path.
 */
export function getDefaultConfigPath(): string {
  return path.join(getProfileDir(), 'relay-config.json');
}

/**
 * Check if a config file exists at the default location.
 */
export function hasDefaultConfig(): boolean {
  return fs.existsSync(getDefaultConfigPath());
}
