# 调研：cc-switch 使用统计实现分析

> 调研日期：2026-09-06
> 调研对象：[farion1231/cc-switch](https://github.com/farion1231/cc-switch)（Tauri v2.8 + React 18 + TypeScript + Tailwind + shadcn/ui + Recharts + SQLite rusqlite）
> 调研目的：为 TerminalVoice v0.3「模型使用统计」功能提供可复用的实现参考。
> 主界面证据截图：[evidence/main-zh-github.png](evidence/main-zh-github.png)

---

## 一、项目定位与技术栈对照

cc-switch 是一个跨平台桌面 All-in-One 助手，为 Claude Code、Codex、OpenCode、Grok Build 等 AI CLI 工具提供统一的本地代理、模型路由、会话管理与**使用统计**。技术栈与 TerminalVoice 高度一致：

| 维度 | cc-switch | TerminalVoice（v0.2） |
| :--- | :--- | :--- |
| 桌面框架 | Tauri v2.8 | Tauri v2 |
| 前端 | React 18 + TS + Tailwind + shadcn/ui | React 19 + TS + Tailwind v4（原子组件自研） |
| 图表 | Recharts ^3.5 | 尚未引入 |
| 状态 | TanStack Query v5 | Zustand 5 |
| 数据库 | SQLite (rusqlite, WAL) | SQLite (rusqlite, WAL) |
| 高精度数 | rust_decimal | 尚未引入 |
| 事件驱动 | Tauri event `usage-log-recorded` | 已有 15 个事件，可扩展 |

**结论**：技术栈完全兼容，其数据库设计、采集架构、前端组件模式可直接借鉴。

---

## 二、存储设计（核心）

### 2.1 5 张核心表

#### ① `proxy_request_logs` 请求明细表（主事实表）

```sql
CREATE TABLE IF NOT EXISTS proxy_request_logs (
    request_id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    app_type TEXT NOT NULL,           -- Claude/Codex/Gemini 等
    model TEXT NOT NULL,              -- 上游回显的真实模型
    request_model TEXT,               -- 客户端请求的模型别名
    pricing_model TEXT,               -- 实际计价模型名（处理路由接管）
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    input_token_semantics INTEGER NOT NULL DEFAULT 0, -- 0=fresh(Claude), 1=total(OpenAI)
    input_cost_usd TEXT NOT NULL DEFAULT '0',
    output_cost_usd TEXT NOT NULL DEFAULT '0',
    cache_read_cost_usd TEXT NOT NULL DEFAULT '0',
    cache_creation_cost_usd TEXT NOT NULL DEFAULT '0',
    total_cost_usd TEXT NOT NULL DEFAULT '0',
    latency_ms INTEGER NOT NULL,
    first_token_ms INTEGER,           -- TTFT 首 token 延迟
    duration_ms INTEGER,
    status_code INTEGER NOT NULL,
    error_message TEXT,
    session_id TEXT,
    provider_type TEXT,
    is_streaming INTEGER NOT NULL DEFAULT 0,
    cost_multiplier TEXT NOT NULL DEFAULT '1.0',
    created_at INTEGER NOT NULL,      -- Unix 秒
    data_source TEXT NOT NULL DEFAULT 'proxy' -- 'proxy' | 'session_log'
);
CREATE INDEX idx_prl_provider_app ON proxy_request_logs(provider_id, app_type);
CREATE INDEX idx_prl_created_at ON proxy_request_logs(created_at);
CREATE INDEX idx_prl_model ON proxy_request_logs(model);
CREATE INDEX idx_prl_session ON proxy_request_logs(session_id);
CREATE INDEX idx_prl_status ON proxy_request_logs(status_code);
CREATE INDEX idx_prl_app_created ON proxy_request_logs(app_type, created_at DESC);
```

**设计要点**：
- **4 桶 Token 模型**：input / output / cache_read / cache_creation，分别独立计价；`input_token_semantics` 标记 input 是否已含 cache，处理 Anthropic vs OpenAI 两种语义
- **三模型字段**：`model`（回显）/ `request_model`（请求别名）/ `pricing_model`（计价基准），应对"客户端请求 A、代理转发 B、上游回显 C"的路由接管场景
- **成本字段使用 TEXT 存储 Decimal 字符串**：避免浮点误差，所有金额通过 `rust_decimal::Decimal` 高精度计算
- **性能指标三件套**：`latency_ms`（端到端）、`first_token_ms`（TTFT 首 token）、`duration_ms`（流持续时长）
- **双数据源标记**：`data_source` 区分实时代理（proxy）和事后日志扫描（session_log），配合去重账本防止双算

#### ② `model_pricing` 模型定价表

```sql
CREATE TABLE model_pricing (
    model_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    input_cost_per_million TEXT NOT NULL,         -- USD / 1M tokens
    output_cost_per_million TEXT NOT NULL,
    cache_read_cost_per_million TEXT NOT NULL DEFAULT '0',
    cache_creation_cost_per_million TEXT NOT NULL DEFAULT '0'
);
```

- 内置 `seed_model_pricing()` 通过数据库迁移预置 Claude/GPT/Gemini/DeepSeek/Kimi/GLM 等 **80+ 模型价格**
- 支持前端手动 CRUD 覆盖
- 支持从 **models.dev** 一键同步社区价格
- **价格变更后自动回填**已有明细的成本字段

#### ③ `usage_daily_rollups` 日聚合表（加速查询 + 压缩留存）

```sql
CREATE TABLE usage_daily_rollups (
    date TEXT NOT NULL,               -- YYYY-MM-DD（本地时区）
    app_type TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    request_model TEXT NOT NULL DEFAULT '',
    pricing_model TEXT NOT NULL DEFAULT '',
    request_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    input_token_semantics INTEGER NOT NULL DEFAULT 0,
    total_cost_usd TEXT NOT NULL DEFAULT '0',
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, app_type, provider_id, model, request_model, pricing_model)
);
```

**设计要点**：
- 6 维复合主键（date × app_type × provider_id × model × request_model × pricing_model），颗粒度很细
- 启动时 `rollup_and_prune(30)`：把 30 天前的明细按日聚合 INSERT 后 DELETE 明细，`PRAGMA incremental_vacuum` 回收空间
- 查询跨多天时：日聚合读"已完结历史面"，明细读"未完结今天面"，`UNION ALL` 合并——兼顾查询性能与明细精度

#### ④ `session_log_sync` + ⑤ `session_usage_dedup` 辅助表

- `session_log_sync`：字节级游标 + 尾部 SHA256 指纹，支持本地 JSONL/SQLite 日志**增量扫描**，检测外部重写/截断
- `session_usage_dedup`：跨源（proxy + session_log）去重账本，明细剪枝后仍能防双算（"丢行优于双算"原则）

---

## 三、采集架构

### 3.1 主路径：本地 HTTP 代理实时拦截

cc-switch 本质是本地反向代理，AI CLI 的 API 请求被劫持到本地端口：

```
AI CLI → localhost:PORT (cc-switch proxy) → 真实上游 API
                ↓
        边透传边攒 SSE 事件
                ↓
        流结束 → parse usage → 计价 → 写 DB → emit 事件
```

**关键机制**：
1. **`SseUsageCollector` + Drop Guard**：为每个流创建收集器，注册 `SseUsageFinishGuard`。**无论流正常结束、客户端断开还是异常，guard drop 时都会触发 `finish()`**，保证不丢数据
2. **透传中攒事件**：`create_logged_passthrough_stream` 边转发边把 SSE `data:` 事件 push 进收集器，记录首个事件时间作为 `first_token_ms`
3. **流结束统一解析**：把累积事件数组交给对应 provider 的 stream_parser（Claude/Codex/OpenAI 各一套），从不同位置取 usage：
   - Claude：`message_start` 取 input，`message_delta.usage.output_tokens` 取 output
   - Codex/OpenAI：最后一个 chunk 的 `usage` 或 `response.completed` 事件
4. **计价**：`rust_decimal::Decimal` 高精度计算，区分 Claude（fresh input）vs OpenAI（total 需扣减 cache）语义；支持 provider 级 `cost_multiplier` 加价倍率
5. **去重**：基于 `message_id` 生成稳定 request_id；`INSERT OR IGNORE`；语义冲突时退化为 `request_id:collision:{sha256}` 主键
6. **通知前端**：写完后 emit `usage-log-recorded` Tauri 事件，前端 `useUsageEventBridge` 收到后 `queryClient.invalidateQueries(usageKeys.all)`，实现实时刷新

### 3.2 补路径：本地会话日志扫描（无代理场景）

后台定期扫描各 CLI 工具的本地会话存储（Claude 的 `~/.claude/projects/*.jsonl`、Codex 的 SQLite state db、Gemini/Grok/OpenCode 的本地日志），使用字节级游标增量读取，解析 assistant 消息的 usage 字段，同计价器计价，写入同一张明细表（`data_source='session_log'`），通过 `session_usage_dedup` 防双算。

---

## 四、前端展示

### 4.1 组件结构

```
UsageDashboard.tsx               ← 主页面（筛选器 + Hero + 趋势图 + 3 Tab + 同步 + 定价）
├── UsageHero.tsx                ← 顶部 KPI 大卡
├── UsageTrendChart.tsx          ← Recharts ComposedChart 双轴趋势图
├── UsageDateRangePicker.tsx     ← 日期范围（today/7d/30d/90d/custom）
├── Tabs
│   ├── RequestLogTable.tsx      ← 请求明细（分页+筛选） → RequestDetailPanel 抽屉
│   ├── ProviderStatsTable.tsx   ← 按 Provider 聚合（请求数/token/费用/成功率/均延迟）
│   └── ModelStatsTable.tsx      ← 按模型聚合（请求数/token/费用/单次均价）
├── 会话同步卡片                  ← Sync Now + Auto Sync 开关
└── PricingConfigPanel           ← Accordion：模型定价 CRUD + models.dev 同步
```

### 4.2 UsageHero 大卡指标

- **真实消耗 Tokens**（大数字，缩写如 12.4K）
- **请求数** + **总费用**（USD 4 位小数，绿色）
- 下方 5 格 mini-stat：
  - 新增输入（蓝）
  - 输出（紫）
  - 缓存写入（琥珀）
  - 缓存命中（翠绿）
  - **缓存命中率进度条**（动画填充）= `cache_read / (fresh_input + cache_creation + cache_read)`

### 4.3 UsageTrendChart

使用 **Recharts `ComposedChart`**：
- 双 Y 轴
- 柱状图堆叠显示 token 构成（input/output/cache 分段配色）
- 折线显示 cost
- X 轴按天/小时自动粒度

### 4.4 筛选器

- App 类型分段按钮（all + 6 个 CLI 图标）
- Provider 下拉（动态从数据取）
- Model 下拉（级联）
- 自动刷新间隔（Off/5s/10s/30s/60s）
- 日期范围

### 4.5 IPC 命令（14 个，`commands/usage.rs`）

```
get_usage_summary(start?, end?, app?, provider?, model?) -> UsageSummary
get_usage_summary_by_app(...) -> Vec<UsageSummaryByApp>
get_usage_trends(...) -> Vec<DailyStats>
get_provider_stats(...) -> Vec<ProviderStats>
get_model_stats(...) -> Vec<ModelStats>
get_request_logs(filters, page, pageSize) -> PaginatedLogs
get_request_detail(requestId) -> RequestLogDetail
get_model_pricing() / update_model_pricing() / update_model_pricing_batch() / delete_model_pricing()
get_models_dev_sync_config() / save_models_dev_sync_config() / record_models_dev_sync_result()
check_provider_limits(providerId, appType) -> ProviderLimitStatus
sync_session_usage() / rebuild_codex_usage()
get_usage_data_sources() -> Vec<DataSourceSummary>
```

---

## 五、数据保留与聚合策略

| 数据 | 保留策略 |
| :--- | :--- |
| `proxy_request_logs` 明细 | **30 天滚动**（启动时 prune） |
| `usage_daily_rollups` 日聚合 | **永久保留** |
| `session_usage_dedup` 去重账本 | **永久保留**（必须） |
| `session_log_sync` 游标 | **永久保留** |
| `stream_check_logs` 连通性日志 | **7 天**滚动 |
| `backups/` 数据库备份 | 轮换保留最近 10 个 |

查询逻辑：跨多天查询时，日聚合表读"历史已完结面"，明细表读"今天未完结面"，`UNION ALL` 实时合并。不做周/月预聚合，跨月查询基于日粒度实时 SUM。

---

## 六、可直接借鉴点（对 TerminalVoice）

| 借鉴点 | 价值 |
| :--- | :--- |
| **SQLite 单文件 + rusqlite + WAL** | 与我们现有栈完全吻合，无需新依赖（rust_decimal 需新增） |
| **明细 + 日聚合双层表** | 30 天明细保留请求级细节（排查异常），日聚合永久保留（趋势图），prune 防膨胀 |
| **rust_decimal + TEXT 存 Decimal 字符串** | 成本计算零浮点误差，行业标准做法 |
| **SSE 收集器 + Drop Guard** | 我们的 LLM 已有 SSE 流式，`stream_request()` 可改造为"边转发边攒事件、Drop 时统一写统计" |
| **写完 emit Tauri 事件驱动前端刷新** | 比轮询优雅；我们前端已有统一的 `useBackendSync()` 事件桥接模式，直接加事件即可 |
| **request_id 稳定主键 + SHA256 冲突兜底** | 避免重试/重连导致重复计数 |
| **启动时 prune + incremental_vacuum** | 数据库长期使用不膨胀 |
| **Recharts ComposedChart 双轴图** | API 简洁，与 React+Tailwind 栈完美契合，比 ECharts 轻量（~70KB gzip） |
| **价格变更后回填历史成本** | 用户改价后历史费用自动重算，避免统计不一致 |
| **数据库 migration 模式（PRAGMA table_info + ALTER TABLE ADD COLUMN）** | 我们 db.rs 已有相同模式，扩展无学习成本 |

---

## 七、cc-switch 方案的不足（我们可改进）

| 不足 | 我们可以怎么做 |
| :--- | :--- |
| 无全局"清空统计"/按时间段删除 | 提供重置按钮 + 时间范围删除 |
| 无数据导出（CSV/JSON） | 实现 `export_usage_stats` 命令 |
| 无预算/告警 | 可加月度预算 + 超阈值 toast 提醒 |
| 只有日聚合，无周/月预聚合 | 数据量大时可加月聚合表 |
| 图表交互弱（无钻取、无刷选） | 点击柱形下钻到请求列表；加时间刷选 |
| 无"缓存节省了多少钱"指标 | 加 `cache_saved_cost = cache_read × (input_price - cache_read_price)` |
| 延迟只存均值，无 P50/P95/P99 分位数 | 按日聚合时记录 P50/P95（近似算法或保留样本） |
| 错误分类粗糙（只有 status_code + 文本） | 加 `error_type` 维度（network/auth/rate_limit/model_overload/timeout） |
| 无 ASR/TTS 专属指标 | 见下文"我们的差异化指标" |
| 价格硬编码在 Rust 里 | 把预置价格放 JSON 配置文件，发版外也能更新 |
| 无周/月同比/环比卡片 | 加"本周 vs 上周""本月 vs 上月"对比 |

---

## 八、我们的差异化需求（cc-switch 没覆盖）

TerminalVoice 是语音工具，统计维度比纯 LLM 代理更丰富。除 LLM token/费用外，必须覆盖：

| 模块 | 必加指标 |
| :--- | :--- |
| **ASR 语音识别** | 使用引擎（cloud/offline/auto）、模型名、录音时长(ms)、音频字节数、识别文字字数、ASR 耗时(ms)、成功率、错误类型 |
| **TTS 朗读** | 引擎、文本字符数、生成音频时长(ms)、TTS 耗时(ms)、成功率 |
| **翻译** | 源语言 → 目标语言、字符数、引擎、耗时、成功率 |
| **LLM 改写/整理/技能** | 技能 ID（英文/清单/汇报/听写）、模式（proofread/polish/structure）、模型、prompt_tokens/completion_tokens、耗时、流式 chunk 数 |
| **文本预处理** | 过滤词替换数、标点修正数、处理模式 |
| **上屏注入** | 最终注入文本长度、是否编辑过（对比 LLM 输出 vs 最终）、目标应用（app_context）、注入成功率 |
| **热键维度** | 按住说话 vs 改写模式 vs 翻译模式，三种触发路径的使用次数分布 |

**抽象原则**：不要为每个引擎单独建表，而是用**统一事件类型（event_type）+ 通用指标字段 + 可选 JSON 扩展字段**的宽表设计，详见方案文档。

---

## 九、证据索引

| 证据 | 路径 |
| :--- | :--- |
| cc-switch 中文 README 截图 | [evidence/main-zh-github.png](evidence/main-zh-github.png) |
| cc-switch 源码关键路径 | `src-tauri/src/database/schema.rs`（建表）、`src-tauri/src/proxy/usage/`（计算器/解析器/日志器）、`src-tauri/src/services/usage_stats.rs`（查询层）、`src-tauri/src/commands/usage.rs`（IPC）、`src/components/usage/`（前端组件） |
