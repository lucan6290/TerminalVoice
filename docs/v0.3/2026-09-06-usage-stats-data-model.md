# TerminalVoice v0.3 使用统计 — 数据模型详细设计

> 日期：2026-09-06
> 配套文档：[2026-09-06-usage-stats-plan.md](2026-09-06-usage-stats-plan.md)
> 本文档给出精确的建表 SQL、Rust/TS 结构体、字段语义、成本计算公式，作为后续编码依据。

---

## 一、Schema 总览

```
SQLite (WAL 模式)
├── usage_events            -- 明细事件表（30 天滚动，主事实表）
├── usage_daily_rollups     -- 日聚合表（永久保留）
└── model_pricing           -- 模型单价配置表
```

三张表都在现有 `terminalvoice.db` 中，不新建数据库文件。所有金额字段统一为 **TEXT**，存储 `rust_decimal::Decimal` 的字符串形式（如 `"0.0012"`、`"12.50"`），单位 **人民币（CNY，元）**。

---

## 二、表 1：`usage_events` 明细事件表

### 2.1 建表 SQL

```sql
CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,           -- 幂等 ID（UUID v4），防重试双写
    event_type TEXT NOT NULL,                -- 事件类型，见 §2.3
    created_at TEXT NOT NULL,                -- RFC3339（本地时区，如 2026-09-06T17:30:00+08:00）

    -- ── 通用维度 ──
    provider TEXT,                           -- 提供商/引擎（cloud/offline/azure-edge/...）
    model TEXT,                              -- 模型名（asr_model 或 llm_model 的实际值）
    skill_id TEXT,                           -- 技能 ID（english/checklist/report/dictation），无技能为 NULL
    text_mode TEXT,                          -- off/proofread/polish/structure
    app_context TEXT,                        -- 前台应用信息（从 get_foreground_app_context 取）
    source_lang TEXT,                        -- 翻译源语言
    target_lang TEXT,                        -- 翻译目标语言

    -- ── 结果 ──
    success INTEGER,                         -- 1=成功 0=失败 NULL=未到结果阶段（start 类事件）
    error_type TEXT,                         -- network/auth/rate_limit/model_overload/timeout/unknown

    -- ── 时间/性能（INTEGER，毫秒；不适用的事件类型填 NULL） ──
    duration_ms INTEGER,                     -- 端到端耗时（录音时长 / TTS 音频时长）
    latency_ms INTEGER,                      -- API/推理响应耗时
    first_token_ms INTEGER,                  -- TTFT，仅流式 LLM

    -- ── 数据量 ──
    input_chars INTEGER,                     -- 输入字符数（ASR 输出文字 / LLM 输入 / 翻译源 / TTS 文本）
    output_chars INTEGER,                    -- 输出字符数（LLM 输出 / 翻译译文）
    input_tokens INTEGER,                    -- LLM prompt tokens
    output_tokens INTEGER,                   -- LLM completion tokens
    audio_duration_ms INTEGER,               -- 音频时长（TTS 生成音频 / 录音）
    audio_bytes INTEGER,                     -- 音频字节数
    chunk_count INTEGER,                     -- SSE 流式 chunk 数

    -- ── 成本（TEXT Decimal，CNY，元） ──
    input_cost_cny TEXT NOT NULL DEFAULT '0',
    output_cost_cny TEXT NOT NULL DEFAULT '0',
    total_cost_cny TEXT NOT NULL DEFAULT '0',

    -- ── 扩展 ──
    extra_json TEXT                          -- 事件专属字段的 JSON（未来扩展，不改表结构）
);

-- ── 索引 ──
CREATE INDEX IF NOT EXISTS idx_ue_created_at     ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_event_type     ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ue_model          ON usage_events(model);
CREATE INDEX IF NOT EXISTS idx_ue_type_created   ON usage_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_provider_model ON usage_events(provider, model);
```

### 2.2 字段填充规则（按 event_type）

| event_type | 必填字段 | 可选/填 0/NULL 的字段 |
| :--- | :--- | :--- |
| `recording_start` | event_id, created_at, app_context | provider/model=NULL, success=NULL, 所有数值=NULL, cost=0 |
| `recording_end` | created_at, duration_ms(录音时长), audio_bytes, app_context | provider/model 稍后由 asr_complete 关联；success=NULL |
| `asr_complete` | created_at, provider, model, success, latency_ms, output_chars | input_chars=NULL（ASR 无输入字符），tokens 全 NULL |
| `preprocess_complete` | created_at, text_mode, input_chars(=ASR 字数), output_chars(=预处理后) | model/provider=NULL；extra_json 可放 filter_replacements/punctuation_fixes |
| `llm_start` | created_at, model, skill_id, text_mode, input_chars | success=NULL, latency=NULL |
| `llm_complete` | created_at, model, skill_id, text_mode, success, latency_ms, first_token_ms(流式), chunk_count(流式), input_chars, output_chars, input_tokens, output_tokens, total_cost_cny | error_type（失败时填） |
| `inject_complete` | created_at, text_mode, output_chars(final_chars), app_context, success | input_chars=LLM 输出字数（用于计算 edited），extra_json: `{"edited": true/false, "asr_provider": "...", "llm_used": true/false}` |
| `rewrite_complete` | created_at, model, success, latency_ms, input_chars, output_chars, input_tokens, output_tokens, total_cost_cny | skill_id=NULL, text_mode=NULL |
| `tts_start` | created_at, provider(=tts_engine) | success=NULL |
| `tts_complete` | created_at, provider, success, latency_ms, input_chars(=朗读文本), audio_duration_ms, audio_bytes | output_chars=NULL, tokens=NULL |
| `translate_complete` | created_at, provider, model(=翻译模型), source_lang, target_lang, success, latency_ms, input_chars, output_chars, total_cost_cny | tokens 可填（若翻译用 LLM），audio=NULL |
| `model_installed` | created_at, model(model_id), extra_json: `{"size_bytes": N}` | provider="offline-asr", success=1, 其他数值=NULL |
| `model_deleted` | created_at, model(model_id) | provider="offline-asr", success=1, 其他=NULL |

> **关于事件关联**：单次语音输入会产生 5~6 条 event。不需要外键关联（太复杂），查询时按 `created_at` 时间窗口（±5 秒）+ `model/provider` 聚合即可；明细列表单条展示时只看 `*_complete` 类事件，`*_start` 仅用于性能分析。

### 2.3 event_type 枚举

```rust
pub enum EventType {
    // 语音输入主链路
    RecordingStart,
    RecordingEnd,
    AsrComplete,
    PreprocessComplete,
    LlmStart,
    LlmComplete,
    InjectComplete,

    // 其他功能
    RewriteComplete,
    TtsStart,
    TtsComplete,
    TranslateComplete,

    // 模型管理
    ModelInstalled,
    ModelDeleted,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RecordingStart     => "recording_start",
            Self::RecordingEnd       => "recording_end",
            Self::AsrComplete        => "asr_complete",
            Self::PreprocessComplete => "preprocess_complete",
            Self::LlmStart           => "llm_start",
            Self::LlmComplete        => "llm_complete",
            Self::InjectComplete     => "inject_complete",
            Self::RewriteComplete    => "rewrite_complete",
            Self::TtsStart           => "tts_start",
            Self::TtsComplete        => "tts_complete",
            Self::TranslateComplete  => "translate_complete",
            Self::ModelInstalled     => "model_installed",
            Self::ModelDeleted       => "model_deleted",
        }
    }
}
```

### 2.4 error_type 枚举

```
network          -- 网络连接失败（DNS/TCP/TLS/超时）
auth             -- 认证失败（401/403，key 错误或余额不足）
rate_limit       -- 限流（429）
model_overload   -- 模型过载/服务不可用（503/529）
timeout          -- 请求超时（客户端设置的超时）
invalid_response -- 响应解析失败/格式错误
audio_too_short  -- 音频过短（已在状态机处理，统计时单独标记）
audio_error      -- 录音设备错误
cancelled        -- 用户取消（Esc）
unknown          -- 其他
```

---

## 三、表 2：`usage_daily_rollups` 日聚合表

### 3.1 建表 SQL

```sql
CREATE TABLE IF NOT EXISTS usage_daily_rollups (
    date TEXT NOT NULL,                     -- YYYY-MM-DD（本地时区）
    event_type TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    skill_id TEXT NOT NULL DEFAULT '',

    -- ── 聚合指标 ──
    event_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,

    sum_input_chars INTEGER NOT NULL DEFAULT 0,
    sum_output_chars INTEGER NOT NULL DEFAULT 0,
    sum_input_tokens INTEGER NOT NULL DEFAULT 0,
    sum_output_tokens INTEGER NOT NULL DEFAULT 0,
    sum_audio_duration_ms INTEGER NOT NULL DEFAULT 0,
    sum_duration_ms INTEGER NOT NULL DEFAULT 0,
    sum_latency_ms INTEGER NOT NULL DEFAULT 0,
    sum_cost_cny TEXT NOT NULL DEFAULT '0',
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,  -- 整数近似，写入时 = sum_latency_ms / success_count

    PRIMARY KEY (date, event_type, provider, model, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_udr_date        ON usage_daily_rollups(date DESC);
CREATE INDEX IF NOT EXISTS idx_udr_type_date   ON usage_daily_rollups(event_type, date DESC);
CREATE INDEX IF NOT EXISTS idx_udr_model_date  ON usage_daily_rollups(model, date DESC);
```

### 3.2 rollup 算法（启动时执行）

```
cutoff_date = today - 30 days

1. INSERT OR REPLACE INTO usage_daily_rollups
   SELECT
     date(created_at) AS date,
     event_type,
     IFNULL(provider, ''),
     IFNULL(model, ''),
     IFNULL(skill_id, ''),
     COUNT(*),
     SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END),
     IFNULL(SUM(input_chars), 0),
     IFNULL(SUM(output_chars), 0),
     IFNULL(SUM(input_tokens), 0),
     IFNULL(SUM(output_tokens), 0),
     IFNULL(SUM(audio_duration_ms), 0),
     IFNULL(SUM(duration_ms), 0),
     IFNULL(SUM(latency_ms), 0),
     CAST(IFNULL(SUM(CAST(total_cost_cny AS REAL)), 0) AS TEXT),
     CAST(IFNULL(AVG(latency_ms), 0) AS INTEGER)
   FROM usage_events
   WHERE date(created_at) <= date(cutoff_date, 'localtime')
     AND success IS NOT NULL           -- 排除 start 类无结果事件
   GROUP BY date, event_type, IFNULL(provider, ''), IFNULL(model, ''), IFNULL(skill_id, '')
   ON CONFLICT(date, event_type, provider, model, skill_id) DO UPDATE SET
     event_count        = excluded.event_count,
     success_count      = excluded.success_count,
     sum_input_chars    = excluded.sum_input_chars,
     sum_output_chars   = excluded.sum_output_chars,
     sum_input_tokens   = excluded.sum_input_tokens,
     sum_output_tokens  = excluded.sum_output_tokens,
     sum_audio_duration_ms = excluded.sum_audio_duration_ms,
     sum_duration_ms    = excluded.sum_duration_ms,
     sum_latency_ms     = excluded.sum_latency_ms,
     sum_cost_cny       = excluded.sum_cost_cny,
     avg_latency_ms     = excluded.avg_latency_ms;

2. DELETE FROM usage_events
   WHERE date(created_at) <= date(cutoff_date, 'localtime');

3. PRAGMA incremental_vacuum;
```

> **注意**：SQLite 的 `IFNULL(SUM(CAST(total_cost_cny AS REAL)), 0)` 会把 TEXT Decimal 转 REAL 累加后再存回 TEXT，理论有浮点误差。改进方案：在 Rust 端遍历结果集用 `rust_decimal` 累加后批量 INSERT（因为日聚合数据量小，一次性加载到内存没问题）。上述 SQL 仅作为思路，实际实现走 Rust 端循环 + Decimal 累加。

### 3.3 查询时 UNION 合并

```sql
-- 查询 [start, end] 范围按天按 event_type 的聚合
SELECT date, event_type, SUM(event_count), SUM(success_count),
       SUM(sum_input_chars), SUM(sum_output_chars),
       SUM(sum_input_tokens), SUM(sum_output_tokens),
       SUM(sum_audio_duration_ms), SUM(sum_duration_ms), SUM(sum_latency_ms)
FROM usage_daily_rollups
WHERE date BETWEEN ? AND ?
GROUP BY date, event_type

UNION ALL

SELECT date(created_at) AS date, event_type,
       COUNT(*), SUM(CASE WHEN success=1 THEN 1 ELSE 0 END),
       IFNULL(SUM(input_chars),0), IFNULL(SUM(output_chars),0),
       IFNULL(SUM(input_tokens),0), IFNULL(SUM(output_tokens),0),
       IFNULL(SUM(audio_duration_ms),0), IFNULL(SUM(duration_ms),0),
       IFNULL(SUM(latency_ms),0)
FROM usage_events
WHERE date(created_at) BETWEEN ? AND ? AND success IS NOT NULL
GROUP BY date(created_at), event_type;
```

成本列（TEXT Decimal）不能用 SQL SUM，需在 Rust 端 Decimal 累加（从两个表分别 SELECT 出来后 Rust 端求和）。

---

## 四、表 3：`model_pricing` 模型定价表

### 4.1 建表 SQL

```sql
CREATE TABLE IF NOT EXISTS model_pricing (
    model_id TEXT PRIMARY KEY,             -- 唯一标识，与 ServiceConfig 中的 model 字段匹配
    display_name TEXT NOT NULL,
    pricing_type TEXT NOT NULL,            -- 'per_million_tokens' | 'per_hour_audio' | 'per_1k_chars'
    scope TEXT NOT NULL DEFAULT 'llm',     -- 'llm' | 'asr_cloud' | 'tts' | 'translate'
    input_unit_price_cny TEXT NOT NULL DEFAULT '0',   -- 单价（CNY）：per_million_tokens=元/1M输入token
    output_unit_price_cny TEXT NOT NULL DEFAULT '0',  -- per_million_tokens=元/1M输出token；其他 pricing_type 不使用
    updated_at TEXT NOT NULL,
    is_user_defined INTEGER NOT NULL DEFAULT 0        -- 0=系统预置，1=用户自定义/覆盖
);

CREATE INDEX IF NOT EXISTS idx_mp_scope ON model_pricing(scope);
```

### 4.2 pricing_type 语义

| pricing_type | 适用场景 | 计费公式 |
| :--- | :--- | :--- |
| `per_million_tokens` | LLM（云/中转）、基于 LLM 的翻译 | `cost = (input_tokens × input_price + output_tokens × output_price) / 1_000_000` |
| `per_hour_audio` | 云端 ASR（如按音频时长计费） | `cost = audio_duration_ms / 3_600_000 × input_price`（output_price 不用） |
| `per_1k_chars` | TTS（按字符计费）、部分翻译服务 | `cost = input_chars / 1000 × input_price` |

### 4.3 预置价格（seed，可被用户覆盖）

以下价格为参考值（2026-09 市价，人民币），用户可在 UI 修改；实际使用时如果用户配置了自定义 endpoint/model，需要手动配置价格。

```rust
fn seed_model_pricing() -> Vec<ModelPricing> {
    vec![
        // ── LLM（示例，实际按用户配置为主） ──
        model("deepseek-chat", "DeepSeek-V3", "llm",
            per_million_tokens!(0.9, 2.3)),     // 输入 ¥0.9/1M，输出 ¥2.3/1M（缓存命中 0.1）
        model("deepseek-reasoner", "DeepSeek-R1", "llm",
            per_million_tokens!(2.8, 9.6)),
        model("gpt-4o-mini", "GPT-4o Mini", "llm",
            per_million_tokens!(1.1, 4.4)),
        model("gpt-4o", "GPT-4o", "llm",
            per_million_tokens!(18.0, 72.0)),
        model("claude-sonnet-4", "Claude Sonnet 4", "llm",
            per_million_tokens!(22.0, 110.0)),
        model("qwen-plus", "Qwen Plus", "llm",
            per_million_tokens!(0.6, 1.8)),
        model("glm-4-flash", "GLM-4 Flash", "llm",
            per_million_tokens!(0.0, 0.0)),     // 免费
        // ── 云端 ASR（示例，默认给常见服务商参考价） ──
        model("asr-default", "默认云端 ASR", "asr_cloud",
            per_hour_audio!(1.74)),             // ¥1.74/小时
        // ── TTS（示例） ──
        model("tts-default", "默认 TTS", "tts",
            per_1k_chars!(0.15)),               // ¥0.15/千字
        // ── 翻译（默认用 LLM，标记为 per_million_tokens） ──
    ]
}
```

> 注：最终用户配置的 LLM 模型名千差万别，系统预置只能覆盖常见模型；**未匹配到价格的模型，cost 记为 0，UI 显示"未配置价格"**，用户可以在定价面板手动添加。

### 4.4 价格匹配策略

1. Logger 线程写入 event 前，根据 `(scope, model)` 精确匹配 `model_pricing`
2. 精确匹配失败：尝试 prefix 匹配（如用户配了 `gpt-4o-2024-08-06` 而预置只有 `gpt-4o`，可以按前缀模糊匹配——**可选，v0.3 初版不做，精确匹配即可**）
3. 匹配失败：`total_cost_cny = '0'`，不报错

---

## 五、Rust 结构体

### 5.1 UsageEvent（内存对象）

```rust
use serde::Serialize;
use std::time::Duration;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEvent {
    pub event_id: String,              // UUID v4
    pub event_type: String,
    pub created_at: String,            // RFC3339
    pub provider: Option<String>,
    pub model: Option<String>,
    pub skill_id: Option<String>,
    pub text_mode: Option<String>,
    pub app_context: Option<String>,
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
    pub success: Option<bool>,
    pub error_type: Option<String>,
    pub duration_ms: Option<u64>,
    pub latency_ms: Option<u64>,
    pub first_token_ms: Option<u64>,
    pub input_chars: Option<u32>,
    pub output_chars: Option<u32>,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub audio_duration_ms: Option<u64>,
    pub audio_bytes: Option<u64>,
    pub chunk_count: Option<u32>,
    pub total_cost_cny: Decimal,
    pub extra_json: Option<String>,
}

impl UsageEvent {
    /// 构造器：自动生成 event_id 和 created_at
    pub fn new(event_type: &str) -> Self { ... }

    /// 构建器方法
    pub fn provider(mut self, v: &str) -> Self { self.provider = Some(v.into()); self }
    pub fn model(mut self, v: &str) -> Self { self.model = Some(v.into()); self }
    pub fn skill(mut self, v: &str) -> Self { self.skill_id = Some(v.into()); self }
    pub fn text_mode(mut self, v: &str) -> Self { self.text_mode = Some(v.into()); self }
    pub fn success(mut self, v: bool) -> Self { self.success = Some(v); self }
    pub fn error(mut self, v: &str) -> Self { self.success = Some(false); self.error_type = Some(v.into()); self }
    pub fn latency(mut self, d: Duration) -> Self { self.latency_ms = Some(d.as_millis() as u64); self }
    pub fn first_token(mut self, d: Duration) -> Self { self.first_token_ms = Some(d.as_millis() as u64); self }
    pub fn audio_duration(mut self, d: Duration) -> Self { self.audio_duration_ms = Some(d.as_millis() as u64); self }
    pub fn duration(mut self, d: Duration) -> Self { self.duration_ms = Some(d.as_millis() as u64); self }
    pub fn input_chars(mut self, n: u32) -> Self { self.input_chars = Some(n); self }
    pub fn output_chars(mut self, n: u32) -> Self { self.output_chars = Some(n); self }
    pub fn tokens(mut self, input: u32, output: u32) -> Self {
        self.input_tokens = Some(input);
        self.output_tokens = Some(output);
        self
    }
    pub fn audio_bytes(mut self, n: u64) -> Self { self.audio_bytes = Some(n); self }
    pub fn chunks(mut self, n: u32) -> Self { self.chunk_count = Some(n); self }
    pub fn app_context(mut self, v: &str) -> Self { self.app_context = Some(v.into()); self }
    pub fn languages(mut self, src: &str, tgt: &str) -> Self {
        self.source_lang = Some(src.into());
        self.target_lang = Some(tgt.into());
        self
    }
    pub fn extra<T: Serialize>(mut self, v: &T) -> Self {
        self.extra_json = Some(serde_json::to_string(v).unwrap_or_default());
        self
    }
}
```

### 5.2 查询结果结构

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageSummary {
    // KPI 卡
    pub period_start: String,
    pub period_end: String,
    pub voice_input_count: u64,          // asr_complete 的 success_count
    pub total_recording_sec: f64,        // recording_end 的 sum(duration_ms)/1000
    pub llm_call_count: u64,             // llm_complete + rewrite_complete success
    pub total_tokens: u64,               // sum(input+output tokens)
    pub total_cost_cny: Decimal,
    pub success_rate: f64,               // success_count / (success_count + failure_count)
    pub tts_count: u64,
    pub translate_count: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTrend {
    pub date: String,                    // YYYY-MM-DD
    pub event_type: String,
    pub count: u64,
    pub input_chars: u64,
    pub output_chars: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub audio_duration_ms: u64,
    pub cost_cny: Decimal,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsageStat {
    pub model: String,
    pub scope: String,                   // llm/asr_cloud/tts/translate
    pub call_count: u64,
    pub success_count: u64,
    pub success_rate: f64,
    pub avg_latency_ms: u64,
    pub total_tokens: u64,
    pub total_chars: u64,
    pub total_cost_cny: Decimal,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureUsageStat {
    pub feature: String,                 // voice_input / rewrite / tts / translate
    pub count: u64,
    pub success_count: u64,
    pub total_input: u64,                // chars or tokens or ms（看 feature）
    pub total_output: u64,
    pub total_cost_cny: Decimal,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillUsageStat {
    pub skill_id: String,
    pub skill_name: String,              // 从 skills 配置取
    pub call_count: u64,
    pub avg_output_chars: u64,
    pub total_tokens: u64,
    pub total_cost_cny: Decimal,
}
```

---

## 六、TypeScript 类型（前端）

```typescript
// src/lib/types.ts 新增

export type EventType =
  | 'recording_start' | 'recording_end' | 'asr_complete' | 'preprocess_complete'
  | 'llm_start' | 'llm_complete' | 'inject_complete'
  | 'rewrite_complete' | 'tts_start' | 'tts_complete' | 'translate_complete'
  | 'model_installed' | 'model_deleted';

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface TimeRangeParams {
  range: TimeRange;
  start?: string;  // RFC3339，custom 时必填
  end?: string;
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  voiceInputCount: number;
  totalRecordingSec: number;
  llmCallCount: number;
  totalTokens: number;
  totalCostCny: string;   // Decimal string
  successRate: number;    // 0~1
  ttsCount: number;
  translateCount: number;
}

export type TrendMetric = 'count' | 'tokens' | 'recording' | 'cost';

export interface DailyTrend {
  date: string;
  eventType: EventType;
  count: number;
  inputChars: number;
  outputChars: number;
  inputTokens: number;
  outputTokens: number;
  audioDurationMs: number;
  costCny: string;
}

export interface ModelUsageStat {
  model: string;
  scope: 'llm' | 'asr_cloud' | 'tts' | 'translate';
  callCount: number;
  successCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalChars: number;
  totalCostCny: string;
}

export interface FeatureUsageStat {
  feature: 'voice_input' | 'rewrite' | 'tts' | 'translate';
  count: number;
  successCount: number;
  totalInput: number;
  totalOutput: number;
  totalCostCny: string;
}

export interface SkillUsageStat {
  skillId: string;
  skillName: string;
  callCount: number;
  avgOutputChars: number;
  totalTokens: number;
  totalCostCny: string;
}

export interface UsageEventRow {
  id: number;
  eventId: string;
  eventType: EventType;
  createdAt: string;
  provider: string | null;
  model: string | null;
  skillId: string | null;
  success: boolean | null;
  errorType: string | null;
  latencyMs: number | null;
  inputChars: number | null;
  outputChars: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  audioDurationMs: number | null;
  totalCostCny: string;
}

export interface PaginatedEvents {
  items: UsageEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type PricingType = 'per_million_tokens' | 'per_hour_audio' | 'per_1k_chars';

export interface ModelPricing {
  modelId: string;
  displayName: string;
  pricingType: PricingType;
  scope: 'llm' | 'asr_cloud' | 'tts' | 'translate';
  inputUnitPriceCny: string;
  outputUnitPriceCny: string;
  updatedAt: string;
  isUserDefined: boolean;
}
```

---

## 七、成本计算公式

```rust
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

pub fn calculate_cost(
    pricing: &ModelPricing,
    input_tokens: u32,
    output_tokens: u32,
    input_chars: u32,
    audio_duration_ms: u64,
) -> Decimal {
    match pricing.pricing_type.as_str() {
        "per_million_tokens" => {
            let input_cost = Decimal::from(input_tokens) * pricing.input_price / dec!(1_000_000);
            let output_cost = Decimal::from(output_tokens) * pricing.output_price / dec!(1_000_000);
            input_cost + output_cost
        }
        "per_hour_audio" => {
            let hours = Decimal::from(audio_duration_ms) / dec!(3_600_000);
            hours * pricing.input_price
        }
        "per_1k_chars" => {
            Decimal::from(input_chars) * pricing.input_price / dec!(1000)
        }
        _ => dec!(0),
    }
}
```

**估算 fallback**（API 不返回 token 时）：
- 中文 LLM token 估算：`token ≈ chars × 1.5`（中文 1 字 ≈ 1.5~2 token）
- 英文 LLM token 估算：`token ≈ chars × 0.3`（英文 1 token ≈ 4 字符）
- 判断方式：根据文本 CJK 字符比例自动选择倍率

---

## 八、数据库 Migration 代码位置

在现有 [src-tauri/src/services/db.rs](../../src-tauri/src/services/db.rs) 的 `init_db()` 末尾追加：

```rust
// v0.3: usage stats tables
migrate_create_usage_tables(&conn)?;
seed_model_pricing_if_empty(&conn)?;

// 启动时 rollup + prune
rollup_and_prune(&conn, 30)?;
```

其中：
- `migrate_create_usage_tables()` 使用 `CREATE TABLE IF NOT EXISTS`（SQLite 天然幂等）
- `seed_model_pricing_if_empty()` 检查 `model_pricing` 是否为空，空则 INSERT 预置数据；已存在则不覆盖（保留用户修改）
- `rollup_and_prune(conn, days)` 见 §3.2，使用 Rust 端 Decimal 累加避免浮点误差

---

## 九、IPC 命令契约

> 与主方案 §3.7 对应，此处给出参数/返回的精确类型。

| 命令 | 参数 | 返回 |
| :--- | :--- | :--- |
| `get_usage_summary` | `{ range: TimeRangeParams }` | `UsageSummary` |
| `get_usage_trends` | `{ range: TimeRangeParams, metric: TrendMetric }` | `DailyTrend[]` |
| `get_model_stats` | `{ range: TimeRangeParams }` | `ModelUsageStat[]` |
| `get_feature_stats` | `{ range: TimeRangeParams }` | `FeatureUsageStat[]` |
| `get_skill_stats` | `{ range: TimeRangeParams }` | `SkillUsageStat[]` |
| `get_usage_events` | `{ range: TimeRangeParams, filters?: { eventType?, model?, success? }, page: number, pageSize: number }` | `PaginatedEvents` |
| `get_model_pricing` | — | `ModelPricing[]` |
| `update_model_pricing` | `{ modelId, displayName?, pricingType?, inputUnitPriceCny?, outputUnitPriceCny? }` | `()` |
| `reset_model_pricing` | `{ modelId }` | `()`（恢复到 seed 值） |
| `reset_usage_stats` | — | `()`（清空 usage_events + usage_daily_rollups，model_pricing 保留） |

所有命令使用 `#[serde(rename_all = "camelCase")]`，与现有命令保持一致。

---

## 十、Logger 线程接口

```rust
// src-tauri/src/services/usage_logger.rs

use std::sync::mpsc;
use std::thread;
use crate::services::cost_calculator::CostCalculator;

pub struct UsageLoggerHandle {
    tx: mpsc::Sender<UsageEvent>,
}

impl UsageLoggerHandle {
    /// 非阻塞发送；channel 满则 warn 丢弃，不影响主流程
    pub fn log(&self, event: UsageEvent) {
        match self.tx.try_send(event) {
            Ok(_) => {}
            Err(mpsc::TrySendError::Full(_)) => {
                tracing::warn!("usage logger channel full, event dropped");
            }
            Err(mpsc::TrySendError::Disconnected(_)) => {
                tracing::error!("usage logger thread disconnected");
            }
        }
    }
}

pub fn spawn_usage_logger(
    db_path: std::path::PathBuf,
    app_handle: tauri::AppHandle,
) -> UsageLoggerHandle {
    let (tx, rx) = mpsc::sync_channel::<UsageEvent>(1024); // 有界 1024

    thread::Builder::new()
        .name("terminalvoice-usage-logger".into())
        .spawn(move || {
            let conn = rusqlite::Connection::open(&db_path).expect("open db for logger");
            conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;").ok();
            let calculator = CostCalculator::new(&conn);
            let mut buffer: Vec<UsageEvent> = Vec::with_capacity(50);
            let mut last_flush = std::time::Instant::now();

            loop {
                // 1 秒超时，实现"攒 1 秒或攒 50 条"批量 flush
                match rx.recv_timeout(std::time::Duration::from_secs(1)) {
                    Ok(event) => {
                        buffer.push(event);
                        // 非阻塞 drain 剩余
                        while let Ok(ev) = rx.try_recv() {
                            buffer.push(ev);
                            if buffer.len() >= 50 { break; }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        // flush 剩余并退出
                        flush(&conn, &calculator, &app_handle, &mut buffer);
                        break;
                    }
                }

                if buffer.len() >= 50 || last_flush.elapsed().as_secs() >= 1 {
                    flush(&conn, &calculator, &app_handle, &mut buffer);
                    last_flush = std::time::Instant::now();
                }
            }
        })
        .expect("spawn usage logger thread");

    UsageLoggerHandle { tx }
}

fn flush(conn: &rusqlite::Connection, calc: &CostCalculator, app: &tauri::AppHandle, buf: &mut Vec<UsageEvent>) {
    if buf.is_empty() { return; }
    let tx = conn.unchecked_transaction().unwrap();
    for event in buf.drain(..) {
        // 补全 cost
        let event = calc.enrich_cost(event);
        if let Err(e) = insert_event(&tx, &event) {
            tracing::error!("failed to insert usage event: {e}");
        }
    }
    tx.commit().ok();
    // emit 事件（节流由 flush 频率保证）
    app.emit("usage-recorded", ()).ok();
}
```

---

## 十一、设计决策记录

| 决策 | 选择 | 理由 |
| :--- | :--- | :--- |
| 明细表单表 + event_type 区分 | 选单表 | v0.3 数据量小，避免多表 JOIN；extra_json 应对扩展性 |
| start/end 事件分两条记录 | 选分条 | 简化表结构；end 事件带延迟/结果，start 仅时间戳；查询统计只看 *_complete 类事件 |
| 成本字段单位 | CNY（元）| 目标用户中文用户，默认人民币；未来可加 USD 切换（乘以汇率即可） |
| 金额存储类型 | TEXT + rust_decimal | 避免浮点误差，cc-switch 已验证可行 |
| Logger 有界 channel + 丢事件 | 选丢不阻塞 | 统计是次要功能，绝不能阻塞语音输入主链路 |
| 批量 flush + 事件节流 | 1 秒或 50 条 | 减少 SQLite 写事务次数和前端刷新频率 |
| 不做周/月预聚合 | 不做 | 单用户数据量小，日粒度 SUM 足够；后续若数据膨胀再加 |
| 不引入 TanStack Query | 继续用 Zustand | 前端现有 Zustand 模式简洁；v0.3 统计数据量不大，手动 refresh 足够 |
| 图表库 Recharts | 选 Recharts | 轻量、React 生态、API 简洁、与 Tailwind/shadcn 兼容好 |
| Token 估算 fallback | 按 CJK 比例 | 部分兼容 API 不返回 usage，至少给出估算值（标注为估算） |
| 价格匹配精确匹配 | 初版精确匹配 | 简单可预测；prefix 模糊匹配作为后续优化 |
| rollup 成本用 Rust Decimal 累加 | 不在 SQL 中 SUM TEXT | 避免浮点误差，日聚合数据量小，Rust 端循环无性能问题 |
