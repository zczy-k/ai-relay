-- Migration: Add request_logs table for unified request logging
-- D1 (SQLite) dialect. Postgres deployments manage this table via
-- drizzle-kit (src/lib/db/schema.ts → ./drizzle), not this file.

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success' | 'error'
  http_status INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  is_stream INTEGER NOT NULL DEFAULT 0, -- boolean (0/1)
  error_type TEXT,
  error_message TEXT,
  diagnostic TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS request_logs_timestamp_idx ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS request_logs_status_idx ON request_logs(status);
CREATE INDEX IF NOT EXISTS request_logs_provider_idx ON request_logs(provider);
