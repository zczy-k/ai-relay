# AI Relay Local Relay — Technical Architecture

## Overview

Local Relay 是 AI Relay 的本机运行模式，配置从云端同步，API keys 永不上传。

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Cloud Admin (Vercel/Cloudflare Pages)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Provider KV  │  │ Keys KV      │  │ Config KV    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                            │                               │
│  API Routes:               │ HTTPS                         │
│    /api/local/devices/*    │ (Config Sync Only)            │
│    /api/local/config/*     │                               │
│    /api/local/usage/*      │                               │
└────────────────────────────┼───────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│  Local Relay (~/.ai-relay/)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ HTTP Server  │  │ Config Cache │  │ Usage DB     │    │
│  │ :3147        │  │ (SQLite)     │  │ (SQLite)     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                  │                  │            │
│         │  Sync Loop ──────┤                  │            │
│         │  Upload Loop ────┴──────────────────┘            │
└─────────┼──────────────────────────────────────────────────┘
          │ localhost:3147
          ▼
┌────────────────────────────────────────────────────────────┐
│  AI Agents (Codex, Claude Code, Cursor, etc.)              │
└────────────────────────────────────────────────────────────┘
```

## Components

### 1. ConfigStore Abstraction

**Interface:**

```typescript
interface ConfigStore {
  getProviders(): Promise<Record<string, ProviderConfig>>;
  getProviderKeys(provider: string): Promise<string[] | null>;
  getModelAliases(): Promise<ModelAliasConfig>;
  getPriorityRules(): Promise<PriorityRule[]>;
  getFallbackChain(provider: string): Promise<string[]>;
  getConfigVersion(): Promise<number>;
}
```

**Implementations:**

- `VercelKVConfigStore`: 包装现有 admin-config.ts (for Vercel/CF deployment)
- `RemoteConfigStore`: 本机 SQLite cache + 云端 sync (for Local Relay)

**Integration:**

- `resolver.ts`: `getAllProviders()` / `resolveModelAlias()` / `resolveProvider()` 改为从 `getDefaultConfigStore()` 读取
- `key-pool.ts`: `loadManagedKeys()` 改为从 ConfigStore 读取
- `relay.ts`: fallback chain 从 ConfigStore 读取

### 2. Local HTTP Server

**Endpoints:**

- `GET /health` → `{ status: 'ok', version: '2.13.0' }`
- `GET /v1/models` → 模型列表
- `POST /v1/chat/completions` → OpenAI-compatible streaming
- `POST /v1/messages` → Anthropic Messages API
- `POST /v1/responses` → Anthropic Responses API

**Implementation:**

Node.js `http.createServer()`，复用现有 `relayRequest()` 核心逻辑。

### 3. Config Sync Loop

**Flow:**

1. 每 30s 调用 `GET /api/local/config/version`
2. 如果 `version` 变化，调用 `GET /api/local/config/snapshot`
3. 写入本机 SQLite `config_snapshots` 表
4. `RemoteConfigStore.getProviders()` 等方法从本机 SQLite 读取

**Schema:**

```sql
CREATE TABLE config_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

### 4. Usage Tracking & Upload

**Local Storage:**

```sql
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  runtime TEXT,           -- 'local'
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
```

**Upload Loop:**

1. 每 60s 从本机 SQLite 读取 `uploaded_at IS NULL` 的 events
2. `POST /api/local/usage/batch` 批量上传（带 `deviceId`, `runtime: 'local'`）
3. 标记 `uploaded_at = now()`

**Idempotency:**

云端根据 `event.id` 或 `(batchId, event.id)` 去重。

### 5. Device Management

**Device Code Flow (OAuth 2.0 Device Authorization Grant):**

```
1. CLI: POST /api/local/devices/session
   ← { device_code, verification_url, expires_in }

2. CLI: 打印或打开 verification_url (Admin UI)

3. User: 在 Admin 点击「Connect」，输入 device name

4. Admin: 创建 device record，生成 deviceToken，存入 KV
   {
     id: 'dev_xxx',
     name: 'MacBook Pro',
     platform: 'darwin',
     status: 'online',
     tokenHash: hash(deviceToken),
     createdAt: '...',
   }

5. CLI: 轮询 POST /api/local/devices/token { device_code }
   ← { device_token } (pending → returns token when user confirms)

6. CLI: 保存 deviceToken 到 ~/.ai-relay/config.json
```

**Heartbeat:**

```typescript
POST /api/local/devices/heartbeat
{
  deviceId: 'dev_xxx',
  cliVersion: '2.13.0',
  configVersion: 42,
  status: 'online',
}
```

### 6. Cloud Sync API

**Routes:**

- `POST /api/local/devices/session` → 创建 device code
- `POST /api/local/devices/token` → 轮询 token
- `POST /api/local/devices/heartbeat` → 心跳
- `POST /api/local/devices/[id]/revoke` → 撤销设备
- `GET /api/local/config/version` → 返回配置版本号
- `GET /api/local/config/snapshot` → 返回完整 ConfigSnapshot
- `POST /api/local/usage/batch` → 批量接收 usage events

**KV Schema:**

```
local:device:{deviceId} → LocalDevice
local:device-token:{tokenHash} → deviceId
local:device-session:{deviceCode} → { deviceId, expiresAt }
```

### 7. Agent Adapters

**Interface:**

```typescript
interface AgentAdapter {
  id: 'codex' | 'claude' | 'openai-env';
  label: string;
  detect(): Promise<{ installed: boolean; configPath?: string }>;
  install(options: InstallOptions): Promise<InstallResult>;
  doctor(): Promise<DoctorResult>;
  uninstall(): Promise<void>;
}
```

**Implementations:**

- `CodexAdapter`: 追加/更新 `~/.codex/config.toml`
- `ClaudeCodeAdapter`: 生成 `~/.ai-relay/agents/claude.env`
- `OpenAIEnvAdapter`: 生成 `~/.ai-relay/agents/openai.env`

### 8. CLI Commands

```bash
ai-relay login <cloud-url>          # Device code flow
ai-relay logout                      # 删除本机 token，云端不撤销
ai-relay local start [--daemon]      # 启动 server
ai-relay local stop                  # 停止 server
ai-relay local status                # 显示状态
ai-relay local doctor                # 诊断
ai-relay agent list                  # 列出支持的 agents
ai-relay agent install <agent>       # 配置 agent
ai-relay agent doctor <agent>        # 验证 agent config
ai-relay agent uninstall <agent>     # 移除 agent config
```

## Security Model (MVP)

- **Transport:** HTTPS（云端同步）
- **Authentication:** `deviceToken`（JWT 或 opaque token）
- **API Keys:** 云端明文传输（HTTPS 加密），本机明文存储（SQLite）
- **Listening:** 只监听 `127.0.0.1`，不对外暴露
- **Usage Upload:** 只上传聚合数据，不含 prompt/completion 全文

**P1 Security Enhancements:**

- E2E encryption: 云端只存储加密后的 key，本机解密
- Keychain/Credential Manager: 替代明文存储
- mTLS: device token + client certificate

## Future: Server Runtime

**Standalone Server Mode:**

- Docker Compose: `ai-relay-server` + PostgreSQL
- 环境变量配置（不依赖云端 Admin）
- Postgres 作为权威 ConfigStore
- 暴露 `0.0.0.0:3147`（反向代理 + HTTPS）

**Managed Worker Mode:**

- VPS 上运行，仍从云端同步配置
- 适合多人团队共享一个 VPS relay

## Milestones

- **Phase 1 (MVP):** ✅ ConfigStore 抽象
- **Phase 2:** ✅ 基础架构文件（CLI, SQLite, API routes）
- **Phase 3:** 完整实现 device flow, sync loops, usage upload
- **Phase 4:** Agent adapters 完整实现（Codex, Claude Code, OpenAI）
- **Phase 5:** Admin UI（设备列表、撤销、usage 维度）
- **Phase 6:** 集成测试 + 用户测试
- **Phase 7:** Keychain integration, daemon mode
- **Phase 8:** Mac App, Docker image

## Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

## File Structure

```
src/
  lib/
    config-store/
      types.ts                    # ConfigStore interface
      index.ts                    # getDefaultConfigStore()
      vercel-kv-store.ts          # Vercel/CF implementation
      remote-store.ts             # Local Relay implementation
    usage/storage/
      sqlite-storage.ts           # SQLiteUsageStorage
    runtime/
      capabilities.ts             # detectRuntime()
  cli/
    index.ts                      # CLI entry point
    local/
      profile.ts                  # LocalProfile management
      server.ts                   # HTTP server
      sync.ts                     # Config sync loop
      uploader.ts                 # Usage upload loop
      heartbeat.ts                # Heartbeat loop
    agent/
      adapter.ts                  # AgentAdapter interface
      codex-adapter.ts
      claude-adapter.ts
      openai-adapter.ts
  app/api/local/
    devices/
      session/route.ts            # Device code flow
      token/route.ts
      heartbeat/route.ts
      [id]/revoke/route.ts
    config/
      version/route.ts
      snapshot/route.ts
    usage/
      batch/route.ts
  app/admin/local-relay/
    page.tsx                      # Admin UI

docs/
  local-relay-guide.md            # User guide
  local-relay-architecture.md     # This file
```

## Testing

```bash
# Unit tests
pnpm test src/lib/config-store
pnpm test src/lib/usage/storage

# Integration test (requires cloud admin running)
ai-relay login http://localhost:3000
ai-relay local start
curl http://127.0.0.1:3147/health
curl http://127.0.0.1:3147/v1/models

# Agent test
ai-relay agent install codex --dry-run
ai-relay agent doctor codex
```

## Performance

- **Config Sync:** 30s interval, ~5KB snapshot, negligible overhead
- **Usage Upload:** 60s interval, batch of 100 events, ~50KB
- **Heartbeat:** 60s interval, ~500 bytes
- **Request Latency:** +5-10ms vs direct API call (localhost overhead)
- **Memory:** ~50MB (Node.js + SQLite)

## Comparison: Cloud vs Local

| Metric | Cloud Relay | Local Relay |
|---|---|---|
| Cold Start | ~300ms | 0ms (persistent) |
| Request Latency | +50-200ms | +5-10ms |
| Config Update | 实时 | 30s 延迟 |
| Key Security | 云端 KV | 本机 SQLite |
| Usage Tracking | 实时 | 60s 延迟 |
| 成本 | Vercel/CF 计费 | 本机资源 |
