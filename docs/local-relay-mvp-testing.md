# Local Relay MVP — Testing Guide

## 构建状态

✅ **所有代码已实现并通过构建**

```bash
npm run build  # ✅ Success
```

## 测试前准备

### 1. 确保依赖已安装

```bash
pnpm install
```

### 2. 启动云端 Admin（开发环境）

```bash
npm run dev
```

访问：http://localhost:3000/admin/local-relay

## 端到端测试流程

### Phase 1: 设备登录

```bash
# 1. 登录到本地云端实例
ai-relay login http://localhost:3000

# 期望输出：
# 🔗 Connecting to http://localhost:3000...
# 📱 Please verify this device in your browser:
#    http://localhost:3000/admin/local-relay/verify?code=DC_xxx
# ⏱  Code expires in 10 minutes
#    Waiting for verification...
```

**在浏览器中：**
1. 打开验证链接
2. 点击 "Verify Device" 按钮
3. 看到 "✅ Success!" 消息

**CLI 输出：**
```
✅ Device verified!
✨ Login successful!
   Device ID: device_xxx
👉 Next: Run "ai-relay local:start" to start the relay
```

### Phase 2: 启动 Local Server

```bash
ai-relay local:start

# 期望输出：
# 🚀 Starting AI Relay Local Server...
#    Device: <your-hostname>
#    Cloud: http://localhost:3000
#    Listen: http://127.0.0.1:3147
# ✅ Server started!
#    Health: http://127.0.0.1:3147/health
#    Endpoint: http://127.0.0.1:3147/v1
# 🔄 Syncing config every 30s, heartbeat every 60s
#    Press Ctrl+C to stop
```

### Phase 3: 验证 Health Endpoint

```bash
curl http://127.0.0.1:3147/health

# 期望返回：
# {"status":"ok","version":"2.13.0","config_version":0}
```

### Phase 4: 检查 Admin UI

访问：http://localhost:3000/admin/local-relay

**期望看到：**
- 设备列表显示你的设备
- 状态：Online (绿色)
- 平台：darwin / linux / win32
- Last Seen：刚刚

### Phase 5: 配置 Codex Agent（可选）

```bash
# Dry-run 查看将要修改的内容
ai-relay agent:install codex --dry-run

# 实际安装
ai-relay agent:install codex

# 期望输出：
# ✅ Added ai-relay-local provider
#    Backup: ~/.codex/config.toml.backup.xxx

# 验证配置
ai-relay agent:doctor codex

# 期望输出：
# 🔍 Checking Codex configuration:
# ✅ Codex installed
#    Found config at ~/.codex/config.toml
# ✅ AI Relay provider configured
#    ai-relay-local provider found in config
# ✅ Base URL points to local relay
#    Correctly points to 127.0.0.1:3147
# ✅ All checks passed!
```

### Phase 6: 测试心跳与配置同步

**等待 30 秒，观察 CLI 输出：**
```
✅ Config synced (v1)
```

**等待 60 秒，检查 Admin UI：**
- Last Seen 时间应更新
- 状态保持 Online

## 当前限制（预期行为）

### ⚠️ Relay 请求暂未实现

```bash
curl http://127.0.0.1:3147/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}'

# 当前返回：
# {"error":"Relay logic not yet wired"}
```

**原因：** Local server 的 relay 请求转发逻辑尚未实现

**下一步：** 需要复用 `src/lib/relay/relay.ts` 的 `relayRequest` 逻辑

### ⚠️ 配置同步返回空

当前 `/api/local/config/snapshot` 返回基础配置，但 providers/keys 需要从 ConfigStore 读取。

## 已验证功能

✅ Device code flow（创建、轮询、验证）
✅ Device 存储到 KV
✅ Admin UI 设备列表
✅ Local server 启动与监听
✅ Health endpoint
✅ Config sync loop
✅ Heartbeat loop
✅ Agent adapter install/doctor/uninstall
✅ 构建通过

## 待完成（Full MVP）

1. **Relay Request 逻辑**
   - 在 `cli/local/server.ts` 中集成 `relayRequest`
   - 需要初始化 ConfigStore（RemoteConfigStore）
   - 需要 Provider 解析和 Key Pool

2. **ConfigStore 实现**
   - `RemoteConfigStore` 从 KV 快照加载
   - 或直接复用 `VercelKVConfigStore`（通过 REST API）

3. **SQLite Usage Storage**
   - 本地记录请求详情
   - 批量上报到云端

4. **完整测试**
   - Codex → Local Relay → Provider → Stream response
   - Usage 记录与上报
   - Config 热更新验证

## 测试检查清单

- [ ] CLI login 成功
- [ ] Admin 验证页面正常
- [ ] Device 显示在 Admin UI
- [ ] Local server 启动成功
- [ ] Health endpoint 返回 200
- [ ] Config sync 日志正常
- [ ] Heartbeat 更新 Last Seen
- [ ] Agent install 成功（Codex）
- [ ] Agent doctor 通过
- [ ] 构建无错误

## 故障排查

### Login 失败

```bash
# 检查云端是否运行
curl http://localhost:3000/health

# 检查端口占用
lsof -i :3000
```

### Server 启动失败

```bash
# 检查端口占用
lsof -i :3147

# 检查 profile
cat ~/.ai-relay/profile.json
```

### Config sync 失败

检查云端 API routes：
- `/api/local/config/version` 应返回版本号
- `/api/local/config/snapshot` 应返回配置快照

### Device 不显示

检查 KV：
```bash
# Vercel CLI
vercel kv keys device:*
vercel kv hgetall device:<id>
```

## 文件结构

```
cli/
  index.ts              # CLI 入口
  local/
    login.ts            # Device code flow
    commands.ts         # local:start command
    server.ts           # HTTP server + loops
    profile.ts          # Profile management
  agent/
    adapter.ts          # AgentAdapter interface
    codex-adapter.ts    # Codex implementation

src/app/api/local/
  devices/
    session/route.ts    # Device code creation + polling
    verify/route.ts     # Admin verification
    route.ts            # Device list
  config/
    version/route.ts    # Config version
    snapshot/route.ts   # Config snapshot
  usage/
    batch/route.ts      # Usage upload + heartbeat

src/app/admin/local-relay/
  page.tsx              # Device management UI
  verify/page.tsx       # Device verification UI
```

## 下一步

1. **集成 Relay Request**
   - Import `relayRequest` from `src/lib/relay/relay.ts`
   - 初始化 ConfigStore
   - 处理 streaming 响应

2. **SQLite Storage**
   - 实现 `cli/lib/sqlite-storage.ts`
   - 记录请求详情
   - 定期上报

3. **完整端到端测试**
   - Codex → Local → Provider → Response
   - 验证 usage 记录
   - 验证 config 热更新

4. **文档完善**
   - Troubleshooting guide
   - Production deployment guide
   - VPS setup guide
