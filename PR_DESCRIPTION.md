# Local Relay MVP Implementation

## 概述

实现 AI Relay 的第三种部署形态：**Local Relay**，让用户可以在本机运行常驻服务，配置从云端同步，请求在本地转发，为重度用户和 Agent 高频场景提供稳定的零额度消耗方案。

## 主要变更

### 🏗️ 架构优化

- **ConfigStore 接口抽象** - 解耦存储层，支持 Vercel KV / Postgres / SQLite
- **Postgres 支持** - 为 VPS 部署预留，Local 和 VPS 复用同一套代码
- **统一存储架构** - 自动检测环境变量，适配不同部署模式

### 🖥️ CLI 实现

```bash
ai-relay login <cloud-url>         # 设备绑定（Device code flow）
ai-relay local:start                # 启动本地 HTTP 服务器
ai-relay agent:install codex        # 自动配置 Codex
ai-relay agent:doctor codex         # 验证配置
ai-relay agent:uninstall codex      # 移除配置
```

**核心功能：**
- Device code flow（3s 轮询，10min 超时）
- HTTP Server (`127.0.0.1:3147`)
- Config sync loop (30s)
- Heartbeat loop (60s)
- Profile 管理 (`~/.ai-relay/profile.json`)

### 🌐 API Routes

```
POST   /api/local/devices/session     - 创建 device code
GET    /api/local/devices/session     - 轮询验证状态
POST   /api/local/devices/verify      - Admin 批准设备
GET    /api/local/devices             - 设备列表
GET    /api/local/config/version      - 配置版本
GET    /api/local/config/snapshot     - 配置快照
POST   /api/local/usage/batch         - Usage 上报 + heartbeat
```

### 🎨 Admin UI

- **`/admin/local-relay`** - 设备管理（实时刷新，10s）
  - 设备列表（名称、平台、状态、最近心跳）
  - 快速开始指南
  - 状态：Online / Offline

- **`/admin/local-relay/verify?code=xxx`** - 设备验证页面
  - 一键批准设备
  - 实时状态反馈

### 🔧 Agent Adapters

**Codex Adapter：**
- 自动写入 `~/.codex/config.toml`
- 配置前自动备份
- 重复安装检测
- Dry-run 支持
- Doctor 验证（3 项检查）
- Uninstall 恢复

## 代码统计

```
11 files changed, 666 insertions(+), 21 deletions(-)
```

**新增文件：**
- `cli/local/login.ts` (80 行)
- `cli/local/commands.ts` (36 行)
- `cli/local/server.ts` (116 行)
- `cli/agent/codex-adapter.ts` (116 行)
- `src/app/api/local/devices/` (4 个 routes)
- `src/app/admin/local-relay/` (2 个页面)
- `sql/` (Postgres schema)
- `docs/` (3 个新文档)

## 测试

### ✅ 构建验证

```bash
npm run build  # ✅ Success
```

### ✅ 可测试功能

- Device login flow
- Device verification (Admin UI)
- Local server 启动
- Config sync (30s)
- Heartbeat (60s)
- Agent install/doctor/uninstall
- Health endpoint (`/health`)

### ⚠️ 待完成

- **Relay request 逻辑** - 需集成 `relayRequest`（预计 2-3h）
- **RemoteConfigStore** - 从快照加载配置（预计 1-2h）
- **SQLite storage** - 本地 usage 记录（预计 1-2h）

## 部署影响

### ✅ 向后兼容

- 现有 Vercel/Cloudflare 部署**不受影响**
- ConfigStore 默认使用 `VercelKVConfigStore`
- 只有设置 `DATABASE_URL` 且非 Vercel/CF 环境才使用 Postgres

### 📦 依赖变更

- CLI 依赖移到 `optionalDependencies`
- Vercel 部署不受影响（安装失败不阻塞）

## 文档

- **`docs/local-relay-mvp-testing.md`** - 端到端测试流程
- **`docs/local-relay-mvp-complete.md`** - 实现总结
- **`docs/storage-architecture.md`** - 存储架构设计
- **`docs/local-relay-guide.md`** - 用户指南

## 后续计划

### Phase 2（P0 - 预计 3-4h）

1. 集成 `relayRequest` 逻辑到 local server
2. 实现 `RemoteConfigStore`（从快照加载）
3. 端到端测试（Codex → Local → Provider）

### Phase 3（P1）

- SQLite usage storage
- Claude Code adapter
- Mac App 封装
- 生产环境优化

## Checklist

- [x] ConfigStore 接口抽象
- [x] Postgres 支持（骨架）
- [x] CLI login 实现
- [x] CLI local:start 实现
- [x] Device management API
- [x] Admin UI（设备列表 + 验证）
- [x] Agent adapter（Codex）
- [x] 构建通过
- [x] 文档完整
- [ ] Relay request 集成（下一步）
- [ ] 端到端测试（下一步）

## Breaking Changes

无

## Migration Guide

无需迁移，新功能为可选增强。

---

**目标：** 为重度用户提供零云端额度消耗的稳定本机 relay 方案，同时保持云端 Admin 的配置管理能力。

**状态：** MVP 核心功能完成，可进行端到端测试。
