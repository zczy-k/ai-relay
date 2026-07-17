// ============================================================
// AI Relay Local Runtime — SQLite Usage Storage
// ============================================================

import type { UsageStorage } from '../sdk';
import type { UsageEvent, ErrorEvent } from '../sdk';
import Database from 'better-sqlite3';

export class SQLiteUsageStorage implements UsageStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        runtime TEXT,
        device_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        api_key_hash TEXT,
        status_code INTEGER NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        is_stream INTEGER DEFAULT 0,
        uploaded_at TEXT
      );

      CREATE TABLE IF NOT EXISTS request_logs (
        trace_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        model TEXT,
        provider TEXT,
        status TEXT NOT NULL,
        http_status INTEGER,
        latency_ms INTEGER,
        error_type TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_uploaded ON usage_events(uploaded_at);
    `);
  }

  async record(event: UsageEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO usage_events (
        id, timestamp, runtime, device_id, provider, model, api_key_hash,
        status_code, prompt_tokens, completion_tokens, latency_ms, is_stream
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.timestamp,
      event.runtime || 'local',
      event.deviceId || null,
      event.provider,
      event.model,
      event.apiKeyHash || null,
      event.statusCode,
      event.promptTokens || 0,
      event.completionTokens || 0,
      event.latencyMs || 0,
      event.isStream ? 1 : 0
    );
  }

  async recordError(event: ErrorEvent): Promise<void> {
    // Implement error recording if needed
  }

  async getDailyReport(date: string): Promise<any> {
    return null;
  }

  async getUsageTrend(options: any): Promise<any> {
    return { dates: [], data: [] };
  }

  getUnuploaded(): Array<UsageEvent> {
    const stmt = this.db.prepare(`
      SELECT * FROM usage_events WHERE uploaded_at IS NULL LIMIT 100
    `);
    return stmt.all() as any[];
  }

  markUploaded(ids: string[]): void {
    const stmt = this.db.prepare(`
      UPDATE usage_events SET uploaded_at = ? WHERE id = ?
    `);
    const now = new Date().toISOString();
    const transaction = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(now, id);
      }
    });
    transaction(ids);
  }

  close() {
    this.db.close();
  }
}
