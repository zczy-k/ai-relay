-- Add config_flags table for runtime configuration (e.g., request log capture TTL)
-- D1 (SQLite) dialect.

CREATE TABLE IF NOT EXISTS config_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
