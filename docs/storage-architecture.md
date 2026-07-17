# AI Relay Storage Architecture

## Overview

AI Relay 支持三种部署形态，存储层统一抽象，自动适配：

| 部署形态 | ConfigStore | UsageStore | 适用场景 |
|---|---|---|---|
| **Vercel** | Vercel KV | Vercel KV | Serverless，免费起步 |
| **Cloudflare** | Cloudflare KV | Cloudflare D1 | Edge，免费层更大 |
| **Local Relay** | SQLite | SQLite | 本机常驻，单用户 |
| **VPS/Server** | Postgres | Postgres | VPS 部署，多用户 |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Relay Core (relay.ts, resolver.ts, key-pool.ts)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   ConfigStore         │  ← 统一接口
         │   (interface)         │
         └───────────┬───────────┘
                     │
        ┏━━━━━━━━━━━━┻━━━━━━━━━━━━┓
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│ VercelKVStore    │      │ PostgresStore    │
│ (Vercel/CF/mock) │      │ (VPS/Server)     │
└──────────────────┘      └──────────────────┘
        │                         │
        ▼                         ▼
  Vercel KV API            Postgres (drizzle)
```

## ConfigStore Interface

```typescript
interface ConfigStore {
  getProviders(): Promise<Record<string, ProviderConfig>>;
  getProviderKeys(provider: string): Promise<string[] | null>;
  getModelAliases(): Promise<ModelAliasConfig>;
  getPriorityRules(): Promise<PriorityRule[]>;
  getFallbackChain(provider: string, staticFallbacks?: string[] | string): Promise<string[]>;
  getConfigVersion(): Promise<number>;
}
```

## Auto-detection

```typescript
// src/lib/config-store/index.ts
export function getDefaultConfigStore(): ConfigStore {
  if (process.env.DATABASE_URL && !process.env.VERCEL && !process.env.CF_PAGES) {
    return new PostgresConfigStore();  // VPS/Server
  }
  return new VercelKVConfigStore();    // Vercel/CF/dev mock
}
```

## Postgres Schema

**Config tables:**
- `config_metadata` — version tracking
- `providers` — provider configs
- `provider_keys` — key pool
- `model_aliases` — model aliases
- `priority_rules` — routing rules

**Usage tables:**
- `usage_events` — usage tracking
- `devices` — local relay devices
- `device_sessions` — device code flow

See: `sql/config-store-schema.sql`, `sql/usage-store-schema.sql`

## Local Relay vs VPS

**完全复用代码：**
- Local Relay: `DATABASE_URL=file:~/.ai-relay/local.db` (SQLite)
- VPS: `DATABASE_URL=postgres://...` (Postgres)

**差异点：**
- Local: 监听 `127.0.0.1:3147`，单用户，无需认证
- VPS: 监听 `0.0.0.0:3147`，多用户，需要 auth token

## Migration Path

**Phase 1 (MVP):**
- ✅ ConfigStore 接口抽象
- ✅ VercelKVConfigStore (Vercel/CF)
- ✅ PostgresConfigStore 骨架
- ✅ Auto-detection logic
- ✅ Postgres schema

**Phase 2 (Full Implementation):**
- Implement PostgresConfigStore CRUD
- Implement PostgresUsageStore
- SQLite ConfigStore (for Local Relay)
- Migration scripts (KV → Postgres)

**Phase 3 (Production):**
- Connection pooling
- Read replicas
- Caching layer (Redis)
- Backup/restore

## Environment Variables

```bash
# Vercel/Cloudflare (default)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# VPS/Server (Postgres)
DATABASE_URL=postgres://user:pass@host:5432/db

# Local Relay (SQLite)
DATABASE_URL=file:/Users/user/.ai-relay/local.db

# Or omit DATABASE_URL → auto-detect Vercel KV
```

## Benefits

1. **统一代码库：** Local Relay 和 VPS 部署共享同一套实现
2. **灵活迁移：** Vercel → VPS 只需切换环境变量
3. **测试友好：** Mock ConfigStore，不依赖真实 KV
4. **可扩展：** 未来支持 Redis, Consul, etcd

## Files

```
src/lib/config-store/
  types.ts                 # ConfigStore interface
  index.ts                 # Auto-detection factory
  vercel-kv-store.ts       # Vercel/CF implementation
  postgres-store.ts        # VPS/Server implementation (TODO)

cli/lib/
  remote-store.ts          # Local Relay (SQLite, TODO)
  sqlite-storage.ts        # Local usage storage (TODO)

sql/
  config-store-schema.sql  # Postgres DDL
  usage-store-schema.sql   # Postgres DDL
```
