// ============================================================
// AI API Relay — Latency Tracker
// ============================================================
// Tracks per-provider latency using a sliding window.
// Data stored in KV (relay:route:latency:{provider}) with in-memory cache.
// Designed for Edge Runtime — uses Web Crypto API compatible patterns.

import type { LatencyRecord, LatencyStats } from './types';
import { getKV } from './kv-client';

/** In-memory latency cache: provider → records[] */
const latencyCache = new Map<string, LatencyRecord[]>();

/** Cache TTL */
const CACHE_TTL_MS = 30_000; // 30s
const cacheTimestamps = new Map<string, number>();

/** Write debounce: minimum interval between KV writes per provider */
const WRITE_INTERVAL_MS = 60_000; // 60s
const lastWriteAt = new Map<string, number>();
/** Dirty record count since last write — flush early if enough accumulate */
const dirtyCount = new Map<string, number>();
const DIRTY_FLUSH_THRESHOLD = 5;

/** Max samples per provider (sliding window) */
const MAX_SAMPLES = 100;

/** KV key prefix */
const KV_PREFIX = 'relay:route:latency:';

/** How long to keep samples in KV (24h) */
const KV_TTL_SECONDS = 86400;

/**
 * Get cached latency records for a provider.
 * Returns null if cache is stale or missing.
 */
function getCachedRecords(provider: string): LatencyRecord[] | null {
  const cached = latencyCache.get(provider);
  const ts = cacheTimestamps.get(provider);
  if (cached && ts && Date.now() - ts < CACHE_TTL_MS) {
    return cached;
  }
  return null;
}

/**
 * Load latency records from KV.
 */
async function loadFromKV(provider: string): Promise<LatencyRecord[]> {
  try {
    const kv = await getKV();
    if (!kv) return [];
    const data = await kv.get(`${KV_PREFIX}${provider}`);
    if (Array.isArray(data)) {
      latencyCache.set(provider, data as LatencyRecord[]);
      cacheTimestamps.set(provider, Date.now());
      return data as LatencyRecord[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save latency records to KV (debounced, fire-and-forget).
 * Writes if: 60s elapsed since last write OR dirty count >= threshold.
 */
function saveToKV(provider: string, records: LatencyRecord[]): void {
  const now = Date.now();
  const lastWrite = lastWriteAt.get(provider) || 0;
  const dirty = (dirtyCount.get(provider) || 0) + 1;
  dirtyCount.set(provider, dirty);

  if (now - lastWrite < WRITE_INTERVAL_MS && dirty < DIRTY_FLUSH_THRESHOLD) return;

  lastWriteAt.set(provider, now);
  dirtyCount.set(provider, 0);

  getKV().then((kv: any) => {
    if (kv) {
      kv.set(`${KV_PREFIX}${provider}`, records, { ex: KV_TTL_SECONDS });
    }
  }).catch(() => {});
}

/**
 * Record a latency sample for a provider.
 * Updates in-memory cache and asynchronously persists to KV.
 */
export function recordLatency(
  provider: string,
  latencyMs: number,
  success: boolean,
  statusCode?: number
): void {
  const record: LatencyRecord = {
    provider,
    latencyMs,
    timestamp: Date.now(),
    success,
    statusCode,
  };

  let records = latencyCache.get(provider) || [];
  records.push(record);

  // Keep only the most recent MAX_SAMPLES
  if (records.length > MAX_SAMPLES) {
    records = records.slice(records.length - MAX_SAMPLES);
  }

  latencyCache.set(provider, records);
  cacheTimestamps.set(provider, Date.now());

  // Async persist to KV
  saveToKV(provider, records);
}

/**
 * Get latency stats for a provider.
 * Uses cache first, falls back to KV, returns empty stats if nothing found.
 */
export async function getLatencyStats(provider: string): Promise<LatencyStats> {
  let records = getCachedRecords(provider);
  if (!records) {
    records = await loadFromKV(provider);
  }

  if (records.length === 0) {
    return {
      provider,
      avgLatencyMs: Infinity,
      p50LatencyMs: Infinity,
      p95LatencyMs: Infinity,
      sampleCount: 0,
      lastUpdated: 0,
    };
  }

  // Only consider successful requests for latency stats
  const successRecords = records.filter((r) => r.success);
  if (successRecords.length === 0) {
    return {
      provider,
      avgLatencyMs: Infinity,
      p50LatencyMs: Infinity,
      p95LatencyMs: Infinity,
      sampleCount: 0,
      lastUpdated: records[records.length - 1].timestamp,
    };
  }

  const latencies = successRecords.map((r) => r.latencyMs).sort((a, b) => a - b);
  const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  return {
    provider,
    avgLatencyMs: Math.round(avg),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    sampleCount: successRecords.length,
    lastUpdated: records[records.length - 1].timestamp,
  };
}

/**
 * Get all latency stats (for admin dashboard).
 */
export async function getAllLatencyStats(): Promise<Record<string, LatencyStats>> {
  try {
    const kv = await getKV();
    if (!kv) return {};

    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
      const result: [string | number, string[]] = await kv.scan(cursor, { match: `${KV_PREFIX}*`, count: 100 });
      keys.push(...result[1]);
      cursor = result[0];
    } while (cursor !== 0 && cursor !== '0');

    const stats: Record<string, LatencyStats> = {};
    for (const key of keys) {
      const provider = key.replace(KV_PREFIX, '');
      stats[provider] = await getLatencyStats(provider);
    }

    return stats;
  } catch {
    return {};
  }
}

/**
 * Get success rate for a provider from recent samples.
 */
export async function getSuccessRate(provider: string): Promise<number> {
  let records = getCachedRecords(provider);
  if (!records) {
    records = await loadFromKV(provider);
  }

  if (records.length === 0) return 1; // Assume healthy if no data

  const recentRecords = records.slice(-20); // Last 20 samples
  const successCount = recentRecords.filter((r) => r.success).length;
  return successCount / recentRecords.length;
}
