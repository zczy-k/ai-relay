# AI Relay Local Relay — User Guide

## Overview

AI Relay Local Relay 让你在本机运行 Relay 服务器（127.0.0.1:3147），配置从云端同步，**API keys 永不离开本机**。

## 架构

```
┌─────────────────┐         HTTPS          ┌──────────────────┐
│  Cloud Admin    │◄─────────────────────►│  Local Relay     │
│  (Vercel/CF)    │   Config Sync Only     │  (Your Machine)  │
└─────────────────┘                        └──────────────────┘
                                                    ▲
                                                    │ localhost:3147
                                                    │
                                            ┌───────┴────────┐
                                            │  Codex / Agent │
                                            └────────────────┘
```

## Installation

```bash
# From npm (when published)
npm install -g ai-relay

# Or from source
git clone https://github.com/MoyuFamily/ai-relay
cd ai-relay
pnpm install
pnpm build:cli
npm link
```

## Quick Start

### 1. Login to Cloud Admin

```bash
ai-relay login https://your-relay.vercel.app
```

浏览器会打开验证页面，点击「Connect」后 CLI 自动完成绑定。

### 2. Start Local Server

```bash
ai-relay local start
```

Server 启动在 `http://127.0.0.1:3147`，自动：
- 每 30s 从云端同步配置
- 每 60s 上传 usage 数据（聚合后，不含 prompt/completion 全文）
- 每 60s 发送心跳

### 3. Configure Agent

**Codex:**

```bash
ai-relay agent install codex
```

会在 `~/.codex/config.toml` 追加：

```toml
[model_providers.ai-relay-local]
name = "AI Relay Local"
base_url = "http://127.0.0.1:3147/v1"
wire_api = "chat"
requires_openai_auth = true
```

**Claude Code:**

```bash
ai-relay agent install claude
source ~/.ai-relay/agents/claude.env
claude
```

**OpenAI-compatible 工具:**

```bash
ai-relay agent install openai-env
source ~/.ai-relay/agents/openai.env
# 任何读取 OPENAI_BASE_URL 的工具
```

### 4. Verify

```bash
ai-relay local doctor
```

输出示例：

```
✓ Login: Device token found
✓ Config: Synced version 42 (2 providers, 5 keys)
✓ Port: Listening on 127.0.0.1:3147
✓ Chat: Test request succeeded (gpt-5.4 → OpenAI)
✓ Usage: Local DB writable
✓ Upload: Cloud reachable
```

## Commands

### Device Management

```bash
ai-relay login <cloud-url>          # Bind device
ai-relay logout                      # Unbind device
```

### Local Server

```bash
ai-relay local start                 # Start server (foreground)
ai-relay local start --daemon        # Start server (background)
ai-relay local stop                  # Stop server
ai-relay local status                # Show status
ai-relay local doctor                # Run diagnostics
```

### Agent Configuration

```bash
ai-relay agent list                  # List supported agents
ai-relay agent install <agent>       # Configure agent
ai-relay agent doctor <agent>        # Verify agent config
ai-relay agent uninstall <agent>     # Remove config
```

## Directories

```
~/.ai-relay/
  config.json          # Device profile (deviceId, token, cloudUrl)
  local.db             # SQLite (config cache, usage events)
  logs/
    ai-relay.log
  backups/
    codex-config-20260610.toml
  agents/
    claude.env
    openai.env
```

## Security

- **Device Token:** 保存在 `~/.ai-relay/config.json`，权限 `600`。MVP 明文存储，P1 迁移到 Keychain/Credential Manager。
- **API Keys:** 云端加密传输（HTTPS），本机明文存储在 SQLite `config_snapshots` 表。Local Relay 只监听 `127.0.0.1`，不对外暴露。
- **Usage Upload:** 只上传聚合数据（model, tokens, latency），不含 prompt/completion 全文。

## Troubleshooting

### Port 3147 already in use

```bash
# Check what's using it
lsof -i :3147

# Kill the process or change port (config.json)
```

### Config sync fails

```bash
ai-relay local doctor

# Check cloud admin reachable
curl https://your-relay.vercel.app/api/local/config/version \
  -H "Authorization: Bearer $(jq -r .deviceToken ~/.ai-relay/config.json)"
```

### Agent not using Local Relay

**Codex:**

```bash
# Verify config
cat ~/.codex/config.toml | grep ai-relay-local

# Check Codex is using the provider
codex --provider ai-relay-local "test"
```

**Claude Code:**

```bash
# Verify env
echo $ANTHROPIC_BASE_URL

# Should be: http://127.0.0.1:3147
```

## Comparison: Cloud vs Local

| Feature | Cloud Relay | Local Relay |
|---|---|---|
| API Keys | 在云端 KV | 在本机 SQLite |
| 延迟 | +50-200ms (跨区) | +5-10ms (localhost) |
| 冷启动 | 是（Edge Function） | 否（常驻进程） |
| 配置 | Admin UI 实时生效 | 30s 同步延迟 |
| Usage | 实时 | 60s 批量上传 |
| 成本 | Vercel/CF 计费 | 本机 CPU/内存 |

## Roadmap

- **P1:** Keychain integration (macOS/Windows)
- **P1:** Daemon mode (systemd/launchd)
- **P1:** Auto-update
- **P2:** Mac App (native GUI)
- **P2:** Docker image (VPS deployment)
- **P2:** E2E encryption (cloud 不存明文 key)

## Support

- GitHub Issues: https://github.com/MoyuFamily/ai-relay/issues
- Docs: https://github.com/MoyuFamily/ai-relay/blob/main/docs/local-relay-guide.md
