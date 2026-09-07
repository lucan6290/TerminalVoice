# IPC_API.md — 前后端 IPC 接口契约

> **最后更新**：2026-09-06
> 本文档定义前端（React/TS）与后端（Rust/Tauri）之间所有 **Invoke Commands**（前端→Rust，请求-响应）和 **Events**（Rust→前端，推送）。修改任何 IPC 接口时必须同步更新此文档。

---

## 一、命名约定

| 方向 | 命名风格 | 示例 |
| :--- | :--- | :--- |
| Rust 函数名 | `snake_case` | `fn get_app_status()` |
| Invoke command 名 | `snake_case`（与函数名一致） | `"get_app_status"` |
| TS 封装函数名 | `camelCase` | `getAppStatus()` |
| Event 名 | `kebab-case` | `"runtime-state-changed"` |
| 字段序列化 | Rust `#[serde(rename_all = "camelCase")]`，TS 端 camelCase | `sourceText` / `asrProvider` |

---

## 二、Invoke Commands（前端 → Rust）

当前已注册 35 个命令，均在 [lib.rs](../src-tauri/src/lib.rs) 的 `tauri::generate_handler![]` 中注册。

### 2.1 `get_app_status`

查询当前应用运行状态。

**TS 封装**：`getAppStatus(): Promise<AppStatus>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn get_app_status(runtime: tauri::State<Mutex<AppRuntime>>) -> Result<AppStatus, ()>
```

**请求参数**：无

**返回**：
```ts
type AppStatus = "Idle" | "Recording" | "Recognizing" | "Preview" | "Paused";
```

---

### 2.2 `create_mock_preview`

模拟完整录音→识别→预处理流程（Mock 命令，用于前端联调）。

**TS 封装**：`createMockPreview(rawText: string): Promise<PreviewDraft>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn create_mock_preview(
    raw_text: String,
    runtime: tauri::State<Mutex<AppRuntime>>,
    app: tauri::AppHandle,
) -> Result<PreviewDraft, String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `rawText` | `string` | 模拟识别的原始文本 |

**流程副作用**：
1. 验证当前状态为 `Idle`，否则返回错误
2. 依次发送状态事件：`Idle → Recording → Recognizing → Preview`
3. 使用 `preprocess::process_normal_text()` 处理文本
4. 返回 PreviewDraft，`asrProvider` 固定为 `"mock"`

**返回**：
```ts
interface PreviewDraft {
  mode?: PreviewMode;       // "recognition" | "rewrite"，默认 "recognition"
  sourceText: string;      // 原始文本
  processedText: string;   // 预处理后的文本
  textMode: "Normal" | "Developer" | "Raw";
  asrProvider: string;     // "mock"
}
```

---

### 2.3 `confirm_preview`

确认预览文本，写入历史记录，回到 Idle 状态。

**TS 封装**：`confirmPreview(input: ConfirmPreviewInput): Promise<HistoryItem>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn confirm_preview(
    input: ConfirmPreviewInput,
    runtime: tauri::State<Mutex<AppRuntime>>,
    db: tauri::State<Mutex<Database>>,
    app: tauri::AppHandle,
) -> Result<HistoryItem, String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `mode?` | `PreviewMode` | 预览模式（`"recognition"` / `"rewrite"`，默认 `"recognition"`） |
| `sourceText` | `string` | 原始识别文本 |
| `finalText` | `string` | 用户编辑后的最终文本 |
| `textMode` | `TextMode` | 文本模式 |
| `asrProvider` | `string` | ASR 提供商标识 |

**流程副作用**：
1. 状态转移：`Preview → Idle`，发送 `runtime-state-changed`
2. 写入 history 表
3. 返回写入的 HistoryItem

**返回**：
```ts
interface HistoryItem {
  id: number;
  createdAt: string;       // ISO 8601
  sourceText: string;
  finalText: string;
  textMode: TextMode;
  asrProvider: string;
}
```

---

### 2.4 `list_history`

获取历史记录列表（按时间倒序）。

**TS 封装**：`listHistory(): Promise<HistoryItem[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_history(db: tauri::State<Mutex<Database>>) -> Result<Vec<HistoryItem>, String>
```

**请求参数**：无

**返回**：`HistoryItem[]`（按 `created_at DESC, id DESC` 排序）

---

### 2.5 `get_config`

读取单个配置项。

**TS 封装**：`getConfig(key: string): Promise<string | null>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn get_config(
    key: String,
    db: tauri::State<Mutex<Database>>,
) -> Result<Option<String>, String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `key` | `string` | 配置键（如 `"ui.dark"`、`"input.pttKey"`） |

**返回**：配置值字符串，key 不存在时返回 `null`

---

### 2.6 `set_config`

写入单个配置项，广播 `config-updated` 事件。

**TS 封装**：`setConfig(key: string, value: string): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn set_config(
    key: String,
    value: String,
    db: tauri::State<Mutex<Database>>,
    app: tauri::AppHandle,
) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `key` | `string` | 配置键 |
| `value` | `string` | 配置值（统一存为字符串，前端自行解析类型） |

**流程副作用**：
1. UPSERT 写入 config 表
2. emit `config-updated` 事件，payload 为 `{ key, value }`

**返回**：`void`

---

### 2.7 `list_config`

列出所有配置项。

**TS 封装**：`listConfig(): Promise<ConfigEntry[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_config(db: tauri::State<Mutex<Database>>) -> Result<Vec<ConfigEntry>, String>
```

**请求参数**：无

**返回**：
```ts
interface ConfigEntry {
  key: string;
  value: string;
}
```

---

### 2.8 `inject_text`

将文本注入到当前焦点窗口（通过 enigo 模拟键盘输入）。

**TS 封装**：`injectText(text: string): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn inject_text(text: String) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `text` | `string` | 要注入的文本 |

**返回**：`void`（失败时返回错误信息）

---

### 2.9 `test_asr_connection`

测试 ASR 云端连接是否可达。

**TS 封装**：`testAsrConnection(): Promise<boolean>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn test_asr_connection(db: tauri::State<Mutex<Database>>) -> Result<bool, String>
```

**请求参数**：无（从 DB 读取 `service.asrEndpoint` 和 `service.asrApiKey`）

**流程**：
1. 从 DB 读取 endpoint 和 API Key（API Key 通过 DPAPI 解密）
2. 发送最小 HTTP POST 请求到 endpoint
3. 成功返回 `true`；可重试错误返回 `false`；致命错误返回 `Err`

**返回**：`boolean`（`true`=可达，`false`=暂时不可达）

---

### 2.10 `test_llm_connection`

测试 LLM（AI 整理）云端连接是否可达，同时验证 model 字段合法。

**TS 封装**：`testLlmConnection(): Promise<boolean>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn test_llm_connection(db: tauri::State<Mutex<Database>>) -> Result<bool, String>
```

**请求参数**：无（从 DB 读取 `service.llmEndpoint`/`service.llmModel`/`service.llmApiKey`）

**流程**：
1. 从 DB 读取 endpoint、model、API Key（API Key 通过 DPAPI 解密）
2. 构造最小 `chat/completions` 请求（`messages=[{"role":"user","content":"ping"}]`、`max_tokens=1`）
3. 成功返回 `true`；可重试错误（网络/5xx）返回 `false`；致命错误（401/404/配置缺失）返回 `Err`

**返回**：`boolean`（`true`=可达，`false`=暂时不可达）

---

### 2.11 `delete_history`

删除单条历史记录。

**TS 封装**：`deleteHistory(id: number): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn delete_history(db: tauri::State<Mutex<Database>>, id: i64) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `number` | 历史记录 ID |

**返回**：`void`

---

### 2.12 `clear_history`

清空所有历史记录。

**TS 封装**：`clearHistory(): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn clear_history(db: tauri::State<Mutex<Database>>) -> Result<(), String>
```

**请求参数**：无

**返回**：`void`

---

### 2.13 `search_history`

按关键词搜索历史记录（匹配 `source_text` 或 `final_text`）。

**TS 封装**：`searchHistory(query: string): Promise<HistoryItem[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn search_history(
    db: tauri::State<Mutex<Database>>,
    query: String,
) -> Result<Vec<HistoryItem>, String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `query` | `string` | 搜索关键词（LIKE 模糊匹配） |

**返回**：`HistoryItem[]`（匹配的记录，按时间倒序）

---

### 2.14 `reinject_history`

重新注入历史记录中的文本到当前焦点窗口。

**TS 封装**：`reinjectHistory(id: number): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn reinject_history(
    db: tauri::State<Mutex<Database>>,
    _runtime: tauri::State<Mutex<AppRuntime>>,
    app: tauri::AppHandle,
    id: i64,
) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `number` | 历史记录 ID |

**流程副作用**：
1. 从 DB 读取历史记录的 `final_text`
2. 调用 `inject_text` 注入文本
3. emit `toast` 事件（`{ level: "success", message: "已重新注入文本" }`）

**返回**：`void`

---

### 2.15 `list_filter_words`

获取所有过滤词列表。

**TS 封装**：`listFilterWords(): Promise<FilterWord[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_filter_words(db: tauri::State<Mutex<Database>>) -> Result<Vec<FilterWordItem>, String>
```

**请求参数**：无

**返回**：`FilterWord[]`（默认词在前，按创建时间排序）

---

### 2.16 `add_filter_word`

添加自定义过滤词。

**TS 封装**：`addFilterWord(word: string, replacement?: string): Promise<number>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn add_filter_word(
    db: tauri::State<Mutex<Database>>,
    word: String,
    replacement: Option<String>,
) -> Result<i64, String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `word` | `string` | 过滤词 |
| `replacement` | `string?` | 替换文本（可选，默认空字符串） |

**返回**：`number`（新插入记录的 ID）

---

### 2.17 `delete_filter_word`

删除过滤词。

**TS 封装**：`deleteFilterWord(id: number): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn delete_filter_word(db: tauri::State<Mutex<Database>>, id: i64) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `number` | 过滤词 ID |

**返回**：`void`

---

### 2.18 `toggle_filter_word`

启用/禁用过滤词。

**TS 封装**：`toggleFilterWord(id: number): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn toggle_filter_word(db: tauri::State<Mutex<Database>>, id: i64) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `number` | 过滤词 ID |

**返回**：`void`

---

### 2.19 `cancel_preview`

取消预览，回到 Idle 状态（不写入历史记录）。

**TS 封装**：`cancelPreview(): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn cancel_preview(
    runtime: tauri::State<Mutex<AppRuntime>>,
    app: tauri::AppHandle,
) -> Result<(), String>
```

**请求参数**：无

**流程副作用**：
1. 状态转移：`Preview → Idle`，发送 `runtime-state-changed`
2. 不写入 history 表

**返回**：`void`

---

### 2.20 `list_audio_input_devices`

枚举系统录音设备列表。

**TS 封装**：`listAudioInputDevices(): Promise<AudioInputDevice[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_audio_input_devices() -> Result<Vec<AudioInputDevice>, String>
```

**请求参数**：无

**返回**：
```ts
interface AudioInputDevice {
  name: string;
}
```

---

### 2.21 `list_models`

列出所有可用的 ASR 离线模型。

**TS 封装**：`listModels(): Promise<ModelInfo[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_models() -> Result<Vec<ModelInfo>, String>
```

**请求参数**：无

**返回**：`ModelInfo[]`（含已安装/未安装标记）

---

### 2.22 `download_model`

下载指定 ASR 离线模型。

**TS 封装**：`downloadModel(modelId: string): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn download_model(model_id: String) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `modelId` | `string` | 模型 ID |

**返回**：`void`

---

### 2.23 `delete_model`

删除已下载的 ASR 离线模型。

**TS 封装**：`deleteModel(modelId: string): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn delete_model(model_id: String) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `modelId` | `string` | 模型 ID |

**返回**：`void`

---

### 2.24 `export_data`

导出全部数据（配置 + 历史记录 + 过滤词）为二进制。

**TS 封装**：`exportData(): Promise<number[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn export_data(db: tauri::State<Mutex<Database>>) -> Result<Vec<u8>, String>
```

**请求参数**：无

**返回**：`number[]`（二进制数据的字节数组，前端可转为 Blob 下载）

---

### 2.25 `import_data`

从二进制数据导入（覆盖现有数据）。

**TS 封装**：`importData(data: number[]): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn import_data(db: tauri::State<Mutex<Database>>, data: Vec<u8>) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `data` | `number[]` | 二进制数据字节数组 |

**返回**：`void`

---

### 2.26 `list_skills`

列出所有可用的语音技能（预设 4 个：英文输出/清单模式/汇报格式/听写模板）。

**TS 封装**：`listSkills(): Promise<VoiceSkill[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_skills() -> Vec<VoiceSkill>
```

**请求参数**：无

**返回**：`VoiceSkill[]`（见 [4.14 VoiceSkill](#414-voiceskill)）

---

### 2.27 `set_skill`

设置当前激活的技能。传入空字符串清除技能。

**TS 封装**：`setSkill(skillId: string): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn set_skill(app: AppHandle, skill_id: String) -> Result<(), String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `skillId` | `string` | 技能 ID（"english"/"list"/"report"/"dictation"），空字符串=清除 |

**返回**：`void`。存入配置键 `service.activeSkill`。

---

### 2.28 `get_active_skill`

获取当前激活的技能 ID。

**TS 封装**：`getActiveSkill(): Promise<string | null>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn get_active_skill(app: AppHandle) -> Result<Option<String>, String>
```

**请求参数**：无

**返回**：`string | null`（未设置或空时返回 `null`）

---

### 2.29 `set_hotkey_config`

更新全局快捷键（按住说话 / 朗读 / 翻译），写入 DB 后立即触发热键管线热重载，无需重启应用。

**TS 封装**：`setHotkeyConfig(config: HotkeyConfig): Promise<void>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn set_hotkey_config(payload: HotkeyConfigPayload, db: State<'_, DbState>, app: AppHandle) -> Result<(), String>
```

**请求参数**（`payload`，camelCase）：

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `pttKey` | `string` | 按住说话键名（如 `RightAlt`、`F6`、`Ctrl`） |
| `ttsKey` | `string` | 朗读键名（与 Alt 组合触发，如 `1`） |
| `translateKey` | `string` | 翻译键名（与 Alt 组合触发，如 `2`） |

合法键名（大小写/横线无关）：`RightAlt/AltGr`、`LeftAlt/Alt`、`RightCtrl/LeftCtrl/Ctrl`、`RightShift/LeftShift/Shift`、`Space`、`Enter/Return`、`Tab`、`Esc/Escape`、`Backspace`、`0`~`9`、`F1`~`F12`、`A`~`Z`。

**返回**：`void`。非法键名返回错误 `String`。成功后会发送一条 `toast` 事件通知新热键。

---

### 2.30 `fetch_asr_models`

获取 ASR 服务商提供的模型列表。

**TS 封装**：`fetchAsrModels(): Promise<FetchedModel[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn fetch_asr_models() -> Result<Vec<FetchedModel>, String>
```

**请求参数**：无（从 DB 读取 `service.asrEndpoint`/`service.asrApiKey`）

**返回**：
```ts
interface FetchedModel {
  id: string;
  ownedBy: string | null;
}
```

---

### 2.31 `fetch_llm_models`

获取 LLM 服务商提供的模型列表。

**TS 封装**：`fetchLlmModels(): Promise<FetchedModel[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn fetch_llm_models() -> Result<Vec<FetchedModel>, String>
```

**请求参数**：无（从 DB 读取 `service.llmEndpoint`/`service.llmApiKey`）

**返回**：`FetchedModel[]`（同 2.30）

---

### 2.32 `get_app_version`

获取当前应用版本号。

**TS 封装**：`getAppVersion(): Promise<string>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn get_app_version() -> String
```

**请求参数**：无

**返回**：`string`（如 `"0.1.0"`）

---

### 2.33 `submit_feedback`

提交用户反馈。后端会校验并清洗输入，按配置同步提交到 GitHub Issue 和邮件通道；网络类失败会写入本地离线队列，等待后续重试。

**TS 封装**：`submitFeedback(input: FeedbackInput): Promise<FeedbackSubmitResult>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn submit_feedback(
    input: FeedbackInput,
    db: State<'_, Mutex<Database>>,
) -> Result<FeedbackSubmitResult, String>
```

**请求参数**：
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `input.title` | `string` | 反馈标题，3-120 字符 |
| `input.description` | `string` | 详细描述，10-5000 字符 |
| `input.feedbackType` | `FeedbackType` | 问题类型 |
| `input.contact` | `string` | 联系方式，可选，最长 200 字符 |

**返回**：
```ts
interface FeedbackSubmitResult {
  submitted: boolean;
  queued: boolean;
  queueId?: number | null;
  message: string;
}
```

---

### 2.34 `flush_feedback_queue`

立即重试本地离线反馈队列。应用启动时也会自动调用同一逻辑进行一次重试。

**TS 封装**：`flushFeedbackQueue(): Promise<number>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn flush_feedback_queue(db: State<'_, Mutex<Database>>) -> Result<usize, String>
```

**请求参数**：无

**返回**：本次成功提交并从队列删除的反馈数量。

---

### 2.35 `list_feedback_queue`

查询当前本地离线反馈队列，用于排查网络失败和重试状态。

**TS 封装**：`listFeedbackQueue(): Promise<FeedbackQueueItem[]>`

**Rust 签名**：
```rust
#[tauri::command]
pub fn list_feedback_queue(
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<FeedbackQueueItem>, String>
```

**请求参数**：无

**返回**：`FeedbackQueueItem[]`

---

## 三、Events（Rust → 前端）

### 3.1 `runtime-state-changed`

应用运行状态变更时推送。

**发送时机**：任何有效状态转移后（由 `emit_runtime_state()` 函数发送）。

**Payload**：
```ts
interface RuntimeStateChangedPayload {
  state: AppStatus;  // 新状态
}
```

**已触发场景**：
- `create_mock_preview` 命令内：Idle→Recording、Recording→Recognizing、Recognizing→Preview
- `confirm_preview` 命令内：Preview→Idle

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook

---

### 3.2 `config-updated`

配置项变更时推送。

**发送时机**：`set_config` 命令写入后。

**Payload**：
```ts
interface ConfigUpdatedPayload {
  key: string;
  value: string;
}
```

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后调用 `applyConfigEntry(key, value)` 更新 Zustand store。

---

### 3.3 `toast`

Toast 通知消息推送。

**发送时机**：后端操作需要通知用户时（如重注入成功、配置保存等）。

**Payload**：
```ts
interface ToastPayload {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}
```

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后调用 `showToast(message, level)`。

---

### 3.4 `preview-ready`

预览文本准备就绪，前端应显示 PreviewPopup。

**发送时机**：识别完成或 AI 改写完成后，后端推送预览数据。

**Payload**：`PreviewDraft`（见 4.5）

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后调用 `setPreviewDraft(payload)`。

---

### 3.5 `preview-cleared`

预览已清除，前端应关闭 PreviewPopup。

**发送时机**：用户确认或取消预览后。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后调用 `clearPreviewDraft()`。

---

### 3.6 `recording-started`

录音已开始。

**发送时机**：热键按下，录音设备启动后。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后重置 `recordingDuration` 为 0 并清除 `errorMessage`。

---

### 3.7 `recording-tick`

录音计时更新（每秒推送）。

**发送时机**：录音过程中，每秒推送一次。

**Payload**：
```ts
interface RecordingTickPayload {
  duration: number;  // 已录秒数
}
```

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后更新 `recordingDuration`。

---

### 3.8 `recording-stopped`

录音已停止，开始识别。

**发送时机**：热键松开，录音设备关闭后。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后重置 `recordingDuration` 为 0。

---

### 3.9 `recording-cancelled`

录音被取消（ESC 或误触）。

**发送时机**：用户按 ESC 取消录音，或录音过短被判定为误触。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后重置 `recordingDuration` 为 0。

---

### 3.10 `tts-started`

TTS 朗读已开始。

**发送时机**：Alt+1 触发朗读，TTS 引擎开始播放后。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后设置 `ttsSpeaking` 为 `true`。

---

### 3.11 `tts-stopped`

TTS 朗读已停止。

**发送时机**：朗读完成或被手动停止后。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后设置 `ttsSpeaking` 为 `false`。

---

### 3.12 `translate-result`

翻译结果推送。

**发送时机**：Alt+2 触发翻译，翻译完成后。

**Payload**：
```ts
interface TranslateResultPayload {
  originalText: string;
  translatedText: string;
}
```

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后调用 `setTranslateResult(payload)`，TranslatePopup 组件读取并显示。

---

### 3.13 `rewrite-started`

AI 改写已开始。

**发送时机**：用户触发 AI 整理，后端开始调用 LLM 后。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后设置 `rewriteMode` 为 `true`（小球切换到改写视觉态）。

---

### 3.14 `rewrite-result`

AI 改写结果推送。

**发送时机**：LLM 返回改写结果后。

**Payload**：
```ts
interface RewriteResultPayload {
  originalText: string;
  rewrittenText: string;
}
```

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后：
1. 调用 `setRewriteResult(payload)`
2. 设置 `rewriteMode` 为 `false`
3. 调用 `setPreviewDraft()` 构造 mode=`"rewrite"` 的预览数据

---

### 3.15 `llm-streaming-delta`

LLM 流式输出增量推送。

**发送时机**：LLM 流式响应每个 delta 到达时（由 `emit_llm_streaming_delta()` 发送）。

**Payload**：
```ts
interface LlmStreamingDeltaPayload {
  delta: string;
  accumulated: string;
}
```

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后调用 `setLlmStreamingText(payload.accumulated)` 实时更新流式文本。

---

### 3.16 `tray-navigate`

托盘菜单触发前端跳转（打开指定 Tab 或高亮区块）。

**发送时机**：用户在系统托盘菜单点击「历史记录」「设置」等需要前端导航的项。

**Payload**：
```ts
{ tab?: string } | { section?: string }
```

- `{ tab: "history" }`：跳转到面板对应 Tab
- `{ section: "about" }`：主窗口高亮对应区块

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook。

---

### 3.17 `tray-check-update`

托盘菜单触发「检查更新」。

**发送时机**：用户在系统托盘菜单点击「检查更新」。

**Payload**：无

**前端监听位置**：[App.tsx](../src/App.tsx) 的 `useBackendSync()` hook，收到后触发更新检查流程。

---

## 四、共享类型定义

以下类型在前后端之间传递，两端必须保持一致。

### 4.1 AppStatus

```ts
// TS
type AppStatus = "Idle" | "Recording" | "Recognizing" | "Preview" | "Paused";
```

```rust
// Rust
#[derive(Serialize, Deserialize)]
pub enum AppStatus { Idle, Recording, Recognizing, Preview, Paused }
```

### 4.2 TextMode

```ts
// TS
type TextMode = "Normal" | "Developer" | "Raw";
```

存储到数据库时映射为字符串：`"normal"` / `"developer"` / `"raw"`。

### 4.3 HistoryItem

```ts
interface HistoryItem {
  id: number;
  createdAt: string;       // ISO 8601（Rust chrono 序列化）
  sourceText: string;
  finalText: string;
  textMode: TextMode;
  asrProvider: string;
  durationMs?: number | null;      // 录音时长（毫秒）
  audioFilePath?: string | null;   // 录音文件路径
  llmRewritten?: boolean | null;   // 是否经 AI 整理
  skillId?: string | null;         // 使用的技能 ID
  appContext?: string | null;      // 录入时的前台应用上下文
}
```

### 4.4 PreviewMode

```ts
type PreviewMode = "recognition" | "rewrite";
```

- `"recognition"`：语音识别结果预览（默认）
- `"rewrite"`：AI 改写结果预览

### 4.5 PreviewDraft / ConfirmPreviewInput

```ts
interface PreviewDraft {
  mode: PreviewMode;         // 预览模式（"recognition" / "rewrite"）
  sourceText: string;
  processedText: string;
  textMode: TextMode;
  asrProvider: string;
  durationMs?: number | null;
  llmRewritten?: boolean | null;
  skillId?: string | null;
}

interface ConfirmPreviewInput {
  mode: PreviewMode;         // 预览模式
  sourceText: string;
  finalText: string;        // 用户编辑后（注意是 finalText 不是 processedText）
  textMode: TextMode;
  asrProvider: string;
  durationMs?: number | null;
  llmRewritten?: boolean | null;
  skillId?: string | null;
}
```

### 4.6 ConfigEntry

```ts
interface ConfigEntry {
  key: string;
  value: string;
}
```

### 4.7 FilterWord

```ts
interface FilterWord {
  id: number;
  word: string;
  replacement: string;
  enabled: boolean;
  isDefault?: boolean;
  createdAt?: string;     // ISO 8601
}
```

### 4.8 AudioInputDevice

```ts
interface AudioInputDevice {
  name: string;
}
```

### 4.9 ModelInfo

```ts
interface ModelInfo {
  id: string;
  name: string;
  sizeBytes: number;
  sha256: string;
  downloadUrl: string;
  installed: boolean;
}
```

### 4.10 TextProcessMode

```ts
type TextProcessMode = "off" | "proofread" | "polish" | "structure";
```

### 4.11 ASRProvider

```ts
type ASRProvider = "cloud" | "offline" | "auto";
```

### 4.12 ServiceConfig

```ts
interface ServiceConfig {
  asrProvider: ASRProvider;
  asrEndpoint: string;
  asrFullUrl: boolean;         // true=直接使用完整 URL，不拼接路径
  asrApiKey: string;
  asrModel: string;
  llmEndpoint: string;
  llmFullUrl: boolean;         // true=直接使用完整 URL，不拼接路径
  llmApiKey: string;
  llmModel: string;
  textMode: TextProcessMode;
  handsFree: boolean;
  translateTargetLang: string;
  skipPreview: boolean;        // 识别后跳过预览窗口直接上屏
  feedbackGithubEnabled: boolean;
  feedbackGithubToken: string; // GitHub Issue 创建 token，DPAPI 加密存储
  feedbackEmailEnabled: boolean;
  feedbackEmailEndpoint: string; // 邮件同步 HTTP JSON POST endpoint
  feedbackEmailRecipient: string;
}
```

### 4.13 FeedbackInput / FeedbackSubmitResult / FeedbackQueueItem

```ts
type FeedbackType = "bug" | "feature" | "experience" | "other";

interface FeedbackInput {
  title: string;
  description: string;
  feedbackType: FeedbackType;
  contact: string;
}

interface FeedbackSubmitResult {
  submitted: boolean;
  queued: boolean;
  queueId?: number | null;
  message: string;
}

interface FeedbackQueueItem {
  id: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string;
  feedbackType: FeedbackType;
  contact: string;
  attempts: number;
  lastError?: string | null;
}
```

Rust 端定义在 `services/feedback.rs` 与 `services/db.rs`，字段通过 `#[serde(rename_all = "camelCase")]` 与 TS 对齐。

### 4.14 事件 Payload 类型

```ts
/** 翻译结果事件 payload */
interface TranslateResultPayload {
  originalText: string;
  translatedText: string;
}

/** 改写结果事件 payload */
interface RewriteResultPayload {
  originalText: string;
  rewrittenText: string;
}

/** 录音计时事件 payload */
interface RecordingTickPayload {
  duration: number;
}

/** Toast 通知事件 payload */
interface ToastPayload {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

/** LLM 流式输出事件 payload */
interface LlmStreamingDeltaPayload {
  delta: string;
  accumulated: string;
}
```

### 4.15 VoiceSkill

```ts
interface VoiceSkill {
  id: string;          // 技能标识（"english"/"list"/"report"/"dictation"）
  name: string;        // 显示名称
  description: string; // 简短说明
  prompt: string;      // LLM system prompt
}
```

Rust 端定义为 `services/skills.rs` 中的 `VoiceSkill` 结构体（`#[serde(rename_all = "camelCase")]`），预设 4 个技能，通过 `find_skill(id)` 按 ID 查找。

### 4.16 HotkeyConfig / HotkeyConfigPayload

```ts
interface HotkeyConfig {
  pttKey: string;        // 按住说话键名，默认 "RightAlt"
  ttsKey: string;        // 朗读键（与 Alt 组合），默认 "1"
  translateKey: string;  // 翻译键（与 Alt 组合），默认 "2"
}
```

Rust 端对应 `services/hotkey.rs::HotkeyConfig`（字段为 `rdev::Key` 枚举），持久化到 DB 的配置键为 `input.pttKey` / `input.ttsKey` / `input.translateKey`；命令 payload 类型 `HotkeyConfigPayload` 为字符串版本。

---

## 五、当前已使用的配置键

在 [appStore.ts](../src/stores/appStore.ts) 中使用：

| Key | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `ui.dark` | `"true"/"false"` | `"false"` | 深色模式 |
| `ui.soundOn` | `"true"/"false"` | `"true"` | 交互声音 |
| `ui.muteSys` | `"true"/"false"` | `"false"` | 使用时静音系统声音 |
| `ui.autoStart` | `"true"/"false"` | `"false"` | 开机自启 |
| `ui.lang` | `"zh-CN"/"en"` | `"zh-CN"` | 界面语言（i18n 双语） |
| `ui.ballVisible` | `"true"/"false"` | `"true"` | 悬浮球显隐（启动时还原） |
| `input.pttKey` | string | `"RightAlt"` | 按住说话键名 |
| `input.ttsKey` | string | `"1"` | 朗读键（Alt+此键触发） |
| `input.translateKey` | string | `"2"` | 翻译键（Alt+此键触发） |
| `input.micDevice` | string | `""` | 麦克风设备（空=自动检测） |
| `input.skipPreview` | `"true"/"false"` | `"false"` | 识别后跳过预览直接上屏 |
| `service.asrProvider` | `"cloud"/"offline"/"auto"` | `"auto"` | ASR 提供商 |
| `service.asrEndpoint` | string | OpenAI 默认 | ASR 云端接口地址 |
| `service.asrApiKey` | string | `""` | ASR API Key（DPAPI 加密存储） |
| `service.asrModel` | string | `"whisper-1"` | ASR 模型名称 |
| `service.llmEndpoint` | string | OpenAI 默认 | LLM 接口地址 |
| `service.llmApiKey` | string | `""` | LLM API Key（DPAPI 加密存储） |
| `service.llmModel` | string | `"gpt-4o-mini"` | LLM 模型名称 |
| `service.textMode` | `"off"/"proofread"/"polish"/"structure"` | `"polish"` | AI 文本处理模式 |
| `service.handsFree` | `"true"/"false"` | `"false"` | 免手动模式 |
| `service.activeSkill` | string | `""` | 当前激活技能 ID（空=无技能） |
| `service.translateTargetLang` | string | `"en"` | 翻译目标语言 |
| `feedback.githubEnabled` | `"true"/"false"` | `"true"` | 是否提交 GitHub Issue |
| `feedback.githubApiBase` | string | `"https://api.github.com"` | GitHub API 根地址 |
| `feedback.githubOwner` | string | `"lucan6290"` | GitHub 仓库 owner |
| `feedback.githubRepo` | string | `"TerminalVoice"` | GitHub 仓库名 |
| `feedback.githubToken` | string | `""` | GitHub Token（DPAPI 加密存储） |
| `feedback.githubLabels` | string | `"user-feedback"` | 创建 Issue 时附加的逗号分隔 labels |
| `feedback.emailEnabled` | `"true"/"false"` | `"false"` | 是否同步发送邮件 |
| `feedback.emailEndpoint` | string | `""` | 邮件同步 HTTP JSON POST endpoint |
| `feedback.emailRecipient` | string | `""` | 反馈收件邮箱 |

> **注意**：所有配置值统一存为字符串，前端解析为 boolean/其他类型。API Key 变更时后端发送 `config-updated` 事件，payload value 为 `"__terminalvoice_secret_updated__"`，前端收到后重新 `hydrateFromConfig()` 加载完整配置。

---

## 六、计划新增的 IPC 接口（未实现）

以下接口在架构文档中规划但尚未在 Rust 端通过 IPC 实现：

| Command | 方向 | 功能 | 状态 |
| :--- | :--- | :--- | :--- |
| `start_recording` | TS→Rust | 开始录音（热键按下触发） | 由 `services::pipeline` 热键管线内部处理，非 IPC |
| `stop_recording` | TS→Rust | 停止录音并开始识别（热键松开） | 同上 |
| `cancel_recording` | TS→Rust | 取消录音（ESC） | 同上 |
| `toggle_pause` | TS→Rust | 暂停/启用 | 同上 |

> **注意**：录音/暂停由 Rust 端 `services::pipeline::start_hotkey_pipeline()` 在热键管线中直接处理，无需前端 IPC 调用。`list_audio_input_devices` 已实现（见 2.19）。

| Event | 方向 | 功能 | 状态 |
| :--- | :--- | :--- | :--- |
| `asr-result` | Rust→TS | 识别结果（成功） | 待实现，当前通过 `preview-ready` 间接传递 |
| `asr-error` | Rust→TS | 识别失败（含错误码和消息） | 待实现 |
| `asr-progress` | Rust→TS | 识别进度（超5s标记 slow） | 待实现 |
| `inject-result` | Rust→TS | 注入结果（成功/失败+原因） | 待实现 |

> **已实现事件**：`recording-started`/`tick`/`stopped`/`cancelled`（3.6–3.9）、`tts-started`/`stopped`（3.10–3.11）、`translate-result`（3.12）、`rewrite-started`/`result`（3.13–3.14）、`preview-ready`/`cleared`（3.4–3.5）、`toast`（3.3）。

---

## 七、TS 端调用方式

所有 invoke 通过 [lib/commands.ts](../src/lib/commands.ts) 封装，事件名称常量集中在 [lib/events.ts](../src/lib/events.ts)：

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EVENT_RUNTIME_STATE_CHANGED } from "./lib/events";
import type { AppStatus } from "./lib/types";

// Invoke 调用
export async function getAppStatus(): Promise<AppStatus> {
  return invoke("get_app_status");
}

// 事件监听（使用 events.ts 常量，禁止硬编码字符串）
const unlisten = await listen<{ state: AppStatus }>(EVENT_RUNTIME_STATE_CHANGED, (e) => {
  usePanelStore.getState().setRuntimeStatus(e.payload.state);
});
```

前端在 [App.tsx](../src/App.tsx) 的 `useBackendSync()` hook 中集中监听全部 17 个事件，使用 `unlisteners` 数组统一管理清理：

```ts
const unlisteners: (() => void)[] = [];
unlisteners.push(await listen(EVENT_RUNTIME_STATE_CHANGED, (e) => { ... }));
unlisteners.push(await listen(EVENT_RECORDING_TICK, (e) => { ... }));
// ... 共 17 个事件监听器
return () => unlisteners.forEach((fn) => fn());
```

**浏览器降级**：所有 invoke 和 listen 调用在非 Tauri 环境下会 throw，前端通过 try/catch 静默降级到 Mock 数据。
