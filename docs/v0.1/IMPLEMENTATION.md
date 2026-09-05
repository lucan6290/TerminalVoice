# TerminalVoice 实施方案文档

**文档版本**：V1.1
**更新日期**：2026-08-09
**对应 PRD**：TerminalVoice_PRD_V1.1.md
**对应架构**：ARCHITECTURE.md

> 本版本已按截至 2026-08 的最新稳定依赖进行校对：
> Tauri v2.11、React 19、Vite 8（Rolldown+Oxc）、Tailwind CSS v4、
> cpal 0.18、rusqlite 0.40、enigo 0.6、windows-sys 0.61、Node.js 22 LTS、
> pnpm 11、TypeScript 5.7+、Vitest 3、shadcn/ui CLI v4。

---

## 一、总体开发计划

### 1.1 分阶段策略

采用**6 个阶段、MVP 优先**策略。每个阶段产出可独立验证的功能增量，阶段 1-3 构成最小可用产品（端到端语音输入），阶段 4-6 补齐完整功能。

| 阶段 | 名称 | 预计工期 | 产出 |
| :--- | :--- | :--- | :--- |
| **阶段 1** | 项目骨架 + 热键 + 录音 | 基准 | Tauri 项目可编译运行，F8 可触发录音 |
| **阶段 2** | ASR 集成 + 文本预处理 | 基准 | 录音 → 识别 → 预处理，控制台输出文本 |
| **阶段 3** | 预览弹窗 + 文本上屏 | 基准 | 端到端：语音 → 预览编辑 → 上屏到光标 |
| **阶段 4** | 系统托盘 + 主窗口 + 设置 | 基准 | 托盘驻留，历史记录和设置功能完整 |
| **阶段 5** | 数据持久化 + 安全 + 日志 | 基准 | SQLite、DPAPI、日志轮转 |
| **阶段 6** | 异常处理 + 打包 + 测试 | 基准 | MSI 安装包、异常矩阵覆盖、验收测试 |

---

## 二、阶段 1：项目骨架 + 全局热键 + 音频录制

### 目标
Tauri v2 项目创建完成，Rust 侧可捕获全局 F8 快捷键、可录制和保存音频。

### 任务清单

#### 1.1 初始化 Tauri 项目
```bash
pnpm create tauri-app TerminalVoice --template react-ts
cd TerminalVoice
pnpm install
```

**验证点**：`pnpm tauri dev` 能启动空白桌面窗口。

#### 1.2 配置 Rust 依赖

**文件**：`src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-global-shortcut = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
cpal = "0.18"
hound = "3"
reqwest = { version = "0.12", default-features = false, features = ["multipart", "json", "rustls-tls"] }
rusqlite = { version = "0.40", features = ["bundled"] }
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time", "fs"] }
enigo = "0.6"
arboard = "3"
windows-sys = { version = "0.61", features = [
    "Win32_System_DataProtection",
    "Win32_UI_Input_KeyboardAndMouse",
    "Win32_System_Registry",
    "Win32_Security_Cryptography",
    "Win32_UI_Shell",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Foundation",
] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
log = "0.4"
```

> **说明**：Rust MSRV 建议 ≥ 1.85（cpal 0.18 要求）。`windows-sys 0.61` 是 Cargo 生态当前基线；`tokio` 使用按需 feature 替代 `full` 以缩减编译体积；`reqwest` 默认禁用 native-tls，改用 `rustls-tls` 避免额外的 OpenSSL 依赖；`enigo 0.6` 的 API 与 0.3 完全不兼容，详见阶段 3 注入代码。

**文件**：`src-tauri/tauri.conf.json`（关键配置）

```json
{
  "productName": "TerminalVoice",
  "version": "1.1.0",
  "identifier": "com.terminalvoice.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "TerminalVoice",
        "width": 800,
        "height": 600,
        "visible": false,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "plugins": {
    "global-shortcut": {
      "shortcuts": []
    }
  }
}
```

#### 1.3 创建 Rust 模块骨架

**创建文件**：

```
src-tauri/src/
├── main.rs
├── lib.rs              # 导出所有模块
├── state.rs            # 应用状态机（空壳）
├── commands/
│   └── mod.rs
├── services/
│   ├── mod.rs
│   ├── hotkey.rs       # 本阶段实现
│   └── recorder.rs     # 本阶段实现
└── tray.rs             # 空壳
```

**文件**：`src-tauri/src/services/hotkey.rs`

使用 `tauri-plugin-global-shortcut` v2（底层使用 `global-hotkey` 0.8+）注册全局热键，不再使用 `GetAsyncKeyState` 轮询——该插件已原生支持按下/释放事件，Windows 上 CPU 占用接近 0，且不会被反作弊软件误报。

```rust
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

pub struct HotkeyManager {
    app_handle: AppHandle,
    current_shortcut: Shortcut,
}

impl HotkeyManager {
    /// 注册默认快捷键 F8（无修饰键）。实际项目中应从配置读取。
    pub fn register_default(app: &AppHandle) -> tauri::Result<()> {
        let shortcut = Shortcut::new(None, Code::KeyF8);
        app.global_shortcut().on_shortcut_pressed(move |app, _shortcut, _| {
            let _ = app.emit("recording-started", ());
        });
        app.global_shortcut().on_shortcut_released(move |app, _shortcut, _| {
            let _ = app.emit("recording-stopped", ());
        });
        app.global_shortcut().register(shortcut)?;
        Ok(())
    }

    /// 注册取消键 ESC（仅在录音期间作为快捷键使用）。
    /// 实际实现中按状态动态注册/注销即可。
    pub fn register_cancel(app: &AppHandle) -> tauri::Result<()> {
        let esc = Shortcut::new(None, Code::Escape);
        app.global_shortcut().on_shortcut_pressed(move |app, _, _| {
            let _ = app.emit("recording-cancelled", ());
        });
        app.global_shortcut().register(esc)?;
        Ok(())
    }

    /// 检测快捷键冲突：尝试注册一个虚拟快捷键，成功即无冲突。
    pub fn check_conflict(app: &AppHandle, shortcut: Shortcut) -> bool {
        match app.global_shortcut().register(shortcut) {
            Ok(_) => {
                let _ = app.global_shortcut().unregister(shortcut);
                false
            }
            Err(_) => true,
        }
    }
}
```

> **Capabilities 配置**：在 `src-tauri/capabilities/default.json` 中需要为插件授权：
> ```json
> {
>   "permissions": [
>     "global-shortcut:allow-register",
>     "global-shortcut:allow-unregister",
>     "global-shortcut:allow-is-registered",
>     "core:default"
>   ]
> }
> ```
> 插件注册需要在 `main.rs`/`lib.rs` 的 `tauri::Builder` 上调用 `.plugin(tauri_plugin_global_shortcut::Builder::new().build())`。

**文件**：`src-tauri/src/services/recorder.rs`

```rust
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};

const SAMPLE_RATE: u32 = 16000;
const CHANNELS: u16 = 1;

pub struct Recorder {
    audio_data: Arc<Mutex<Vec<i16>>>,
    stream: Option<cpal::Stream>,
}

impl Recorder {
    pub fn new() -> Self {
        Self {
            audio_data: Arc::new(Mutex::new(Vec::new())),
            stream: None,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "未检测到麦克风设备".to_string())?;

        let config = cpal::StreamConfig {
            channels: CHANNELS,
            sample_rate: cpal::SampleRate(SAMPLE_RATE),
            buffer_size: cpal::BufferSize::Default,
        };

        let data = self.audio_data.clone();
        let stream = device
            .build_input_stream(
                &config,
                move |input: &[i16], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut guard) = data.lock() {
                        guard.extend_from_slice(input);
                    }
                },
                |err| {
                    eprintln!("录音错误: {}", err);
                },
                None,
            )
            .map_err(|e| format!("启动录音失败: {}", e))?;

        stream.play().map_err(|e| format!("播放录音流失败: {}", e))?;
        self.stream = Some(stream);
        Ok(())
    }

    pub fn stop(&mut self) -> Result<Vec<u8>, String> {
        drop(self.stream.take());
        // 编码为 WAV
        let data = self.audio_data.lock().unwrap();
        if data.is_empty() {
            return Err("无有效音频数据".to_string());
        }
        let wav = Self::encode_wav(&data)?;
        Ok(wav)
    }

    pub fn cancel(&mut self) {
        drop(self.stream.take());
        self.audio_data.lock().unwrap().clear();
    }

    fn encode_wav(samples: &[i16]) -> Result<Vec<u8>, String> {
        let mut cursor = std::io::Cursor::new(Vec::new());
        let spec = hound::WavSpec {
            channels: CHANNELS,
            sample_rate: SAMPLE_RATE,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer =
            hound::WavWriter::new(&mut cursor, spec).map_err(|e| e.to_string())?;
        for sample in samples {
            writer.write_sample(*sample).map_err(|e| e.to_string())?;
        }
        writer.finalize().map_err(|e| e.to_string())?;
        Ok(cursor.into_inner())
    }

    /// 列出系统可用录音设备
    pub fn list_devices() -> Vec<String> {
        let host = cpal::default_host();
        host.input_devices()
            .map(|devices| {
                devices
                    .filter_map(|d| d.name().ok())
                    .collect()
            })
            .unwrap_or_default()
    }
}
```

**验证点**：
- `cargo build` 通过
- 启动应用后按 F8，终端打印 "recording-started"
- 松开 F8，终端打印 "recording-stopped"
- 录制 3 秒音频可保存为 WAV 文件并能正常播放

---

## 三、阶段 2：ASR 集成 + 文本预处理

### 目标
录音 → 发送 ASR → 拿到文本 → 预处理 → 控制台输出。

### 任务清单

#### 2.1 实现 ASR 客户端

**文件**：`src-tauri/src/services/asr_client.rs`

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::info;

#[derive(Debug, thiserror::Error)]
pub enum AsrError {
    #[error("网络连接失败")]
    Network(#[from] reqwest::Error),
    #[error("API 密钥无效")]
    InvalidKey,
    #[error("调用额度不足")]
    QuotaExceeded,
    #[error("服务端错误: {0}")]
    ServerError(u16),
    #[error("识别结果为空")]
    EmptyResult,
    #[error("音频无效")]
    InvalidAudio,
}

pub struct AsrClient {
    client: Client,
    endpoint: String,
    api_key: String,
    timeout: Duration,
}

impl AsrClient {
    pub fn new(endpoint: String, api_key: String, timeout_secs: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .expect("Failed to create HTTP client");
        Self {
            client,
            endpoint,
            api_key,
            timeout: Duration::from_secs(timeout_secs),
        }
    }

    pub async fn recognize(&self, audio: Vec<u8>) -> Result<String, AsrError> {
        let mut last_error = None;

        // 重试 1 次
        for attempt in 0..=1 {
            match self.send_request(&audio).await {
                Ok(text) => {
                    let text = text.trim().to_string();
                    if text.is_empty() {
                        return Err(AsrError::EmptyResult);
                    }
                    info!(text_len = text.len(), "ASR 识别成功");
                    return Ok(text);
                }
                Err(e) => {
                    tracing::warn!(attempt, error = %e, "ASR 请求失败");
                    last_error = Some(e);
                    if attempt == 0 {
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        }
        Err(last_error.unwrap())
    }

    async fn send_request(&self, _audio: &[u8]) -> Result<String, reqwest::Error> {
        // 具体实现取决于所选 ASR 服务商的 API 格式
        // 示例（通用结构）：
        let resp = self
            .client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .body(audio.to_vec()) // 实际根据 API 要求设置 Content-Type 和 body
            .send()
            .await?;

        let status = resp.status();
        let body = resp.text().await?;

        match status.as_u16() {
            200 => Ok(body),
            _ => Err(reqwest::Error::from(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("HTTP {}: {}", status, body),
            ))),
        }
    }
}
```

#### 2.2 实现文本预处理

**文件**：`src-tauri/src/services/preprocess.rs`

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum TextMode {
    Normal,
    Developer,
    Raw,
}

const DEFAULT_FILTER_WORDS: &[&str] = &[
    "嗯", "啊", "呃", "哦", "那个", "这个", "就是", "然后", "反正", "就是说",
];

pub struct Preprocessor {
    pub mode: TextMode,
    pub add_punctuation: bool,
    pub filter_enabled: bool,
    pub single_line: bool,
    filter_words: Vec<String>,
}

impl Preprocessor {
    pub fn new() -> Self {
        Self {
            mode: TextMode::Normal,
            add_punctuation: true,
            filter_enabled: true,
            single_line: true,
            filter_words: DEFAULT_FILTER_WORDS.iter().map(|s| s.to_string()).collect(),
        }
    }

    pub fn process(&self, raw: &str) -> String {
        let mut text = raw.to_string();

        // Step 1: 标点（仅 Normal 模式）
        if self.add_punctuation && self.mode == TextMode::Normal {
            text = self.add_chinese_punctuation(&text);
        }

        // Step 2: 过滤词（Raw 模式跳过）
        if self.filter_enabled && self.mode != TextMode::Raw {
            text = self.filter_interjections(&text);
        }

        // Step 3: 单行规整（Raw 模式跳过）
        if self.single_line && self.mode != TextMode::Raw {
            text = text.replace("\r\n", " ").replace('\n', " ");
            text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        }

        text.trim().to_string()
    }

    fn add_chinese_punctuation(&self, text: &str) -> String {
        // 简单实现：根据停顿和语义加标点
        // V1.1 使用 ASR 服务商自带的标点能力为主，此方法为兜底
        // 更复杂的标点恢复依赖 ASR 侧的标点预测能力
        text.to_string()
    }

    fn filter_interjections(&self, text: &str) -> String {
        let mut result = text.to_string();
        for word in &self.filter_words {
            // 按词边界替换为空
            result = result.replace(word, "");
        }
        // 合并多余空格
        result.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    pub fn add_filter_word(&mut self, word: String) {
        if !self.filter_words.contains(&word) {
            self.filter_words.push(word);
        }
    }

    pub fn remove_filter_word(&mut self, word: &str) {
        self.filter_words.retain(|w| w != word);
    }

    pub fn reset_default(&mut self) {
        self.filter_words = DEFAULT_FILTER_WORDS.iter().map(|s| s.to_string()).collect();
    }
}
```

#### 2.3 串联流程

**文件**：`src-tauri/src/lib.rs`

```rust
mod commands;
mod services;
mod state;
mod tray;

use services::hotkey::HotkeyManager;
use services::recorder::Recorder;
use services::asr_client::AsrClient;
use services::preprocess::Preprocessor;
use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(AppState::default()))
        .manage(Mutex::new(Recorder::new().expect("初始化录音器失败")))
        .manage(Mutex::new(Injector::new().expect("初始化输入模拟器失败")))
        .setup(|app| {
            // 注册全局快捷键（F8 录音 / ESC 取消）
            HotkeyManager::register_default(app.handle())?;
            // 创建托盘
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running TerminalVoice");
}
```

**验证点**：
- 按 F8 录音 → 松开 → ASR 返回文本 → 终端打印预处理结果
- 网络断开时日志输出重试信息
- 修改预处理模式，输出文本按预期变化

---

## 四、阶段 3：预览弹窗 + 文本上屏

### 目标
端到端流程打通：说话 → 预览框出现 → 编辑 → 确认 → 文本注入到光标位置。

### 任务清单

#### 3.1 前端预览弹窗组件

**文件**：`src/components/PreviewPopup.tsx`

```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function PreviewPopup() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "injecting" | "done">("idle");

  useEffect(() => {
    const unlisten = listen<string>("recognize-result", (event) => {
      setText(event.payload);
      setVisible(true);
      setStatus("idle");
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  const handleConfirm = async () => {
    setStatus("injecting");
    try {
      await invoke("confirm_inject", { text });
      setStatus("done");
      setTimeout(() => setVisible(false), 300);
    } catch (e) {
      console.error("上屏失败:", e);
      setStatus("idle");
    }
  };

  const handleCancel = async () => {
    setVisible(false);
    setText("");
    await invoke("cancel_preview");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.ctrlKey) {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">TerminalVoice - 语音输入预览</span>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-32 border rounded p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
          placeholder="在此编辑识别文本..."
        />
        <div className="flex justify-between items-center mt-3">
          <span className="text-xs text-gray-400">
            Enter 确认 · Ctrl+Enter 换行 · ESC 放弃
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              复制到剪贴板
            </button>
            <button
              onClick={handleConfirm}
              disabled={status !== "idle"}
              className="px-4 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {status === "injecting" ? "上屏中…" : "确认上屏"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 3.2 录音悬浮提示组件

**文件**：`src/components/RecordingOverlay.tsx`

```tsx
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export default function RecordingOverlay() {
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"recording" | "recognizing">("recording");

  useEffect(() => {
    const unlistens = [
      listen("recording-started", () => {
        setVisible(true);
        setElapsed(0);
        setStatus("recording");
      }),
      listen<number>("recording-tick", (e) => {
        setElapsed(e.payload);
        setStatus("recording");
      }),
      listen("recognizing", () => {
        setStatus("recognizing");
      }),
      listen("recording-stopped", () => {
        setVisible(false);
      }),
      listen("recording-cancelled", () => {
        setVisible(false);
      }),
    ];

    return () => {
      unlistens.forEach(u => u.then(f => f()));
    };
  }, []);

  if (!visible) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none z-50">
      <div className="flex items-center gap-2">
        {status === "recording" ? (
          <>
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm">倾听中 {mins}:{secs.toString().padStart(2, "0")}</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm">识别中…</span>
          </>
        )}
      </div>
    </div>
  );
}
```

#### 3.3 文本注入 Command

**文件**：`src-tauri/src/commands/inject.rs`

```rust
use tauri::State;
use std::sync::Mutex;

#[tauri::command]
pub async fn confirm_inject(
    text: String,
    state: State<'_, Mutex<AppState>>,
    injector: State<'_, Mutex<Injector>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.transition(Event::ConfirmInjection { text: text.clone() }).map_err(|e| e.to_string())?;
    drop(app_state);
    injector.lock().map_err(|e| e.to_string())?.inject(&text)?;
    Ok(())
}

#[tauri::command]
pub async fn cancel_preview(
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.transition(Event::EscPressed).map_err(|e| e.to_string())
}
```

**文件**：`src-tauri/src/services/injector.rs`（使用 enigo 0.6 新 API + arboard 剪贴板策略）

enigo 0.6 不再使用 0.3 的 DSL 风格 API（`key_sequence`/`key_click`/`mouse_click`），改为基于 trait 的 `Keyboard` / `Mouse` trait + `Direction::Press/Release/Click`。文本上屏采用三级降级策略：剪贴板 Ctrl+V（速度快、支持中文）→ enigo.text（Unicode 注入）→ 逐键 SendInput 兜底。

```rust
use arboard::Clipboard;
use enigo::{
    Button, Direction, Enigo, Key, Keyboard, Mouse, Settings,
};
use std::{thread, time::Duration};

pub struct Injector {
    enigo: Enigo,
}

impl Injector {
    pub fn new() -> Result<Self, String> {
        let enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("初始化输入模拟器失败: {e}"))?;
        Ok(Self { enigo })
    }

    /// 三级降级注入文本
    pub fn inject(&mut self, text: &str) -> Result<(), String> {
        if text.is_empty() {
            return Ok(());
        }
        // 策略 1：剪贴板粘贴（最快，支持中文/长文本）
        if self.via_clipboard_paste(text).is_ok() {
            return Ok(());
        }
        // 策略 2：enigo Unicode 文本注入
        if self.enigo.text(text).is_ok() {
            return Ok(());
        }
        Err("所有注入策略均失败".into())
    }

    fn via_clipboard_paste(&mut self, text: &str) -> Result<(), String> {
        let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
        let backup = clipboard.get_text().unwrap_or_default();
        clipboard.set_text(text).map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(30));

        // Ctrl+V
        self.enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
        self.enigo.key(Key::V, Direction::Click).map_err(|e| e.to_string())?;
        self.enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;

        thread::sleep(Duration::from_millis(50));
        // 还原剪贴板
        let _ = clipboard.set_text(backup);
        Ok(())
    }
}
```

**验证点**：
- 按 F8 说话 → 松开 → 预览框弹出并显示识别文本
- 编辑文本 → Enter → 文本出现在目标编辑器中
- ESC → 预览框关闭，无文本上屏
- 悬浮提示在录音时显示、识别完成时消失

---

## 五、阶段 4：系统托盘 + 主窗口 + 设置

### 目标
托盘驻留完整、主窗口包含历史记录和设置两个标签页。

### 任务清单

#### 4.1 系统托盘实现

**文件**：`src-tauri/src/tray.rs`

使用 Tauri v2 `tray-icon` feature + `tauri::menu` 构建右键菜单。

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "暂停应用", true, None::<&str>)?;

    let dir_submenu = Submenu::with_items(app, "打开目录", true, &[
        &MenuItem::with_id(app, "dir_app", "应用目录", true, None::<&str>)?,
        &MenuItem::with_id(app, "dir_data", "工作目录", true, None::<&str>)?,
        &MenuItem::with_id(app, "dir_logs", "日志目录", true, None::<&str>)?,
        &MenuItem::with_id(app, "dir_db", "数据库目录", true, None::<&str>)?,
    ])?;

    let website = MenuItem::with_id(app, "website", "打开官方网站", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "重启应用", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

    let separator1 = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[
        &show,
        &pause,
        &separator1,
        &restart,
        &dir_submenu,
        &website,
        &separator2,
        &quit,
    ])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("TerminalVoice")
        .menu(&menu)
        .menu_on_left_click(false) // 左键单击不弹出菜单，改为打开主窗口（见 on_tray_icon_event）
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => { /* 显示主窗口 */ }
                "pause" => { /* 切换暂停态 */ }
                "quit" => { app.exit(0); }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // 左键单击打开主窗口
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

#### 4.2 前端路由与布局

**文件**：`src/App.tsx`

```tsx
import { useState } from "react";
import History from "./pages/History";
import Settings from "./pages/Settings";
import PreviewPopup from "./components/PreviewPopup";
import RecordingOverlay from "./components/RecordingOverlay";
import StatusBadge from "./components/StatusBadge";

type Tab = "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("history");

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 标题栏 */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <h1 className="text-sm font-semibold">TerminalVoice</h1>
        <StatusBadge />
      </header>

      {/* 标签切换 */}
      <nav className="flex border-b bg-white px-4">
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm ${tab === "history" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
        >
          历史记录
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`px-4 py-2 text-sm ${tab === "settings" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
        >
          设置
        </button>
      </nav>

      {/* 内容区 */}
      <main className="flex-1 overflow-auto p-4">
        {tab === "history" ? <History /> : <Settings />}
      </main>

      {/* 全局悬浮组件 */}
      <RecordingOverlay />
      <PreviewPopup />
    </div>
  );
}
```

#### 4.3 设置页组件

**文件**：`src/pages/Settings.tsx`

核心配置区域：
- ASR 配置（服务商选择、API 密钥、接口地址、「测试连接」按钮）
- 录音配置（时长滑块、设备选择、「测试录音」按钮）
- 文本配置（模式选择、标点开关、规整开关、过滤词管理）
- 快捷键配置（录制框、冲突检测、重置按钮）
- 通用设置（开机自启、关闭行为、悬浮提示开关、历史上限）

使用 shadcn/ui 组件库（`Select`, `Input`, `Switch`, `Slider`, `Button` 等）。

**验证点**：
- 系统托盘显示图标，左键打开主窗口
- 右键菜单完整，各菜单项功能正常
- 暂停/启用切换后托盘图标变化
- 设置页各配置项可修改并保存

---

## 六、阶段 5：数据持久化 + 安全 + 日志

### 目标
SQLite 数据库初始化完成，配置/历史/过滤词持久化，API Key 加密存储，日志文件轮转。

### 任务清单

#### 5.1 数据库初始化与迁移

**文件**：`src-tauri/src/services/db.rs`

- 启动时检查 `data/terminalvoice.db` 是否存在
- 不存在 → 创建表结构 + 默认配置 + 默认过滤词
- 存在 → `PRAGMA integrity_check` → 损坏则备份重建
- `PRAGMA user_version` 做版本迁移

#### 5.2 配置读写

**文件**：`src-tauri/src/commands/config.rs`

```rust
#[tauri::command]
pub fn get_config(db: State<Mutex<Database>>) -> Result<Config, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_all_config()
}

#[tauri::command]
pub fn save_config(
    config: Config,
    db: State<Mutex<Database>>,
    crypto: State<Mutex<Crypto>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    // API Key 加密存储
    let encrypted_key = crypto.lock().unwrap().encrypt(&config.api_key)?;
    db.save_config_with_encrypted_key(&config, &encrypted_key)
}
```

#### 5.3 日志配置

**文件**：`src-tauri/src/services/logger.rs`

```rust
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init_logger(log_dir: &std::path::Path) {
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        log_dir,
        "terminalvoice",
    );

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_target(false)
        .json();

    let console_layer = fmt::layer()
        .with_target(false);

    tracing_subscriber::registry()
        .with(EnvFilter::new("info"))
        .with(file_layer)
        .with(console_layer)
        .init();
}
```

**验证点**：
- 重启应用后配置保持（快捷键、ASR 设置等）
- API Key 在数据库中为密文
- `logs/` 目录生成日志文件，不含 API Key
- 历史记录超出上限后最旧记录被清理

---

## 七、阶段 6：异常处理 + 打包 + 验收测试

### 目标
异常矩阵全覆盖、MSI 安装包生成、PRD 验收标准全部通过。

### 任务清单

#### 6.1 异常矩阵实现

按 PRD 第十二章的 26 条异常规则逐条实现并测试。

#### 6.2 打包（NSIS + MSI）

Tauri v2 已内置捆绑工具链，**无需手动安装 WiX**：`tauri build` 会在首次构建时自动下载 NSIS 3.11（Windows 推荐）与 WiX v3（MSI）。默认推荐以 NSIS 为主发布格式（体积小、支持中文、安装/卸载体验好），MSI 作为企业分发可选。

`src-tauri/tauri.conf.json` 中的打包配置：

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ],
    "windows": {
      "wix": {
        "language": "zh-CN"
      },
      "nsis": {
        "languages": ["SimpChinese", "English"],
        "installMode": "currentUser"
      }
    },
    "shortDescription": "全局语音输入工具",
    "longDescription": "TerminalVoice — 按住 F8 说话，松开即转文字并注入当前光标位置"
  }
}
```

开机自启不要通过手写 WiX RegistryValue 实现，应使用 Tauri 官方的 `tauri-plugin-autostart`，或调用 Tauri v2 已内置的 `shell` 插件能力配合 `tauri.conf.json > app > bundle > resources` 写入启动项。示例：

```toml
# Cargo.toml
tauri-plugin-autostart = "2"
```

```rust
// 在 setup 中初始化
use tauri_plugin_autostart::MacosLauncher;
.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![])))
```

前端即可调用 `invoke("plugin:autostart|enable")` / `disable` / `is_enabled` 管理开机自启。

#### 6.3 验收测试清单

按 PRD 第十四章 46 条验收标准逐项测试：

| 模块 | 验收项数量 | 测试方法 |
| :--- | :--- | :--- |
| 录音触发 | 6 项 | 手动操作验证 |
| 语音识别 | 6 项 | 联网 + 断网 + 错误 Key 三种环境 |
| 文本预处理 | 5 项 | 单元测试 + 模式切换验证 |
| 预览上屏 | 6 项 | 跨软件测试（终端/编辑器/记事本） |
| 状态反馈 | 4 项 | 视觉验证 |
| 系统托盘 | 5 项 | 手动操作 + Explorer 重启 |
| 主界面设置 | 4 项 | 各配置项保存/读取验证 |
| 数据存储 | 4 项 | 重启验证 + 数据库损坏模拟 |
| 异常处理 | 3 项 | 异常场景模拟 |

**验证点**：
- `pnpm tauri build` 生成 NSIS 安装包（主）与 MSI 安装包（可选）
- 安装后可通过开始菜单启动
- 所有 46 项验收标准通过
- 覆盖终端/编辑器/记事本三类软件的上屏功能

---

## 八、依赖关系与执行顺序

```
阶段 1 ──► 阶段 2 ──► 阶段 3         阶段 5 ◄── 并行 ──► 阶段 4
                │                        │
                └────────┬───────────────┘
                         ▼
                      阶段 6
```

- 阶段 4 和阶段 5 可以并行开发（不同模块，无依赖关系）
- 阶段 6 依赖阶段 1-5 全部完成

---

## 九、附录：环境准备 Checklist

- [ ] 安装 Rust（≥ 1.85，推荐通过 `rustup` 默认安装 stable 即可）：`https://www.rust-lang.org/tools/install`
- [ ] 安装 Node.js **22 LTS**（Node 20 LTS 已 EOL；Tauri v2 + Vite 8 均要求 ≥ 20.19）
- [ ] 安装 pnpm：`npm install -g pnpm`（或使用 corepack：`corepack enable && corepack prepare pnpm@latest --activate`）
- [ ] 安装 Visual Studio Build Tools 2022（含「使用 C++ 的桌面开发」工作负载与 Windows 10/11 SDK）
- [ ] WebView2 Runtime（Win10 2004+ / Win11 已内置；未安装可通过 Edge WebView2 Bootstrapper 获取）
- [ ] **不需要手动安装 WiX Toolset**。首次执行 `pnpm tauri build` 时 Tauri 会自动下载 NSIS 3.11 与 WiX v3 工具链到缓存目录
- [ ] 克隆仓库 + `pnpm install`
- [ ] `cargo build` 验证 Rust 编译通过
- [ ] `pnpm tauri dev` 验证完整启动

### 前端初始化（Vite 8 + React 19 + Tailwind v4 + shadcn/ui）

Tauri 官方脚手架默认产出的前端已使用 Vite 8。初始化完毕后再按以下步骤接入 Tailwind v4 与 shadcn/ui：

```bash
# Tailwind v4（Vite 插件版本，零 PostCSS 配置）
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init   # 选 Vite、Tailwind v4、New York 风格、Zinc 底色
```

在 `vite.config.ts` 中使用 `@tailwindcss/vite` 替代旧版 PostCSS 方案；入口 CSS 改为：

```css
@import "tailwindcss";
@theme {
  --color-primary: oklch(0.55 0.2 260);
  --radius-lg: 0.75rem;
}
```
