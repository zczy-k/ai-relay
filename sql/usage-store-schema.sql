-- ============================================================
-- AI Relay Usage Store Schema (Postgres)
-- For VPS/Server deployment
-- ============================================================

-- Usage events (aggregated batches from local relays or direct cloud requests)
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  runtime TEXT NOT NULL, -- 'vercel' | 'cloudflare' | 'local' | 'server'
  device_id TEXT, -- for local/server runtime
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_hash TEXT,
  status_code INTEGER NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  is_stream BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_runtime ON usage_events(runtime);
CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_usage_events_device ON usage_events(device_id);

-- Devices (for local relay management)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT, -- 'darwin' | 'linux' | 'win32'
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'online', -- 'online' | 'offline' | 'revoked'
  cli_version TEXT,
  config_version BIGINT DEFAULT 0,
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON devices(last_heartbeat DESC);

-- Device sessions (for device code flow)
CREATE TABLE IF NOT EXISTS device_sessions (
  device_code TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'expired'
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_expires ON device_sessions(expires_at);
