# TerminalVoice v0.3 模型使用统计功能方案

> 版本：v0.3 规划文档
> 日期：2026-09-06
> 前置调研：[2026-09-06-usage-stats-prior-art-research.md](2026-09-06-usage-stats-prior-art-research.md)
> 状态：待评审

---

## 一、目标与范围

### 1.1 功能目标

为 TerminalVoice 添加**端到端的模型使用统计**能力，让用户能直观看到：

1. **用了多少次**：语音输入、改写、翻译、TTS 各功能使用频次
2. **用了多少资源**：录音总时长、识别字数、LLM token 用量、TTS 朗读字符数
3. **花了多少钱**：LLM/云端 ASR/翻译 API 的预估费用（按用户配置的单价计算）
4. **模型表现如何**：各模型的成功率、平均延迟、按天趋势
5. **使用习惯**：按技能、按模式、按目标应用的分布

### 1.2 非目标（v0.3 不做）

- 不做云同步（数据只存本地 SQLite）
- 不做团队/多用户分摊
- 不做预算告警（预留接口，后续版本）
- 不做 cc-switch 那种"本地代理 + 会话日志扫描"双源采集（我们直接在 pipeline 埋点，逻辑简单得多）
- 不做 CSV/JSON 导出（v0.3 后续可加，预留 IPC）

### 1.3 设计原则

1. **Pipeline 内埋点，不引入代理层**：直接在 `pipeline.rs`、`llm.rs`、`asr` 调用点挂钩，不改变架构
2. **统一事件宽表**：用一张 `usage_events` 表记录所有类型事件，通过 `event_type` 区分，避免为 ASR/LLM/TTS/翻译各建一张表
3. **明细 + 日聚合双层留存**：参考 cc-switch，30 天明细 + 永久日聚合，启动时 prune
4. **不影响主链路延迟**：统计写入走独立的 `usage_logger` 线程/mpsc channel，主管线不阻塞等 DB 写入
5. **可扩展**：新功能（如未来的实时翻译、语音克隆）只需加新的 event_type 和指标字段，不改表结构
6. **高精度成本**：价格用 `rust_decimal`，金额字段 TEXT 存储
7. **前端零新增 heavy 依赖**：图表用 Recharts（~70KB gzip），不引入 ECharts/AntV

---

## 二、功能规格

### 2.1 后端数据采集

| 采集点 | 触发时机 | event_type | 采集字段 |
| :--- | :--- | :--- | :--- |
| 录音开始 | `handle_pressed()` | `recording_start` | device, timestamp |
| 录音完成（有效） | `recorder.stop()` 返回后 | `recording_end` | duration_ms, audio_bytes, device |
| ASR 完成 | `transcribe()` 返回后 | `asr_complete` | provider, model, latency_ms, success, output_chars, error_type |
| 预处理完成 | `process_text()` 返回后 | `preprocess_complete` | mode, filter_replacements, punctuation_fixes, output_chars |
| LLM 开始 | `apply_llm()` 调用前 | `llm_start` | model, skill_id, text_mode, input_chars |
| LLM 完成（流式） | SSE 流结束时（Drop guard） | `llm_complete` | model, skill_id, text_mode, prompt_tokens, completion_tokens, latency_ms, first_token_ms, chunk_count, success, error_type, output_chars |
| 预览确认 | `confirm_preview` 成功 | `inject_complete` | text_mode, final_chars, edited, app_context, asr_provider, llm_used |
| 改写完成 | `apply_rewrite_llm()` 返回后 | `rewrite_complete` | model, input_chars, output_chars, latency_ms, success |
| TTS 开始 | `tts::speak()` 调用 | `tts_start` | engine, text_chars |
| TTS 完成 | TTS 线程结束回调 | `tts_complete` | engine, text_chars, audio_duration_ms, latency_ms, success |
| 翻译完成 | 翻译 API 返回后 | `translate_complete` | engine, model, source_lang, target_lang, input_chars, output_chars, latency_ms, success |
| 模型下载 | `download_model()` 成功 | `model_installed` | model_id, size_bytes |
| 模型删除 | `delete_model()` 成功 | `model_deleted` | model_id |

### 2.2 前端展示

在现有 Service 页（ServiceTab）中新增 **"使用统计"** 区域（不新增 Tab，避免 UI 复杂度膨胀；或将 ServiceTab 的"离线模型管理"保留，下方加折叠的统计卡片），具体结构见 §五。

**核心视图**：

1. **KPI 概览大卡**：4 个大数字 + 辅助指标
   - 今日语音输入次数 / 总录音时长
   - 今日 LLM 调用次数 / 总 token 用量
   - 今日预估费用（¥，绿色）
   - 本周成功率（百分比）

2. **趋势图**（Recharts ComposedChart）
   - X 轴：按天（最近 7/30 天切换）
   - 左 Y 轴（柱）：token/字数/秒数堆叠（按功能分色）
   - 右 Y 轴（折线）：费用
   - 支持切换维度：调用次数 / token 用量 / 录音时长 / 费用

3. **三个统计子表（Tab 切换）**：
   - **模型维度**：每个模型的请求数、成功率、平均延迟、token 用量、费用
   - **功能维度**：语音输入/改写/翻译/TTS 各用了多少次、多少资源
   - **技能维度**：英文/清单/汇报/听写各用了多少次、平均每次字数

4. **请求明细列表**（折叠展示，默认不展开）：
   - 最近 50 条记录，时间倒序
   - 列：时间/类型/模型/状态/耗时/字数/token
   - 点击展开详情

5. **重置按钮**：清空所有统计数据（二次确认）

### 2.3 设置

在设置页（主窗口 #/main）增加：

- **费用显示开关**：是否在统计卡片中显示费用（默认开）
- **货币单位**：CNY / USD（默认 CNY，按固定汇率换算或用户自填汇率）
- **自定义模型单价**：编辑 LLM 模型的输入/输出单价（元/1M tokens），云端 ASR 单价（元/小时）

---

## 三、技术方案

### 3.1 依赖变更

| 依赖 | 用途 | 版本 |
| :--- | :--- | :--- |
| `rust_decimal` | 高精度金额计算 | 最新稳定版 |
| `recharts` | 前端图表 | ^3.x |

不引入其他新依赖。前端状态继续用 Zustand（不引入 TanStack Query，保持现有简洁性，轮询 + 事件驱动刷新即可）。

### 3.2 后端架构

```
pipeline.rs / llm.rs / asr / tts
        │
        │  UsageEvent::new(event_type, fields...)
        ▼
  ┌─────────────────────────┐
  │  UsageLogger (mpsc)     │  ← 独立线程，持 SQLite 连接
  │  - 接收 UsageEvent      │
  │  - 调用 CostCalculator  │
  │  - INSERT INTO usage_events
  │  - emit "usage-recorded" 事件（批量节流 1s）
  └─────────────────────────┘
        │
        ▼
  ┌─────────────────────────┐
  │  SQLite                 │
  │  - usage_events (明细)  │
  │  - usage_daily_rollups  │
  │  - model_pricing        │
  └─────────────────────────┘
        │
        ▼
  启动时：rollup_and_prune(30_days)
```

**关键设计**：
- `UsageLogger` 是一个后台线程，通过 `std::sync::mpsc::Sender<UsageEvent>` 暴露给各管线模块
- 主管线只做 `tx.send(event)`，不阻塞（channel 有界缓冲，满了就丢 debug 级 log，不影响用户）
- 批量节流：UsageLogger 内部攒 1 秒或攒够 50 条再 emit `usage-recorded` 事件，避免高频刷新前端
- 成本计算在 Logger 线程内完成，主管线不用等

### 3.3 LLM 统计的 SSE 改造

当前 `llm.rs` 的 `stream_request()` 已经在 log 中记录 `elapsed_ms` 和 `output_len`。改造：

1. `ChatResponse` / `StreamResponse` 结构体增加 `usage` 字段解析：
   ```rust
   #[derive(Debug, Deserialize)]
   struct ChatResponse {
       // ... existing fields
       usage: Option<TokenUsage>,
   }
   #[derive(Debug, Deserialize, Default)]
   struct TokenUsage {
       prompt_tokens: u32,
       completion_tokens: u32,
       total_tokens: u32,
       // OpenAI 新格式
       prompt_tokens_details: Option<PromptTokensDetails>,
       completion_tokens_details: Option<CompletionTokensDetails>,
   }
   ```
2. 流式场景：SSE 结束后，从最后一个带 `usage` 的 chunk 取 token 数（OpenAI 流式需 `stream_options: {"include_usage": true}`）
3. 返回值从 `Result<String>` 改为 `Result<LlmOutput>`，其中 `LlmOutput` 包含 text + 元数据：
   ```rust
   pub struct LlmOutput {
       pub text: String,
       pub meta: LlmMeta,
   }
   pub struct LlmMeta {
       pub model: String,
       pub prompt_tokens: u32,
       pub completion_tokens: u32,
       pub latency_ms: u64,
       pub first_token_ms: Option<u64>,
       pub chunk_count: u32,
       pub success: bool,
       pub error_type: Option<String>,
   }
   ```
4. `pipeline.rs` 的 `apply_llm()` 接收 `LlmOutput`，在预览成功/失败时构造 `UsageEvent::LlmComplete` 发给 Logger

### 3.4 ASR 统计

在 `transcribe()` 返回处包装计时与结果统计。当前 ASR 分 cloud 和 offline 两个实现：
- cloud ASR：HTTP 调用前后加 `Instant::now()`，解析响应中的字数（按 chars 计数）
- offline ASR（骨架阶段）：预留接口，推理完成后同样计时
- 返回 `AsrResultWithMeta`：包含原有 text/provider + latency_ms/model/output_chars/success/error_type

### 3.5 数据库 Migration

在 `db.rs` 中新增：
1. 新建 `usage_events`、`usage_daily_rollups`、`model_pricing` 三张表（见 §四数据模型）
2. 仿照已有 `migrate_history_columns()` 模式，在 `init_db()` 内检测表是否存在，不存在则 CREATE
3. 给 `history` 表扩展字段（可选，v0.3 可暂不做，因为 usage_events 已经包含所有信息）

**新建 Rust 文件**：
- `src-tauri/src/services/usage_logger.rs` — Logger 线程 + 发送 handle
- `src-tauri/src/services/usage_stats.rs` — 查询层（get_summary/get_trends/get_model_stats/get_events）
- `src-tauri/src/services/cost_calculator.rs` — 成本计算
- `src-tauri/src/commands/usage.rs` — IPC 命令层

### 3.6 新增 Tauri 事件

在 `services/events.rs` 中新增一个事件：
- `USAGE_RECORDED = "usage-recorded"` — 批量统计数据写入后通知前端刷新

### 3.7 新增 IPC 命令（10 个）

```rust
// 统计查询
get_usage_summary(range: TimeRange) -> UsageSummary
get_usage_trends(range: TimeRange, metric: TrendMetric) -> Vec<DailyTrend>
get_model_stats(range: TimeRange) -> Vec<ModelUsageStat>
get_feature_stats(range: TimeRange) -> Vec<FeatureUsageStat>
get_skill_stats(range: TimeRange) -> Vec<SkillUsageStat>
get_usage_events(filters: EventFilters, page: u32, page_size: u32) -> PaginatedEvents

// 定价
get_model_pricing() -> Vec<ModelPricing>
update_model_pricing(model_id: String, price: PricingInput) -> ()
reset_model_pricing(model_id: String) -> ()  // 恢复默认

// 管理
reset_usage_stats() -> ()  // 清空所有统计（二次确认）
```

### 3.8 前端改造

1. **`src/lib/types.ts`** 新增统计相关 TS 类型（UsageSummary/DailyTrend/ModelUsageStat/...）
2. **`src/lib/commands.ts`** 新增 10 个 invoke 封装
3. **`src/lib/events.ts`** 新增 `USAGE_RECORDED` 事件名
4. **`src/stores/appStore.ts`** 新增统计状态 + action：
   - `usageSummary`, `usageTrends`, `modelStats`, `featureStats`, `skillStats`, `usageEvents`
   - `loadUsageSummary(range)` / `loadUsageTrends(range, metric)` 等
   - 在 `useBackendSync()` 中监听 `usage-recorded` 事件，自动刷新当前可见数据
5. **`src/windows/panel/tabs/`** 新建：
   - `UsageSection.tsx` — 使用统计区域（嵌入 ServiceTab 或独立 Tab）
   - `UsageHero.tsx` — KPI 大卡
   - `UsageTrendChart.tsx` — Recharts 趋势图
   - `ModelStatsTable.tsx` — 模型统计表
   - `FeatureStatsTable.tsx` — 功能统计表
   - `UsageEventList.tsx` — 明细分页列表
   - `PricingEditor.tsx` — 定价编辑折叠区

---

## 四、数据模型设计（概要）

> 详细建表 SQL、索引、Rust struct 见 [2026-09-06-usage-stats-data-model.md](2026-09-06-usage-stats-data-model.md)

核心三表：

### 4.1 `usage_events`（明细表，30 天滚动）

- 主键 `id`（自增）+ `event_id`（UUID/雪花，业务幂等）
- `event_type` TEXT：`recording_start`/`recording_end`/`asr_complete`/`preprocess_complete`/`llm_start`/`llm_complete`/`inject_complete`/`rewrite_complete`/`tts_start`/`tts_complete`/`translate_complete`/`model_installed`/`model_deleted`
- 通用维度字段：`created_at`、`model`、`provider`、`skill_id`、`text_mode`、`app_context`、`success`（nullable）、`error_type`
- 通用指标字段（INTEGER，按事件类型填 0/NULL）：
  - `duration_ms` / `latency_ms` / `first_token_ms`
  - `input_chars` / `output_chars`
  - `input_tokens` / `output_tokens`
  - `audio_duration_ms` / `audio_bytes`
  - `chunk_count`
  - `source_lang` / `target_lang`
- 成本字段（TEXT Decimal 字符串）：`input_cost`/`output_cost`/`total_cost`（统一 CNY，固定字段不按 token 类型拆分——我们初期没有 cache 计费需求）
- 扩展字段：`extra_json` TEXT（JSON 字符串，存放未来扩展的事件专属字段，不改表结构）

索引：`created_at`、`event_type`、`model`、`(event_type, created_at)`

### 4.2 `usage_daily_rollups`（日聚合，永久保留）

- 主键 `(date, event_type, model, provider, skill_id)`
- 聚合指标：`event_count`、`success_count`、`sum_input_chars`/`sum_output_chars`、`sum_input_tokens`/`sum_output_tokens`、`sum_duration_ms`/`sum_latency_ms`、`sum_audio_duration_ms`、`sum_cost_cny`、`avg_latency_ms`

### 4.3 `model_pricing`（模型定价）

- 预置常见 LLM（本地配置的默认云端模型）+ 云端 ASR 的默认价格（可被用户覆盖）
- 字段：`model_id`、`display_name`、`pricing_type`（`per_million_tokens`/`per_hour_audio`/`per_1k_chars`）、`input_unit_price_cny`、`output_unit_price_cny`、`updated_at`、`is_user_defined`

---

## 五、UI 方案（线框描述）

### 5.1 在 ServiceTab 内新增「使用统计」折叠区

ServiceTab 当前结构：
```
[语音识别 ASR 配置]
[AI 整理 LLM 配置]
[翻译目标语言]
[离线模型管理]
```

改造为：
```
[语音识别 ASR 配置]
[AI 整理 LLM 配置]
[翻译目标语言]
[离线模型管理]
[使用统计 ▼]  ← Accordion 折叠区，默认展开
  ┌─────────────────────────────────────────────┐
  │ [今天] [7天] [30天] [自定义]  [重置统计]    │
  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
  │ │ 输入  │ │ LLM  │ │ 费用  │ │ 成功率│       │
  │ │ 12次  │ │ 8次  │ │¥0.12 │ │ 100% │        │
  │ │ 3.2分 │ │12.4K │ │       │       │        │
  │ └──────┘ └──────┘ └──────┘ └──────┘        │
  │ [趋势图：柱状+折线]                          │
  │ [模型] [功能] [技能] ← Tab                  │
  │  ┌───────────────────────────────┐          │
  │  │ 模型        调用  成功率  延迟  │ ...     │
  │  └───────────────────────────────┘          │
  │ [定价设置 ▼] [最近记录 ▼]                    │
  └─────────────────────────────────────────────┘
```

### 5.2 视觉规范

- 沿用现有 Tailwind v4 tokens（`bg-card`、`text-card-foreground`、`radius-md`、`shadow-card`）
- 颜色映射：
  - ASR/录音：蓝色系（`bg-sky-500/10 text-sky-600 dark:text-sky-400`）
  - LLM：紫色系（`bg-violet-500/10 text-violet-600 dark:text-violet-400`，与现有 rewrite 主题一致）
  - TTS：翡翠色（`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`）
  - 翻译：琥珀色（`bg-amber-500/10 text-amber-600 dark:text-amber-400`）
  - 费用：绿色（`text-green-600 dark:text-green-400`）
  - 错误/失败：红色（`text-red-500`）

---

## 六、分期实施计划

### Phase 1：数据采集基础（后端优先）

1. DB 迁移：新建 `usage_events`、`usage_daily_rollups`、`model_pricing` 表 + 预置价格
2. 实现 `UsageLogger` 线程 + mpsc 通道
3. 改造 `llm.rs`：解析 usage 字段、返回 `LlmMeta`、流式 drop guard 发送 `llm_complete`
4. 改造 `pipeline.rs`：在关键节点发送 `recording_end`/`asr_complete`/`llm_start`/`llm_complete`/`inject_complete` 事件
5. 实现 `CostCalculator`
6. 启动时 `rollup_and_prune(30_days)` + `usage-recorded` 事件
7. 新增 IPC：`get_usage_summary`/`reset_usage_stats`
8. **单元测试**：Logger 线程、CostCalculator、rollup 逻辑

### Phase 2：前端基础展示

1. 新增 TS 类型 + commands 封装
2. appStore 新增 usage state + load actions
3. 监听 `usage-recorded` 事件自动刷新
4. 实现 `UsageHero` + 简单的数字展示（无图表）
5. 嵌入 ServiceTab 折叠区

### Phase 3：完整视图 + 多维度统计

1. 引入 Recharts，实现 `UsageTrendChart`
2. 实现模型/功能/技能三个统计表 Tab
3. 实现 `UsageEventList` 明细分页
4. 补全 TTS/翻译/改写的采集点
5. 定价设置面板（查看 + 编辑价格）

### Phase 4：打磨与验证

1. 错误处理边界（Logger 通道满、DB 写入失败、price 缺省）
2. 性能验证（高频使用场景下 DB 写入不阻塞主线程）
3. 单元测试补全（查询聚合 SQL、prune 逻辑）
4. 文档同步：更新 `docs/CODE_MAP.md`、`docs/IPC_API.md`

---

## 七、风险与应对

| 风险 | 应对 |
| :--- | :--- |
| LLM 供应商不返回 usage 字段（部分兼容 API） | fallback：用 `(prompt_chars / 1.5)` 粗略估算中文 token，或标记为 estimated |
| 高频使用时 mpsc channel 满 | 有界 channel（容量 1000），满了打 warn log 丢弃事件，绝不能阻塞主管线 |
| 离线 ASR 无云费用 | cost=0，在 UI 标注"本地模型，无费用" |
| 用户自定义模型名无法匹配定价 | 定价 UI 允许用户手动关联模型 ID 和价格，未配置则费用显示 N/A |
| 数据库 prune 导致查询边界不连续 | UNION ALL 时用 `date < '今天'` 走 rollup，`date >= '今天'` 走 events，边界明确 |
| 时间范围较大时 SUM 日聚合慢 | 日聚合表 6 维主键，索引完备；单用户年数据量级 < 10 万行，无性能风险 |

---

## 八、验收标准

1. 完成一次语音输入（按住说话 → 识别 → LLM 整理 → 预览确认）后，`usage_events` 表中有 5 条记录（recording_end/asr_complete/preprocess_complete/llm_complete/inject_complete），字段齐全
2. 前端 ServiceTab 统计区实时刷新，数字正确
3. 趋势图能正确显示最近 7 天数据
4. 关闭应用 30 天后重启，明细被 prune 到日聚合表，历史趋势数据不丢失
5. 修改某模型价格后，历史记录费用重新计算（可选，v0.3 初版可只对新数据生效）
6. 重置统计按钮可清空所有数据
7. Logger 线程 panic 或 DB 写入失败不影响语音输入主流程（降级为只打 log）
8. 单元测试覆盖 Logger、CostCalculator、rollup 核心逻辑
