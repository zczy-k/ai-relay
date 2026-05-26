# AI API 中转站 — 技术方案

> 版本：v1.0
> 日期：2026-05-21
> 作者：码飞（技术总监）

---

## 一、架构概览

```
客户端 (OpenAI SDK / curl)
  │
  ▼
POST /v1/chat/completions
  │
  ▼
┌─────────────────────────────────────┐
│  Vercel Edge Function               │
│  (Next.js App Router + Edge Runtime)│
│                                     │
│  1. 解析请求 → 识别 model 前缀      │
│  2. Provider 路由                   │
│  3. Key 轮换 (round-robin)          │
│  4. 转发请求到上游 API              │
│  5. 流式/非流式响应透传             │
│  6. 用量记录到 KV                   │
└──────────┬──────────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
 Vercel KV    上游 AI API
 (Redis)      - OpenAI (gpt-*)
              - Anthropic (claude-*)
              - DeepSeek (deepseek-*)
              - Xiaomi (mimo-*)
```

## 二、项目结构

```
ai-relay/
├── docs/
│   ├── ALTERNATIVES.md        # 调研文档
│   └── TECH-DESIGN.md         # 本文档
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 根布局
│   │   ├── page.tsx           # 首页（状态展示）
│   │   └── api/
│   │       └── v1/
│   │           └── chat/
│   │               └── completions/
│   │                   └── route.ts  # 核心接口
│   └── lib/
│       ├── providers.ts       # Provider 定义 + 路由映射
│       ├── key-manager.ts     # Key 池管理 + 轮换
│       ├── usage.ts           # 用量追踪 (KV)
│       ├── relay.ts           # 请求转发核心逻辑
│       └── types.ts           # 类型定义
├── .env.local.example         # 环境变量模板
├── next.config.ts             # Next.js 配置
├── tsconfig.json              # TypeScript 配置
├── vercel.json                # Vercel 部署配置
├── package.json
└── README.md
```

## 三、API 设计

### 3.1 核心接口：POST /v1/chat/completions

**完全兼容 OpenAI Chat Completions API**，客户端可以用 OpenAI SDK 直接对接。

请求格式：
```json
{
  "model": "gpt-5.4",           // 前缀决定路由到哪个 Provider
  "messages": [...],
  "stream": true/false,
  "temperature": 0.7,
  // ... 其他 OpenAI 兼容参数
}
```

**模型路由规则**（按 model 前缀匹配）：

| model 前缀 | Provider | 上游 URL |
|-----------|----------|---------|
| `gpt-*` | OpenAI | `https://api.openai.com/v1/chat/completions` |
| `gpt-5.5-*`, `gpt-5.4-*` | OpenAI | 同上 |
| `claude-*` | Anthropic | `https://api.anthropic.com/v1/messages` |
| `deepseek-*` | DeepSeek | `https://api.deepseek.com/v1/chat/completions` |
| `mimo-*` | Xiaomi | `https://api.xiaomi.com/v1/chat/completions` |

**流式支持**：支持 `stream: true`，使用 SSE (Server-Sent Events) 透传。

### 3.2 认证

请求头 `Authorization: Bearer <RELAY_API_KEY>` 验证客户端身份。
`RELAY_API_KEY` 存储在环境变量中，支持逗号分隔多个 key。

## 四、核心模块设计

### 4.1 Provider 路由 (`providers.ts`)

```typescript
interface ProviderConfig {
  name: string;
  baseUrl: string;
  modelPrefixes: string[];    // 匹配的 model 前缀
  headerFormat: 'openai' | 'anthropic';  // 认证头格式
  transformRequest?: Function;  // 请求体转换（Anthropic 需要）
  transformResponse?: Function; // 响应体转换
}
```

### 4.2 Key 管理 (`key-manager.ts`)

Key 存储格式（环境变量）：
```
OPENAI_KEYS=sk-xxx1,sk-xxx2,sk-xxx3
CLAUDE_KEYS=sk-ant-xxx1,sk-ant-xxx2
DEEPSEEK_KEYS=sk-xxx1
XIAOMI_KEYS=xxx1
```

轮换策略：
- **Round-Robin**：KV 存储 `{provider}:counter`，每次请求自增取模
- **故障跳过**：429/5xx 时自动切下一个 key，记录 cooldown
- **Cooldown**：KV 存储 `{provider}:{key_hash}:cooldown`，TTL 60s

### 4.3 用量追踪 (`usage.ts`)

KV Key 设计：
```
usage:{key_hash}:daily:2026-05-21  → { requests: N, tokens: N }
usage:{key_hash}:total             → { requests: N, tokens: N }
usage:daily:2026-05-21             → { requests: N, tokens: N }
```

每次请求完成后异步记录（不阻塞响应）。

### 4.4 请求转发 (`relay.ts`)

核心流程：
1. 解析 Authorization → 验证 RELAY_API_KEY
2. 解析 model → 匹配 Provider
3. 选择 API Key（轮换）
4. 构造上游请求（适配 Provider 认证格式）
5. 转发请求（支持流式透传）
6. 解析响应 → 记录用量
7. 返回响应

## 五、技术约束

| 约束 | 应对 |
|------|------|
| Edge Runtime 不支持 Node.js API | 全部使用 Web API (fetch, ReadableStream 等) |
| Edge Runtime 不能 npm install 原生模块 | 纯 JS/TS 实现，无原生依赖 |
| Vercel KV 每日免费 3000 次请求 | 用量追踪使用批量写入 / 降级方案 |
| Vercel Edge 函数 30s 超时 | 流式响应无此限制 |
| KV 单次写入限制 | 使用简单的 JSON 字符串存储 |

## 六、环境变量

```env
# 认证
RELAY_API_KEY=your-secret-key

# Provider Keys
OPENAI_KEYS=sk-xxx1,sk-xxx2
CLAUDE_KEYS=sk-ant-xxx1,sk-ant-xxx2
DEEPSEEK_KEYS=sk-xxx1
XIAOMI_KEYS=xxx1

# 可选配置
OPENAI_BASE_URL=https://api.openai.com  # 自定义 base URL
CLAUDE_BASE_URL=https://api.anthropic.com

# 额度控制（可选，0 或不设置 = 不限制）
RELAY_DAILY_LIMIT=1000      # 每日最大请求数
RELAY_MONTHLY_LIMIT=30000   # 每月最大请求数
```

## 七、交付计划

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0.1 | 项目初始化 + 基础结构 | ✅ 已完成 |
| P0.2 | /v1/chat/completions 接口（单 Provider） | ✅ 已完成 |
| P0.3 | 多 Provider 路由（OpenAI/Claude/DeepSeek/MiMo） | ✅ 已完成 |
| P0.4 | Key 轮换 + 429 故障重试 | ✅ 已完成 |
| P0.5 | 用量追踪（Vercel KV） | ✅ 已完成 |
| P0.6 | 流式响应（SSE 透传） | ✅ 已完成 |
| P1.1 | 模型别名映射（gpt-latest → gpt-5.4 等） | ✅ 已完成 |
| P1.2 | 额度控制（每日/每月上限 + 429 超限提示） | ✅ 已完成 |
| P1.3 | 管理面板（/admin — Key 池状态 + 用量统计） | ✅ 已完成 |
