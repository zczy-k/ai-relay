-- ============================================================
-- AI Relay Config Store Schema (Postgres)
-- For VPS/Server deployment
-- ============================================================

-- Config metadata (version tracking)
CREATE TABLE IF NOT EXISTS config_metadata (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Providers
CREATE TABLE IF NOT EXISTS providers (
  name TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  fallback_chain TEXT[], -- array of provider names
  config_json JSONB NOT NULL, -- full ProviderConfig as JSON
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Provider keys
CREATE TABLE IF NOT EXISTS provider_keys (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL REFERENCES providers(name) ON DELETE CASCADE,
  key_value TEXT NOT NULL, -- encrypted in production
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider, is_active);

-- Model aliases
CREATE TABLE IF NOT EXISTS model_aliases (
  alias TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Priority rules
CREATE TABLE IF NOT EXISTS priority_rules (
  id SERIAL PRIMARY KEY,
  rule_order INTEGER NOT NULL,
  rule_json JSONB NOT NULL, -- full PriorityRule as JSON
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_priority_rules_order ON priority_rules(rule_order);

-- Insert default config version
INSERT INTO config_metadata (id, version) VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;
