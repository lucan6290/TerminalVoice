# TerminalVoice 未实现功能开发文档

> 本文档对照 `docs/TerminalVoice_PRD_V1.0.md`(文档版本 V1.1,文件名未同步)与当前代码库实际实现,系统梳理 **PRD 中已规划但尚未实现** 的功能,给出每个待实现模块的目标、涉及文件、接口设计、关键实现要点、与现有代码的集成点、验收标准与依赖。
>
> **读者假设**:熟悉 Rust + Tauri v2 + React,但对本仓库零上下文。文档精确到文件路径与函数签名,可直接据此开工。
>
> **当前基线**:MVP 骨架已完成(项目配置、共享类型契约、`preprocess.rs`、`db.rs`、`state.rs`、前端 Mock UI、4 个 IPC 命令)。本文档不重复已实现内容,仅描述"缺口"。
>
> **文档边界声明**(按 writing-plans 规范):
> - **Scope**:本文档覆盖 9 个独立子系统,属于**多子系统规格总览**。按 writing-plans 的 Scope Check 建议,进入实施阶段时,应将每个子系统拆分为独立的 TDD implementation plan(`docs/superpowers/plans/YYYY-MM-DD-<subsystem>.md`),每个 plan 产出可独立测试的软件。本文档为各子系统的"规格契约",不替代实施计划。
> - **接口代码性质**:文中 Rust/TypeScript 代码块为**接口签名示意**,描述类型、函数签名与调用关系;方法体以 `// ...` 或文字描述占位,具体实现需依据对应库的官方 API 文档(如 cpal/enigo/windows-sys 的具体调用)在实施 plan 中补全。版本号均与 PRD 第十六章核对一致。

---

## 一、实现现状速查表

| PRD 模块 | 现有实现 | 缺口(本文档覆盖) |
| :--- | :--- | :--- |
| 四、录音触发与控制 | `state.rs` 含 `Recording`/`Cancelled` 事件,但无物理触发 | 全局热键、cpal 录音、ESC 取消、时长限制、暂停开关、设备中断 |
| 五、语音识别与预处理 | `preprocess.rs`(模式/过滤词/单行/末尾句号) | 云端 ASR 调用、音频格式转换、临时文件清理、标点补全差距 |
| 六、预览编辑与上屏 | `PreviewPopup.tsx`(Enter/ESC)、`confirm_preview` 仅写历史 | 目标控件捕获、文本注入、置顶窗口定位、复制按钮、上屏兜底 |
| 七、状态与反馈 | `state.rs` 状态机、`StatusBadge.tsx` | 录音/识别悬浮提示、识别失败托盘通知、真实事件接入 |
| 八、系统托盘 | 无 | 托盘驻留、菜单、Explorer 恢复、重启/退出 |
| 九、主界面与设置 | `History.tsx`(仅列表)、`Settings.tsx`(占位) | 历史详情/复制/重上屏/删除/搜索、设置页全部、窗口行为 |
| 十、数据存储 | `db.rs` 三表 schema + history CRUD | config/filter_words CRUD、损坏恢复、上限清理、日志系统 |
| 十一、非功能 | 部分可验证 | DPAPI 加密、日志脱敏、性能验证、NSIS 打包 |
| 十四、验收(43 项) | ~6 项 | ~37 项 |

> **标点差距说明**:`preprocess.rs::add_terminal_punctuation` 仅在末尾补"。"。PRD 5.3 要求"自动添加标准中文标点(，。！？；:)"。实际上中文 ASR 服务商返回结果通常已带标点,本地仅需末尾兜底——当前实现可接受,但需在 §3.2 明确策略。

---

## 二、依赖与配置补齐清单(所有子系统前置)

### 2.1 `src-tauri/Cargo.toml` 待新增依赖

```toml
[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }          # 启用托盘
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
rusqlite = { version = "0.40", features = ["bundled"] }

# —— 新增:录音(§4)
cpal = "0.18"
hound = "3.5"

# —— 新增:ASR HTTP(§5)
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }

# —— 新增:文本注入(§6)
enigo = "0.6"
arboard = "3"

# —— 新增:Windows API / DPAPI(§8、§11)
windows-sys = { version = "0.61", features = [
    "Win32_Foundation",
    "Win32_Security_Cryptography",
    "Win32_UI_WindowsAndMessaging",
    "Win32_System_Threading",
] }

# —— 新增:日志(§7)
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"

# —— 新增:Tauri 官方插件(Rust 侧)
tauri-plugin-global-shortcut = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-autostart = "2"
```

### 2.2 `src-tauri/tauri.conf.json` 待修改

- `app.windows[0]`:增加 `"label": "main"`(capabilities 引用)、`"visible": false`(启动静默到托盘,按需)
- `bundle`:增加 `"icon` 数组(图标文件)、`"windows": { "wix": {} }`(可选 MSI)、`"nsis": {}` 配置
- 新增 `"plugins": { "global-shortcut": { "debug": false } }` 等(按需)

### 2.3 `src-tauri/capabilities/default.json` 待扩权限

当前仅 `"core:default"`,需按各插件追加:`global-shortcut:default`、`clipboard-manager:default`、`dialog:default`、`shell:default`、`autostart:default`、`core:window:allow-*`(按需)。

### 2.4 前端依赖

`package.json` 已含 `@tauri-apps/plugin-global-shortcut/clipboard-manager/dialog/shell`、`zustand`、`lucide-react`。需补:
- `@tauri-apps/plugin-autostart`(对应 Rust 侧)
- shadcn/ui 初始化:`pnpm dlx shadcn@latest init`(生成 `components.json`、`src/lib/utils.ts`、`tailwind` 配置),按需添加组件 `button input switch select dialog toast`

### 2.5 `src-tauri/src/lib.rs` 插件注册模板(最终形态)

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| { /* 见各子系统 setup */ Ok(()) })
        .invoke_handler(tauri::generate_handler![
            commands::preview::get_app_status,
            commands::preview::create_mock_preview,
            commands::preview::confirm_preview,
            commands::history::list_history,
            // 新增命令见各子系统
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TerminalVoice");
}
```

---

## 三、子系统 0:文本预处理标点补全差距(小项,优先)

### 3.1 目标
对照 PRD 5.3,明确标点策略并补全 `preprocess.rs`,使其满足"普通文本模式自动添加中文标点"。

### 3.2 涉及文件
- 修改:`src-tauri/src/services/preprocess.rs:79-91`(`add_terminal_punctuation`)
- 修改:`src-tauri/src/commands/preview.rs`(若需传入 ASR 是否已带标点标志)

### 3.3 接口与实现要点
1. **策略决策**:云端 ASR(V1.1 选定服务商)返回结果默认已带标点 → 本地仅做"末尾兜底补全"(已实现)。
2. 若选定的 ASR 服务商不返回标点,则需本地分句加标点。建议**不引入** NLP 模型(YAGNI),采用规则:
   - 按停顿/语气词切句,句末补",。!?;"中合适符号。
3. 当前 `add_terminal_punctuation` 已处理末尾符号判断,保留。补充:在 `PreprocessConfig` 增加 `asr_provides_punctuation: bool` 字段,仅当 ASR 不带标点时启用本地加标点逻辑。

### 3.4 验收(对应 PRD 14.3)
- 普通文本模式末尾有终止标点
- 已存在标点不被重复添加
- 开发者/原样模式不添加

---

## 四、子系统 1:录音触发与控制

### 4.1 目标(对应 PRD 第四章)
长按 `F8` 录音、松开结束、ESC 取消、0.5s 最短/60s 最长、全局暂停、设备中断处理。

### 4.2 涉及文件
- 新建:`src-tauri/src/services/hotkey.rs` — `tauri-plugin-global-shortcut` 封装
- 新建:`src-tauri/src/services/recorder.rs` — `cpal` 录音封装
- 新建:`src-tauri/src/services/audio.rs` — PCM/WAV 编码、格式转换
- 新建:`src-tauri/src/commands/audio.rs` — 录音控制 IPC
- 修改:`src-tauri/src/lib.rs` — 注册热键回调、管理录音句柄
- 修改:`src-tauri/src/services/mod.rs`、`src-tauri/src/commands/mod.rs` — 增加模块声明

### 4.3 接口设计

**`hotkey.rs`**
```rust
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub fn register(app: &AppHandle, accelerator: &str) -> tauri::Result<()> {
    let shortcut: Shortcut = accelerator.parse()
        .map_err(|e| tauri::Error::Anyhow(e.into()))?;
    app.global_shortcut().on_with_shortcut(shortcut, move |app, _sc, event| {
        match event.state() {
            ShortcutState::Pressed => crate::audio_flow::on_hotkey_pressed(app),
            ShortcutState::Released => crate::audio_flow::on_hotkey_released(app),
        }
    })?;
    Ok(())
}

pub fn unregister_all(app: &AppHandle) -> tauri::Result<()> {
    app.global_shortcut().unregister_all()?;
    Ok(())
}
```

**`recorder.rs`**(cpal 0.18 trait-based API)
```rust
use cpal::{Device, InputCallbackInfo, Stream, StreamConfig};
use std::sync::{Arc, Mutex};

pub struct Recorder {
    device: Device,
    samples: Arc<Mutex<Vec<f32>>>,
    stream: Option<Stream>,
}

impl Recorder {
    pub fn default_device() -> Result<Self, String> { /* cpal default_input_device */ }
    pub fn list_devices() -> Result<Vec<String>, String> { /* enumerate */ }
    pub fn start(&mut self, config: &RecordConfig) -> Result<(), String> {
        // 16KHz/16bit/mono: cpal input stream -> resample -> collect f32
    }
    pub fn stop(&mut self) -> Result<Vec<f32>, String> { /* drain samples, drop stream */ }
}

pub struct RecordConfig {
    pub sample_rate: u32,   // 16000
    pub channels: u16,      // 1
    pub max_seconds: u32,   // 60
    pub min_seconds: f32,   // 0.5
}
```

**`audio.rs`**
```rust
pub fn samples_to_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    // hound: 16-bit PCM WAV
}
pub fn cleanup_temp(path: &Path) { /* fs::remove_file,忽略错误 */ }
```

**`commands/audio.rs`**
```rust
#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<String>, String>
#[tauri::command]
pub async fn test_recording(seconds: u32) -> Result<Vec<u8>, String> // 设置页"测试录音"回放
```

### 4.4 关键实现要点
1. **长按检测**:`tauri-plugin-global-shortcut` 2.x(底层 `global-hotkey` 0.8+)原生提供 `Pressed`/`Released` 事件,无需轮询 `GetAsyncKeyState`(PRD 16.2 已明确)。
2. **最短 0.5s**:松开时比较录音时长,`< 0.5s` 触发 `HotkeyReleasedTooShort`(状态机已有),静默丢弃音频、不弹提示。
3. **最长 60s**:录音启动时 `tokio::spawn` 一个 `sleep(max_seconds)`,到时主动 `stop()` 并走"松开"流程(PRD 4.3 静默结束)。
4. **ESC 取消**:录音期间需全局监听 ESC,收到后 → 状态机 `Cancelled` → 清理音频。具体实现方式需在实施时验证:`tauri-plugin-global-shortcut` 对单键 ESC 的注册支持情况(底层 `global-hotkey` 对非修饰键单键注册可能有限);若不支持,降级为 `rdev` 等底层键盘钩子方案。
5. **暂停开关**:`TogglePause` 事件已有。热键回调入口先查 `AppRuntime.state()`,若 `Paused` 则直接 return(无反应、无提示)。
6. **设备中断**:cpal stream error callback → 触发 `Cancelled` + 发托盘事件"麦克风设备异常/被占用"。

### 4.5 与现有代码集成点
- `state.rs`:`HotkeyPressed`/`HotkeyReleasedWithValidAudio`/`HotkeyReleasedTooShort`/`Cancelled`/`TogglePause` 事件已定义,直接复用。
- `lib.rs::setup`:新增 `hotkey::register(app, "F8")`、管理 `Mutex<Recorder>`。
- 录音完成后产出 `Vec<f32>` → 交给子系统 2(ASR)。

### 4.6 验收(对应 PRD 14.1)
- [ ] 按住 `F8` 录音,松开结束
- [ ] < 0.5s 静默丢弃
- [ ] ESC 取消回空闲
- [ ] 60s 自动结束
- [ ] 暂停态按键无反应
- [ ] 设置页改快捷键立即生效

### 4.7 依赖
`cpal 0.18`、`hound 3.5`、`tauri-plugin-global-shortcut 2`、`tokio 1`、(ESC 监听)`rdev`(可选,后续评估)。

---

## 五、子系统 2:云端 ASR 识别

### 5.1 目标(对应 PRD 第五章)
整段录音结束后调用云端 ASR API,失败重试 1 次,临时音频清理,错误码映射提示。

### 5.2 涉及文件
- 新建:`src-tauri/src/services/asr_client.rs` — HTTP 客户端抽象
- 新建:`src-tauri/src/services/asr.rs` — 业务编排(重试、错误映射)
- 新建:`src-tauri/src/commands/asr.rs` — IPC(`test_connection`)
- 修改:`src-tauri/src/lib.rs` — 录音完成后调用 ASR、状态推进

### 5.3 接口设计

**`asr_client.rs`**
```rust
#[async_trait]
pub trait AsrClient: Send + Sync {
    async fn transcribe(&self, audio: &[u8], config: &AsrRequestConfig) -> Result<String, AsrError>;
    fn provider_name(&self) -> &'static str;
}

pub struct AsrRequestConfig {
    pub api_key: String,        // 解密后明文,仅请求内存中
    pub endpoint: Option<String>,
    pub language: String,       // "zh-CN"
    pub timeout_secs: u64,      // 15
}

#[derive(Debug, thiserror::Error)]
pub enum AsrError {
    #[error("network_unreachable")]
    NetworkUnreachable,
    #[error("timeout")]
    Timeout,
    #[error("auth_failed")]
    AuthFailed,         // 401/403
    #[error("quota_exhausted")]
    QuotaExhausted,     // 429/402
    #[error("server_error")]
    ServerError,        // 5xx
    #[error("empty_audio")]
    EmptyAudio,
    #[error("format_error")]
    FormatError,
    #[error("unknown: {0}")]
    Unknown(String),
}
```

> 注:需在 `Cargo.toml` 增加 `thiserror = "2"`、`async-trait = "0.1"`。

**`asr.rs`**
```rust
pub async fn recognize(
    client: &dyn AsrClient,
    audio: &[u8],
    config: &AsrRequestConfig,
) -> Result<String, AsrError> {
    // 第 1 次失败 → 重试 1 次 → 仍失败返回 Err
    match client.transcribe(audio, config).await {
        Ok(text) => Ok(text),
        Err(AsrError::Timeout | AsrError::NetworkUnreachable) => {
            client.transcribe(audio, config).await
        }
        Err(other) => Err(other),  // 401/429 等不重试
    }
}

pub fn map_to_user_message(err: &AsrError) -> &'static str {
    // 映射到 PRD 7.5 文案表
}
```

### 5.4 关键实现要点
1. **服务商抽象**:`AsrClient` trait,V1.1 先实现 1 家(如 Whisper API 或阿里云)。`provider_name()` 写入历史 `asr_provider` 字段。
2. **音频格式转换**:`audio.rs` 产出 WAV;若服务商要求 PCM/Opus,在 `asr_client` 内转换。
3. **超时**:`reqwest::Client::builder().timeout(Duration::from_secs(15))`。
4. **重试策略**:仅对网络/超时重试 1 次;401/429/空音频不重试。
5. **临时文件清理**:`recognize` 完成后(成功/失败/取消)统一 `audio::cleanup_temp`。
6. **错误码→文案**:严格按 PRD 7.5 表映射,文案经托盘通知(子系统 4)。

### 5.5 与现有代码集成点
- 录音 `stop()` 产出 `Vec<f32>` → `audio::samples_to_wav` → `asr::recognize` → 成功触发 `RecognitionSucceeded`(状态机已有)→ 进入预览(子系统 3);失败触发 `RecognitionFailed` → 回 Idle + 托盘通知。
- `asr_provider` 传入 `confirm_preview` 的 `ConfirmPreviewInput.asr_provider`。
- API Key 来源:子系统 8(DPAPI 解密)。

### 5.6 验收(对应 PRD 14.2)
- [ ] 短句 3 秒内返回
- [ ] 成功弹预览框
- [ ] 网络断开重试 1 次后托盘提示
- [ ] 401 提示"API 密钥无效"
- [ ] 空音频提示"未检测到有效语音"
- [ ] 临时音频删除

### 5.7 依赖
`reqwest 0.12`、`tokio 1`、`async-trait 0.1`、`thiserror 2`。

---

## 六、子系统 3:预览上屏与文本注入

### 6.1 目标(对应 PRD 第六章)
目标输入控件捕获、预览框置顶定位、确认上屏注入文本、失败兜底(剪贴板)。

### 6.2 涉及文件
- 新建:`src-tauri/src/services/injector.rs` — 文本注入核心
- 新建:`src-tauri/src/commands/inject.rs` — 上屏 IPC
- 修改:`src-tauri/src/commands/preview.rs::confirm_preview` — 确认后调用注入
- 修改:`src/components/PreviewPopup.tsx` — 改为独立置顶窗口、补"复制到剪贴板"按钮、Ctrl+Enter 显式换行
- 修改:`src/lib/commands.ts`、`src/lib/types.ts` — 新增 `inject_text` 命令

### 6.3 接口设计

**`injector.rs`**
```rust
use arboard::Clipboard;
use enigo::{Enigo, Keyboard, Direction};

pub struct TargetWindow {
    pub hwnd: isize,           // 捕获时记录
    pub title: String,
}

pub fn capture_current_focus() -> Result<TargetWindow, String> {
    // windows-sys GetForegroundWindow + GetWindowText
}

pub fn inject_text(text: &str, target: &TargetWindow) -> Result<(), InjectError> {
    // 1. SetForegroundWindow(target.hwnd)
    // 2. 优先 arboard 剪贴板写入 + enigo Ctrl+V
    // 3. 失败回退 enigo Unicode 逐字符
}

#[derive(Debug, thiserror::Error)]
pub enum InjectError {
    #[error("read_only")]
    ReadOnly,                  // 只读/密码框
    #[error("permission_denied")]
    PermissionDenied,          // 管理员窗口
    #[error("blocked")]
    Blocked,                   // 安全软件拦截
    #[error("no_target")]
    NoTarget,                  // 无有效输入位置
    #[error("unknown: {0}")]
    Unknown(String),
}
```

**`commands/inject.rs`**
```rust
#[tauri::command]
pub fn inject_text(final_text: String) -> Result<(), String> {
    // 取当前焦点(确认时用户已重定位)→ inject_text → 映射错误
}
```

### 6.4 关键实现要点
1. **目标捕获时机**:热键按下瞬间(`hotkey::on_hotkey_pressed`)调用 `capture_current_focus()`,存入 `AppRuntime`(新增字段 `target: Option<TargetWindow>`)。
2. **预览框定位**:识别成功后,前端创建独立 Webview 窗口(`tauri::WebviewWindowBuilder`)设 `always_on_top(true)`、`decorations(false)`、位置=目标窗口附近。跨进程获取目标控件光标精确坐标的可行性需在实施时评估;降级方案为定位到目标窗口中心或录音触发时的鼠标位置。
3. **用户可重定位**:预览框 `set_focus(false)`(Tauri `focus`),用户点击其他窗口时前端监听 `tauri-window-focus` 更新"当前焦点窗口"。
4. **确认上屏流程**(改 `confirm_preview`):
   - 写历史(已有)
   - 隐藏预览框
   - `injector::inject_text(final_text, &current_focus)`
   - 成功 → `ConfirmedPreview`(状态机已有)→ 保持目标聚焦
   - 失败 → 按错误映射兜底(剪贴板)+ 托盘提示
5. **Ctrl+Enter 换行**:`PreviewPopup` 的 `handleKeyDown` 显式判断 `event.key === "Enter" && event.ctrlKey` → 不 preventDefault(允许换行);纯 Enter 才确认。
6. **复制到剪贴板按钮**:调用 `tauri-plugin-clipboard-manager` 前端 API。

### 6.5 与现有代码集成点
- `state.rs`:新增 `target` 字段到 `AppRuntime`;`confirm_preview` 已调 `ConfirmedPreview`,只需在写历史后追加注入调用。
- `PreviewDraft`/`ConfirmPreviewInput` 类型不变。
- `types.ts` 增加 `injectText` 命令封装。

### 6.6 验收(对应 PRD 14.4)
- [ ] Enter 确认、Ctrl+Enter 换行、ESC 放弃
- [ ] 修改后上屏修改后文本
- [ ] 填充到光标位置
- [ ] 选中状态下替换
- [ ] 目标窗口关闭兜底
- [ ] 上屏失败文本保留剪贴板

### 6.7 依赖
`enigo 0.6`、`arboard 3`、`windows-sys 0.61`、`tauri-plugin-clipboard-manager 2`。

---

## 七、子系统 4:状态反馈(悬浮提示与托盘通知)

### 7.1 目标(对应 PRD 第七章)
录音"倾听中 N:SS"、识别中"识别中…/(较慢)"、识别失败托盘气泡、真实事件接入状态机。

### 7.2 涉及文件
- 新建:`src/components/RecordingOverlay.tsx` — 录音/识别悬浮提示
- 修改:`src/App.tsx` — 渲染 Overlay、订阅状态变更事件
- 新建:`src/hooks/useTauriEvent.ts` — 事件监听 Hook
- 新建:`src/hooks/useAppState.ts` — Zustand 状态(替代 prop drilling)
- 修改:`src-tauri/src/lib.rs` — 状态变更时 `app.emit("state-changed", status)`
- 新建:`src-tauri/src/services/tray.rs`(托盘通知依赖子系统 5,此处仅 `emit` 事件)

### 7.3 接口设计

**事件协议**(后端 → 前端)
```rust
// 后端 emit
app.emit("state-changed", AppStatus::from(runtime.state()))?;
app.emit("recording-tick", elapsed_secs)?;
app.emit("asr-progress", AsrProgress { slow: bool })?;
app.emit("asr-failed", AsrFailedPayload { message: String })?;
```

```typescript
// 前端 types.ts
export interface AsrProgress { slow: boolean }
export interface AsrFailedPayload { message: string }
```

**`RecordingOverlay.tsx`**
- 录音态:显示"倾听中 0:12",`useTauriEvent("recording-tick", setElapsed)`
- 识别态:"识别中…",超过 5s 切"识别中…(较慢)"
- 不抢焦点(`pointer-events: none`、`always_on_top`)

### 7.4 关键实现要点
1. **录音计时**:后端 `tokio::time::interval(Duration::from_secs(1))` emit `recording-tick`,停止时 drop。
2. **识别 5s 慢提示**:后端启动识别时 spawn `sleep(5s)`,到时若仍在 `Recognizing` 则 emit `asr-progress{slow:true}`。
3. **悬浮层不抢焦**:`RecordingOverlay` 作为透明置顶窗口或主窗口内的 fixed 层,`pointer-events:none`。
4. **设置开关**:悬浮提示受 `config.recording_overlay_enabled` 控制(子系统 6)。
5. **真实事件接入**:此前 `create_mock_preview` 人工触发状态转移;真实流程在 `hotkey`/`recorder`/`asr` 回调中调 `runtime.transition(...)`,并在每次转移后 `emit("state-changed")`。

### 7.5 与现有代码集成点
- `state.rs::AppRuntime`:新增 `emit` 钩子或在 `commands` 层每次 transition 后 emit。建议在 `AppRuntime` 包一层 `AppState` 持有 `AppHandle`,transition 后统一 emit。
- `StatusBadge.tsx` 已存在,改为订阅 `state-changed` 事件而非 `get_app_status` 轮询。

### 7.6 验收(对应 PRD 14.5)
- [ ] 录音悬浮"倾听中"+ 秒数
- [ ] 识别超 5s 显示"较慢"
- [ ] 暂停态视觉区分
- [ ] 失败托盘气泡对应错误

### 7.7 依赖
Zustand(`package.json` 已含)、`@tauri-apps/api` event。

---

## 八、子系统 5:系统托盘与生命周期

### 8.1 目标(对应 PRD 第八、十二章)
托盘驻留、左键开窗、右键菜单、Explorer 重启恢复、单实例、重启/退出。

### 8.2 涉及文件
- 新建:`src-tauri/src/tray.rs` — `TrayIconBuilder` + 菜单
- 修改:`src-tauri/src/lib.rs` — `setup` 中构建托盘、注册 `RunEvent` 处理
- 修改:`src-tauri/tauri.conf.json` — `app.trayIcon` 配置、图标
- 修改:`src-tauri/Cargo.toml` — `tauri` features 加 `"tray-icon"`

### 8.3 接口设计

**`tray.rs`**
```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
    AppHandle, Manager,
};

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle_pause", "暂停应用", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "重启应用", true, None::<&str>)?;
    let dirs = Submenu::with_items(app, "打开目录", true, &[
        MenuItem::with_id(app, "open_app_dir", "应用目录", true, None::<&str>)?,
        MenuItem::with_id(app, "open_data_dir", "工作目录", true, None::<&str>)?,
        MenuItem::with_id(app, "open_log_dir", "日志目录", true, None::<&str>)?,
        MenuItem::with_id(app, "open_db_dir", "数据库目录", true, None::<&str>)?,
    ])?;
    let website = MenuItem::with_id(app, "website", "打开官方网站", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &restart, &dirs, &website, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("TerminalVoice")
        .menu(&menu)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(on_tray_icon_event)
        .build(app)?;
    Ok(())
}

fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "show" => { /* show + focus main window */ }
        "toggle_pause" => { /* runtime.transition(TogglePause) + update menu label + swap icon */ }
        "restart" => { /* confirm if recording/preview, then restart current exe */ }
        "open_app_dir" | "open_data_dir" | "open_log_dir" | "open_db_dir" => { /* plugin-shell open */ }
        "website" => { /* shell open url */ }
        "quit" => { /* cleanup + app.exit(0) */ }
        _ => {}
    }
}

fn on_tray_icon_event(tray: &tauri::tray::TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
        // show main window
    }
}
```

### 8.4 关键实现要点
1. **图标区分运行/暂停**:`toggle_pause` 后 `tray.set_icon(Some(pause_icon))`;运行态彩色、暂停态灰色(需两个图标资源 `icons/tray.png`、`icons/tray-paused.png`)。
2. **菜单文案动态**:`toggle_pause` 后 `menu_item.set_text("启用应用"/"暂停应用")`。
3. **Explorer 重启恢复**:Explorer 重启后 Windows 会广播 `TaskbarCreated` 注册消息,应用捕获后重新构建托盘(`build_tray`)。该机制在 Tauri v2 中的接入方式(原生 `RunEvent` 不直接覆盖此 Windows 消息,可能需自定义消息处理)需在实施时验证。
4. **单实例**:用 `tauri-plugin-single-instance`(需加依赖 `tauri-plugin-single-instance = "2"`),检测到重复实例时 `show + focus main window` 并 `exit(0)` 新实例。
5. **重启**:`std::env::current_exe()` + `Command::new(exe).spawn()` + `app.exit(0)`;若正在录音/预览,先弹 `tauri-plugin-dialog` 确认。
6. **退出清理**:终止录音 stream、关闭预览窗口、释放 cpal 资源、flush 日志。

### 8.5 与现有代码集成点
- `lib.rs::run`:`.setup` 末尾 `tray::build_tray(app)`;`.run` 闭包处理 `RunEvent`。
- `state.rs::TogglePause` 事件已有,托盘菜单复用。
- 目录跳转用 `tauri-plugin-shell` 的 `open`。

### 8.6 验收(对应 PRD 14.6)
- [ ] 启动后托盘有图标
- [ ] 左键开窗
- [ ] 右键菜单全功能
- [ ] Explorer 重启恢复
- [ ] 退出清理资源

### 8.7 依赖
`tauri`(tray-icon feature)、`tauri-plugin-shell 2`、`tauri-plugin-dialog 2`、`tauri-plugin-single-instance 2`。

---

## 九、子系统 6:主界面与设置

### 9.1 目标(对应 PRD 第九章)
历史页完整操作、设置页全部分区、窗口行为。

### 9.2 涉及文件
- 修改:`src/pages/History.tsx` — 详情展开、复制、重上屏、删除、清空、搜索
- 重写:`src/pages/Settings.tsx` — 5 大分区
- 新建:`src/components/Layout.tsx` — 主窗口布局 + 标题栏状态
- 新建:`src-tauri/src/commands/history.rs` — 增加 `delete_history`/`clear_history`/`search_history`/`reinject_history`
- 新建:`src-tauri/src/commands/config.rs` — 配置读写
- 新建:`src-tauri/src/commands/filter.rs` — 过滤词 CRUD
- 修改:`src-tauri/src/services/db.rs` — 补 config/filter_words CRUD 方法
- 修改:`src/lib/commands.ts`、`src/lib/types.ts` — 新增命令与类型

### 9.3 接口设计

**`db.rs` 新增方法**
```rust
// config
pub fn get_config(&self, key: &str) -> Result<Option<String>, rusqlite::Error>
pub fn set_config(&self, key: &str, value: &str) -> Result<(), rusqlite::Error>
pub fn get_all_config(&self) -> Result<HashMap<String,String>, rusqlite::Error>

// filter_words
pub fn list_filter_words(&self) -> Result<Vec<FilterWord>, rusqlite::Error>
pub fn add_filter_word(&self, word: &str) -> Result<(), rusqlite::Error>
pub fn delete_filter_word(&self, id: i64) -> Result<(), rusqlite::Error>
pub fn reset_filter_words(&self) -> Result<(), rusqlite::Error>  // 删自定义,保留默认

// history 增强
pub fn delete_history(&self, id: i64) -> Result<(), rusqlite::Error>
pub fn clear_history(&self) -> Result<(), rusqlite::Error>
pub fn search_history(&self, keyword: &str) -> Result<Vec<HistoryItem>, rusqlite::Error>
```

**`commands/config.rs`**
```rust
#[tauri::command]
pub fn get_config(key: String, db: State<'_, Mutex<Database>>) -> Result<Option<String>, String>
#[tauri::command]
pub fn set_config(key: String, value: String, db: State<'_, Mutex<Database>>) -> Result<(), String>
```

**`commands/filter.rs`**
```rust
#[tauri::command]
pub fn list_filter_words(...) -> Result<Vec<FilterWord>, String>
#[tauri::command]
pub fn add_filter_word(word: String, ...) -> Result<(), String>
#[tauri::command]
pub fn delete_filter_word(id: i64, ...) -> Result<(), String>
#[tauri::command]
pub fn reset_filter_words(...) -> Result<(), String>
```

**`commands/history.rs` 新增**
```rust
#[tauri::command]
pub fn delete_history(id: i64, ...) -> Result<(), String>
#[tauri::command]
pub fn clear_history(...) -> Result<(), String>
#[tauri::command]
pub fn search_history(keyword: String, ...) -> Result<Vec<HistoryItem>, String>
#[tauri::command]
pub fn reinject_history(id: i64, ...) -> Result<(), String>  // 取 final_text → injector::inject_text
```

### 9.4 设置页 5 大分区(对应 PRD 9.3)
1. **ASR 配置**:服务商下拉、API 密钥(`type=password`,落库前 DPAPI 加密)、自定义接口地址、"测试连接"(发短音频)
2. **录音配置**:最长时长滑块(10-300,步长 10,默认 60)、麦克风下拉(`list_audio_devices`)、"测试录音"(`test_recording` 回放)
3. **文本配置**:模式单选、自动标点开关、单行规整开关、口语词过滤开关 + 过滤词管理(列表/新增/删除/恢复默认)
4. **快捷键配置**:录制框(捕获按键)、冲突检测(`global-shortcut` 试注册)、重置默认
5. **通用设置**:开机自启(`tauri-plugin-autostart`)、关闭窗口行为(最小化/退出)、录音悬浮提示开关、历史上限

### 9.5 关键实现要点
1. **配置落库**:所有 key-value 存 `config` 表;`PreprocessConfig` 由 config 表重建(替换 `preview.rs` 当前硬编码 `true`)。
2. **快捷键录制**:前端捕获 `keydown`,组合成 accelerator 字符串("CommandOrControl+Shift+F8" 等),调 `set_config("hotkey", accel)` + 重新 `hotkey::unregister_all` + `register`。
3. **冲突检测**:尝试 `global_shortcut().register(...)`,失败则红色提示。
4. **窗口关闭行为**:`tauri::WindowEvent::CloseRequested` → 若 config 为"最小化到托盘",`api.prevent_close()` + `window.hide()`。
5. **重上屏**:`reinject_history` 复用 `injector::inject_text`,无预览直接上屏,失败托盘提示。

### 9.6 与现有代码集成点
- `preview.rs::create_mock_preview`/`confirm_preview`:从 config 表读 `text_mode`/`add_punctuation` 等构建 `PreprocessConfig`(当前硬编码)。
- `History.tsx` 当前仅展示 `final_text`,需补 `created_at` 格式化、前 50 字预览、操作按钮。

### 9.7 验收(对应 PRD 14.7)
- [ ] 历史:详情、复制、重上屏、删除、清空、搜索
- [ ] 设置 5 分区可配
- [ ] API 密钥加密、重启保持
- [ ] 关闭窗口按设置行为

### 9.8 依赖
shadcn/ui 组件、`tauri-plugin-autostart 2`、`tauri-plugin-clipboard-manager 2`。

---

## 十、子系统 7:数据存储增强

### 10.1 目标(对应 PRD 第十章)
config/filter_words CRUD、数据库损坏恢复、上限清理、日志系统。

### 10.2 涉及文件
- 修改:`src-tauri/src/services/db.rs` — 损坏恢复、上限清理、CRUD(见 §9.3)
- 新建:`src-tauri/src/services/logger.rs` — tracing 配置
- 修改:`src-tauri/src/lib.rs::setup` — 启动时 integrity_check、初始化 logger

### 10.3 接口设计

**`db.rs` 损坏恢复**
```rust
impl Database {
    pub fn open_with_recovery(path: &Path) -> Result<Self, String> {
        match Self::open(path) {
            Ok(db) => {
                db.integrity_check().map_err(|e| e.to_string())?;
                Ok(db)
            }
            Err(_) | // 或 integrity_check 失败
            => {
                // 备份: path -> path.with_extension("db.bak")
                std::fs::rename(path, path.with_extension("db.bak")).ok();
                // 重建
                Self::open(path).map_err(|e| e.to_string())
                // 通知前端/托盘"数据库已重置"
            }
        }
    }
    fn integrity_check(&self) -> Result<(), rusqlite::Error> {
        let ok: String = self.conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
        if ok != "ok" { return Err(rusqlite::Error::QueryFailed); }
        Ok(())
    }
    pub fn trim_history(&self, limit: usize) -> Result<(), rusqlite::Error> {
        // DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC LIMIT ?1)
    }
}
```

**`logger.rs`**
```rust
use tracing_appender::rolling;
use tracing_subscriber::{fmt, EnvFilter};

pub fn init(log_dir: &Path) -> tracing_appender::non_blocking::WorkerGuard {
    let file_appender = rolling::daily(log_dir, "terminalvoice.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    fmt().with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .with_writer(non_blocking)
        .init();
    guard
}
```

### 10.4 关键实现要点
1. **日志清理**:启动时遍历 `logs/`,删除修改时间 > `保留天数`(7 天)的文件;总大小 > 50MB 时删最旧。
2. **日志脱敏**(PRD 11.4):tracing 层封装 `redact(text)` —— 仅记长度与首尾字符,不记 API Key/完整音频/完整文本明文。
3. **历史上限清理**:每次 `insert_history` 后调 `trim_history(config_limit)`。
4. **清除所有数据**:设置页按钮 → 删 history + filter_words(保留默认)+ config 恢复默认。

### 10.5 与现有代码集成点
- `lib.rs::setup`:`logger::init` 返回的 `WorkerGuard` 需保活(存入 `tauri::App` state 或 `std::mem::forget`,推荐 state)。
- `lib.rs::setup`:`Database::open_with_recovery` 替换当前 `Database::open`;恢复后 `app.emit("db-reset", ())`。

### 10.6 验收(对应 PRD 14.8)
- [ ] 配置重启保持
- [ ] 历史上限自动清理
- [ ] 数据库损坏重建+通知
- [ ] 日志按天清理

### 10.7 依赖
`tracing 0.1`、`tracing-subscriber 0.3`、`tracing-appender 0.2`。

---

## 十一、子系统 8:安全与加密

### 11.1 目标(对应 PRD 11.4)
API Key DPAPI 加密存储,日志脱敏,仅 ASR 请求时解密。

### 11.2 涉及文件
- 新建:`src-tauri/src/services/crypto.rs` — DPAPI 加解密
- 修改:`src-tauri/src/commands/config.rs` — 设置 API Key 时加密落库、读取时解密给 ASR

### 11.3 接口设计

**`crypto.rs`**
```rust
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, DATA_BLOB,
};

pub fn encrypt(plaintext: &str) -> Result<Vec<u8>, String> {
    // CryptProtectData, CurrentUser scope
}
pub fn decrypt(cipher: &[u8]) -> Result<String, String> {
    // CryptUnprotectData
}
```

### 11.4 关键实现要点
1. **存储**:`config` 表中 `asr_api_key` 存 `encrypt(plaintext)` 的 base64;明文绝不落盘。
2. **使用**:ASR 请求前 `decrypt` 取明文,放入 `AsrRequestConfig.api_key`,请求结束 drop。
3. **日志**:任何 tracing 都禁止打印 `api_key`;`redact()` 处理文本(首尾各 2 字符 + 长度)。

### 11.5 验收
- [ ] DB 中 `asr_api_key` 为密文
- [ ] 重启后无需重输
- [ ] 日志无 Key/音频/完整文本明文

### 11.6 依赖
`windows-sys 0.61`(Win32_Security_Cryptography feature)、`base64`(若编码,加 `base64 = "0.22"`)。

---

## 十二、子系统 9:打包与验收

### 12.1 目标(对应 PRD 11.5、第十四章)
NSIS 安装包,自定义路径,卸载清理,PRD 第 14 章 43 项验收。

### 12.2 涉及文件
- 修改:`src-tauri/tauri.conf.json` — `bundle` 完整配置
- 新建:`src-tauri/icons/` — 图标集(`icon.ico`、`32x32.png`、`128x128.png`、`icon.icns`)
- 新建(可选):`src-tauri/nsis/installer.nsi` 模板(Tauri 默认即可,按需定制)

### 12.3 配置示例
```json
"bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.ico", "icons/32x32.png", "icons/128x128.png"],
    "windows": {
        "nsis": {
            "installMode": "currentUser",
            "languages": ["SimpChinese"],
            "displayLanguageSelector": false
        }
    }
}
```

### 12.4 关键实现要点
1. **首次构建**:`pnpm tauri build` 自动下载 NSIS 3.11,无需手动安装。
2. **图标**:`pnpm tauri icon path/to/source.png` 生成全套。
3. **卸载**:NSIS 默认清理安装目录;用户数据目录(`app_data_dir`)保留,卸载器弹窗询问。
4. **无自动更新**(PRD 13.9):V1.1 不集成 updater。

### 12.5 验收(对应 PRD 14.1–14.9 全部 43 项)
按 PRD 第十四章逐条勾验,建议每完成一个子系统同步勾选对应章节。

---

## 十三、模块依赖关系与建议实施顺序

```
[基础设施 §2] ─┬─► [子系统1:录音 §4] ──► [子系统2:ASR §5] ──┐
               │                                              ├─► [子系统3:上屏 §6] ─► [子系统6:设置/历史 §9]
               ├─► [子系统8:加密 §11] ──────────────────────┤
               └─► [子系统7:日志 §10] ──────────────────────┤
                                                              ├─► [子系统5:托盘 §8] ─► [子系统4:反馈 §7]
                                                              └─► [子系统9:打包验收 §12]
[子系统0:标点差距 §3] —— 独立小项,任意时机
```

**推荐顺序**(每步产出可验证软件):
1. §2 依赖补齐 + 子系统7(日志 §10)+ 子系统0(标点差距 §3):基础设施
2. 子系统8(加密 §11):ASR 依赖密钥
3. 子系统5(托盘 §8)+ 子系统4(反馈 §7):用户可见状态闭环(此时仍 Mock 输入)
4. 子系统1(录音 §4)+ 子系统2(ASR §5):真实端到端语音→文本
5. 子系统3(上屏 §6):真实端到端语音→目标输入
6. 子系统6(设置/历史 §9):配置驱动
7. 子系统9(打包验收 §12)

---

## 十四、与现有代码契约对齐备忘

实现各子系统时务必保持以下既有契约不变,避免破坏 MVP 基线:

- **状态机**(`src-tauri/src/state.rs`):`RuntimeState`/`RuntimeEvent`/`AppRuntime::transition` 已定义 8 事件,真实流程直接复用,禁止重命名。
- **IPC 命名**:`commands::preview::{get_app_status, create_mock_preview, confirm_preview}`、`commands::history::list_history` 已注册。新增命令追加到 `lib.rs::generate_handler!`,勿删既有。
- **类型契约**:`PreviewDraft`/`ConfirmPreviewInput` 字段使用 `#[serde(rename = "sourceText")]` 等 camelCase,前端 `types.ts` 保持一致。新增类型同样遵循。
- **DB**:`Database::open/in_memory/insert_history/list_history/get_history_by_id` 既有,扩展方法追加,勿改签名。
- **`preprocess.rs`**:`process_text`/`PreprocessConfig`/`TextMode` 既有,仅补 `asr_provides_punctuation` 字段(带默认值,向后兼容)。

---

> **文档结束**。本开发文档覆盖 PRD 全部未实现功能(第四至第十二章、第十四章),按子系统拆分可直接作为实施依据。建议按 §十三 顺序推进,每子系统完成后对照对应 §N.6 验收章节勾验。
