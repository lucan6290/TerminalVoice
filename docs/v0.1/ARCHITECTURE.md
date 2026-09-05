# TerminalVoice 项目架构设计文档

**文档版本**：V1.1
**更新日期**：2026-08-09
**对应 PRD**：TerminalVoice_PRD_V1.1.md

> 2026-08-09 更新：全局热键已从"自实现 `RegisterHotKey` + `GetAsyncKeyState` 轮询"迁移到使用
> `tauri-plugin-global-shortcut` v2（底层 `global-hotkey` 0.8+），原生提供 press/release 事件；
> Rust 依赖按最新稳定版本校对（cpal 0.18 / rusqlite 0.40 / enigo 0.6 / windows-sys 0.61，
> 前端 React 19 + Vite 8 + Tailwind v4）。详见「技术选型」章节。

---

## 一、架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│                    Windows 桌面                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  终端 CLI  │  │ VS Code  │  │ 其他桌面软件输入框  │   │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘   │
│        │              │                │              │
│        └──────────────┼────────────────┘              │
│                       │ SendInput / Clipboard Paste   │
│                       ▼                               │
│  ┌────────────────────────────────────────────────┐   │
│  │              TerminalVoice 进程                    │   │
│  │                                                   │   │
│  │  ┌─────────────────────────────────────────┐     │   │
│  │  │          Rust 后端 (src-tauri)            │     │   │
│  │  │                                          │     │   │
│  │  │  ┌──────────┐  ┌──────────────────────┐  │     │   │
│  │  │  │ 全局热键   │  │   应用状态机 (state)   │  │     │   │
│  │  │  │ hotkey.rs │──▶│  Idle/Recording/     │  │     │   │
│  │  │  └──────────┘  │  Recognizing/Preview  │  │     │   │
│  │  │                 └──────────┬───────────┘  │     │   │
│  │  │                            │               │     │   │
│  │  │  ┌─────────────────────────┼───────────┐  │     │   │
│  │  │  │       Services          │           │  │     │   │
│  │  │  │  ┌────────┐ ┌──────────┐│┌─────────┐│  │     │   │
│  │  │  │  │recorder│ │asr_client│││injector ││  │     │   │
│  │  │  │  │ (cpal) │ │(reqwest) │││(enigo)  ││  │     │   │
│  │  │  │  └────────┘ └────┬─────┘│└────┬────┘│  │     │   │
│  │  │  │                  │      │     │     │  │     │   │
│  │  │  │  ┌───────────────┼──────┼─────┼──┐  │  │     │   │
│  │  │  │  │  preprocess   │ db   │crypto│  │  │     │   │
│  │  │  │  │  (标点/过滤/规整) │(SQLite)│(DPAPI)│  │     │   │
│  │  │  │  └───────────────┴──────┴─────┴──┘  │  │     │   │
│  │  │  └────────────────────────────────────┘  │     │   │
│  │  │                                          │     │   │
│  │  │  ┌─────────────┐  ┌─────────────────┐    │     │   │
│  │  │  │   Commands   │  │  系统托盘 (tray)  │    │     │   │
│  │  │  │  (IPC 桥接)   │  │  Shell_NotifyIcon │    │     │   │
│  │  │  └──────┬──────┘  └─────────────────┘    │     │   │
│  │  └─────────┼────────────────────────────────┘     │   │
│  │            │ Tauri IPC (invoke + events)          │   │
│  │  ┌─────────┼────────────────────────────────┐     │   │
│  │  │   WebView2 (TypeScript + React)          │     │   │
│  │  │   ┌──────┴───────┐  ┌──────────────────┐ │     │   │
│  │  │   │ 主窗口 (Layout)│  │  悬浮窗口 (Overlay) │ │     │   │
│  │  │   │ ┌──────────┐ │  │ ┌──────────────┐ │ │     │   │
│  │  │   │ │ 设置页    │ │  │ │ 录音提示       │ │ │     │   │
│  │  │   │ │ 历史页    │ │  │ │ "倾听中 0:12"  │ │ │     │   │
│  │  │   │ └──────────┘ │  │ └──────────────┘ │ │     │   │
│  │  │   └──────────────┘  │ ┌──────────────┐ │ │     │   │
│  │  │                      │ │ 预览弹窗      │ │ │     │   │
│  │  │                      │ │ (可编辑文本框) │ │ │     │   │
│  │  │                      │ └──────────────┘ │ │     │   │
│  │  │                      └──────────────────┘ │     │   │
│  │  └───────────────────────────────────────────┘     │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 架构分层

| 层 | 职责 | 技术 |
| :--- | :--- | :--- |
| **表示层** | 主窗口 UI、预览弹窗、悬浮提示 | React + TypeScript + Tailwind + shadcn/ui |
| **IPC 桥接层** | Tauri invoke 命令 + Event 事件流 | Tauri v2 IPC |
| **业务逻辑层** | 状态机、音频处理、ASR 调用、文本预处理、文本注入 | Rust |
| **基础设施层** | 数据库、加密、日志、托盘、热键 | Rust + Windows API |
| **外部依赖层** | 云端 ASR API、系统麦克风、剪贴板 | HTTP / Win32 API |

---

## 二、核心模块设计

### 2.1 应用状态机（state.rs）

```
         ┌──────────────────────────────────┐
         │           AppState                 │
         │  ┌──────────────────────────────┐ │
         │  │ current: State               │ │
         │  │ recording_started_at: Instant│ │
         │  │ recording_elapsed: Duration  │ │
         │  │ target_window: Option<HWND>  │ │
         │  │ recognized_text: Option<Str> │ │
         │  │ audio_buffer: Option<Vec<u8>>│ │
         │  └──────────────────────────────┘ │
         └──────────────────────────────────┘
```

**状态枚举：**

```rust
pub enum State {
    Idle,                          // 空闲：可接收快捷键触发
    Recording,                     // 录音中：禁止重复触发
    Recognizing,                   // 识别中：等待 ASR 响应
    Preview { text: String },      // 预览中：悬浮预览框已打开
    Paused,                        // 暂停：快捷键完全无效
}
```

**状态转移：**

```rust
impl AppState {
    pub fn transition(&mut self, event: Event) -> Result<(), Error> {
        match (&self.current, event) {
            (Idle, Event::HotkeyPressed) => {
                // 记录目标窗口句柄，开始录音
                self.capture_target_window();
                self.current = Recording;
                self.start_recording();
            }
            (Recording, Event::HotkeyReleased) => {
                // 停止录音，进入识别
                let audio = self.stop_recording();
                self.current = Recognizing;
                tokio::spawn(asr_recognize(audio));
            }
            (Recording, Event::EscPressed) => {
                // 取消录音
                self.discard_audio();
                self.current = Idle;
            }
            (Recognizing, Event::RecognizeSuccess { text }) => {
                // 识别成功，进入预览
                self.current = Preview { text };
            }
            (Recognizing, Event::RecognizeFailed { error }) => {
                // 识别失败，通知前端
                self.current = Idle;
            }
            (Preview { .. }, Event::ConfirmInjection) => {
                // 确认上屏 → 注入文本 → 保存历史 → 回空闲
                self.inject_text();
                self.save_history();
                self.current = Idle;
            }
            (Preview { .. }, Event::EscPressed) => {
                // 放弃预览
                self.current = Idle;
            }
            (_, Event::TogglePause) if !matches!(self.current, Paused) => {
                self.current = Paused;
            }
            (Paused, Event::TogglePause) => {
                self.current = Idle;
            }
            _ => return Err(Error::InvalidTransition),
        }
        Ok(())
    }
}
```

### 2.2 全局快捷键模块（hotkey.rs）

**职责**：注册全局热键、监听按键按下/释放事件、动态切换快捷键、冲突检测。

**实现方案**：使用 `tauri-plugin-global-shortcut` v2（底层基于 `global-hotkey` crate 0.8+）。
该插件已原生提供 `on_shortcut_pressed` / `on_shortcut_released` 事件，底层会根据平台选择合适实现（Windows 上使用 `RegisterHotKey` 并通过插件维护的消息循环派发，不再需要我们自己轮询 `GetAsyncKeyState`），CPU 占用接近 0，且不会被反作弊软件误报。

```
┌──────────────────────────────┐
│         hotkey.rs             │
│  ┌──────────────────────────┐ │
│  │ register(F8)              │ │
│  │   → app.global_shortcut() │ │
│  │      .register(Shortcut)  │ │
│  └──────────────────────────┘ │
│  ┌──────────────────────────┐ │
│  │ on_shortcut_pressed(cb)  │ │
│  │   → emit "recording-started"│
│  │ on_shortcut_released(cb) │ │
│  │   → emit "recording-stopped"│
│  └──────────────────────────┘ │
│  ┌──────────────────────────┐ │
│  │ check_conflict()          │ │
│  │   → 尝试注册一次再注销      │ │
│  │ unregister()              │ │
│  │   → 释放快捷键             │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

**长按检测逻辑**：由于插件直接给出 press/release 事件，无需后台轮询：

```rust
// 伪代码
fn bind_shortcuts(app: &AppHandle) {
    app.global_shortcut().on_shortcut_pressed(|app, _, _| {
        let pressed_at = Instant::now();
        app.emit("recording-started", ()).ok();
        // 记录按下时间戳到 AppState
        app.state::<Mutex<AppState>>()
            .lock().unwrap().recording_pressed_at = Some(pressed_at);
    });
    app.global_shortcut().on_shortcut_released(|app, _, _| {
        let state = app.state::<Mutex<AppState>>();
        let mut s = state.lock().unwrap();
        if let Some(pressed_at) = s.recording_pressed_at.take() {
            let duration = pressed_at.elapsed();
            drop(s);
            if duration < Duration::from_millis(500) {
                // < 0.5s 视为误触，丢弃
                app.emit("recording-discarded", ()).ok();
            } else {
                app.emit("recording-stopped", ()).ok();
            }
        }
    });
}
```

### 2.3 音频录制模块（recorder.rs）

**职责**：通过 cpal 捕获麦克风音频，输出 WAV 格式 buffer。

```
┌──────────────────────────────────┐
│         recorder.rs               │
│  ┌──────────────────────────────┐ │
│  │ Recorder                      │ │
│  │  - device: Device             │ │
│  │  - config: StreamConfig       │ │
│  │  - buffer: Vec<i16>           │ │
│  │  - stream: Option<Stream>     │ │
│  │                               │ │
│  │  start() → Result<()>         │ │
│  │  stop() → Result<Vec<u8>>    │ │
│  │  cancel()                     │ │
│  │  list_devices() → Vec<Device> │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**音频规格：**
| 参数 | 值 |
| :--- | :--- |
| 采样率 | 16,000 Hz |
| 位深 | 16-bit |
| 声道 | 单声道 (Mono) |
| 中间格式 | PCM (i16) |
| 输出格式 | WAV (hound 编码) |
| 缓冲区大小 | 4096 samples |

**关键实现：**

```rust
impl Recorder {
    pub fn start(&mut self) -> Result<()> {
        self.buffer.clear();
        let buffer_clone = Arc::new(Mutex::new(Vec::new()));

        let stream = self.device.build_input_stream(
            &self.config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                let mut buf = buffer_clone.lock().unwrap();
                buf.extend_from_slice(data);
            },
            |err| { /* 录音错误 → 通知状态机 */ },
            None,
        )?;
        stream.play()?;
        self.stream = Some(stream);
        Ok(())
    }

    pub fn stop(&mut self) -> Result<Vec<u8>> {
        drop(self.stream.take());
        // 将 i16 buffer 编码为 WAV
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(cursor, spec)?;
        for sample in &self.buffer {
            writer.write_sample(*sample)?;
        }
        writer.finalize()?;
        Ok(cursor.into_inner())
    }
}
```

### 2.4 ASR 客户端模块（asr_client.rs）

**职责**：封装对第三方 ASR API 的 HTTP 调用，支持重试、超时、错误码映射。

```
┌──────────────────────────────────┐
│        asr_client.rs             │
│  ┌──────────────────────────────┐ │
│  │ AsrClient                     │ │
│  │  - provider: Provider         │ │
│  │  - api_key: String            │ │
│  │  - endpoint: String           │ │
│  │  - timeout: Duration          │ │
│  │  - retry_count: u8            │ │
│  │                               │ │
│  │  recognize(audio: Vec<u8>)    │ │
│  │    → Result<String, AsrError> │ │
│  └──────────────────────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ AsrError                      │ │
│  │  - NetworkError               │ │
│  │  - Timeout                    │ │
│  │  - InvalidKey                 │ │
│  │  - QuotaExceeded              │ │
│  │  - ServerError(u16)           │ │
│  │  - NoAudio                    │ │
│  │  - EmptyResult                │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**重试策略：**

```rust
pub async fn recognize(&self, audio: Vec<u8>) -> Result<String, AsrError> {
    let mut last_error = None;

    for attempt in 0..=self.retry_count {
        match self.send_request(&audio).await {
            Ok(text) => {
                if text.trim().is_empty() {
                    return Err(AsrError::EmptyResult);
                }
                return Ok(text);
            }
            Err(e) => {
                last_error = Some(e);
                if attempt < self.retry_count {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }
    Err(last_error.unwrap())
}
```

**错误码映射：**

```rust
fn map_http_error(status: StatusCode, body: &str) -> AsrError {
    match status.as_u16() {
        401 | 403 => AsrError::InvalidKey,
        402 | 429 => AsrError::QuotaExceeded,
        500..=599 => AsrError::ServerError(status.as_u16()),
        _ => AsrError::Unknown(body.to_string()),
    }
}
```

### 2.5 文本预处理模块（preprocess.rs）

**职责**：对 ASR 返回文本做标点、过滤、规整处理，支持三种模式。

```
┌──────────────────────────────────┐
│       preprocess.rs              │
│  ┌──────────────────────────────┐ │
│  │ Preprocessor                  │ │
│  │  - mode: TextMode             │ │
│  │  - filter_words: Vec<String>  │ │
│  │  - add_punctuation: bool      │ │
│  │  - single_line: bool          │ │
│  │                               │ │
│  │  process(raw: String) → String│ │
│  └──────────────────────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ TextMode                      │ │
│  │  - Normal    // 标点+过滤+规整 │ │
│  │  - Developer // 不过滤+规整    │ │
│  │  - Raw       // 原样返回       │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**处理流程：**

```rust
pub fn process(&self, raw: &str) -> String {
    let mut text = raw.to_string();

    // Step 1: 标点处理（仅 Normal 模式）
    if self.add_punctuation && matches!(self.mode, TextMode::Normal) {
        text = self.add_chinese_punctuation(&text);
    }

    // Step 2: 口语词过滤（Normal 和 Developer 模式按配置决定）
    if self.mode != TextMode::Raw {
        text = self.filter_interjections(&text);
    }

    // Step 3: 单行规整（Raw 模式跳过）
    if self.single_line && self.mode != TextMode::Raw {
        text = text.replace('\n', " ").replace("\r\n", " ");
        text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    }

    text.trim().to_string()
}
```

### 2.6 文本注入模块（injector.rs）

**职责**：将文本注入到目标输入控件，支持三级降级策略。

```
┌──────────────────────────────────┐
│        injector.rs               │
│  ┌──────────────────────────────┐ │
│  │ inject(text: String)          │ │
│  │   → Result<(), InjectError>   │ │
│  │                               │ │
│  │   优先级链：                    │ │
│  │   1. 激活目标窗口               │ │
│  │   2. 尝试剪贴板粘贴            │ │
│  │   3. 失败 → SendInput 逐字符   │ │
│  │   4. 失败 → 文本留剪贴板 +      │ │
│  │           通知用户手动粘贴      │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**注入流程（使用 enigo 0.6 + arboard 3 新 API）：**

```rust
// enigo 0.6 的 Keyboard/Mouse trait 用法：Key 枚举 + Direction(Press/Release/Click)
use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use arboard::Clipboard;

pub fn inject(&mut self, text: &str) -> Result<(), InjectError> {
    if text.is_empty() { return Ok(()); }

    // 1. 首选：剪贴板 Ctrl+V（支持中文/长文本，速度最快）
    if inject_via_clipboard_paste(&mut self.enigo, text).is_ok() {
        return Ok(());
    }

    // 2. 降级：enigo Unicode 文本注入
    if self.enigo.text(text).is_ok() {
        return Ok(());
    }

    // 3. 兜底：文本写入剪贴板，提示用户手动粘贴
    set_clipboard_text(text)?;
    Err(InjectError::FellBackToClipboard)
}

fn inject_via_clipboard_paste(enigo: &mut Enigo, text: &str) -> Result<(), ()> {
    let mut cb = Clipboard::new().map_err(|_| ())?;
    let backup = cb.get_text().unwrap_or_default();
    cb.set_text(text).map_err(|_| ())?;
    thread::sleep(Duration::from_millis(30));
    enigo.key(Key::Control, Direction::Press).map_err(|_| ())?;
    enigo.key(Key::V, Direction::Click).map_err(|_| ())?;
    enigo.key(Key::Control, Direction::Release).map_err(|_| ())?;
    thread::sleep(Duration::from_millis(50));
    let _ = cb.set_text(backup); // 尽力恢复
    Ok(())
}
```

> 说明：enigo 0.6 已将 0.3 版本的 DSL 方法（`key_sequence`/`key_click`/`mouse_click`/`Enigo::new()` 无参构造）
> 全部移除，改为 `Enigo::new(&Settings)` + `Keyboard`/`Mouse` trait 的方法调用；
> 文本直接使用 `enigo.text(&str)` 做 Unicode 注入，按键组合使用 `enigo.key(Key, Direction)`。
> 因此不再需要手写 Win32 `SendInput` 逐字符路径——enigo 内部已统一处理。

### 2.7 数据库模块（db.rs）

**职责**：SQLite 初始化、迁移、CRUD 操作。

**表结构：**

```sql
-- 配置表
CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 历史记录表
CREATE TABLE IF NOT EXISTS history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,  -- ISO 8601
    source_text TEXT NOT NULL,  -- 原始识别文本（预处理后）
    final_text  TEXT NOT NULL,  -- 最终上屏文本
    text_mode   TEXT NOT NULL,  -- Normal / Developer / Raw
    asr_provider TEXT NOT NULL
);

-- 过滤词表
CREATE TABLE IF NOT EXISTS filter_words (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    word       TEXT NOT NULL UNIQUE,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
```

**初始化与迁移：**

```rust
impl Database {
    pub fn new(path: &Path) -> Result<Self> {
        let db = Connection::open(path)?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        // 版本迁移
        let version: i32 = db.pragma_query_value(None, "user_version", |r| r.get(0))?;
        match version {
            0 => {
                db.execute_batch(CREATE_TABLES_SQL)?;
                db.pragma_update(None, "user_version", 1)?;
                // 插入默认过滤词
                Self::seed_default_filter_words(&db)?;
            }
            v => return Err(Error::UnknownVersion(v)),
        }

        // 完整性检查
        let integrity: String = db.pragma_query_value(None, "integrity_check", |r| r.get(0))?;
        if integrity != "ok" {
            return Err(Error::DatabaseCorrupted);
        }

        Ok(Self { db })
    }
}
```

### 2.8 加密模块（crypto.rs）

```rust
use windows::Win32::Security::Cryptography::CryptProtectData;

pub fn encrypt(plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let blob = DATA_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut out = DATA_BLOB::default();
    unsafe {
        CryptProtectData(
            &blob, None, None, None, None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out,
        )?;
    }
    Ok(out.as_slice().to_vec())
}

pub fn decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    // 调用 CryptUnprotectData
}
```

### 2.9 系统托盘模块（tray.rs）

```
┌──────────────────────────────────┐
│           tray.rs                 │
│  ┌──────────────────────────────┐ │
│  │ TrayManager                   │ │
│  │  - icon_normal: Icon          │ │
│  │  - icon_paused: Icon          │ │
│  │  - menu: Menu                 │ │
│  │                               │ │
│  │  init(app_handle)             │ │
│  │  set_icon(state: State)       │ │
│  │  on_menu_click(callback)      │ │
│  │  handle_explorer_restart()    │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**右键菜单结构 → 触发动作：**

| 菜单项 | 触发动作 |
| :--- | :--- |
| 显示窗口 | 前端 `window.show()` + `window.setFocus()` |
| 暂停/启用 | 切换 `AppState::Paused` |
| 重启应用 | 终止进程 → 重新启动 exe |
| 打开目录 → 应用目录 | `open::that(install_path)` |
| 打开目录 → 工作目录 | `open::that(data_dir)` |
| 打开目录 → 日志目录 | `open::that(log_dir)` |
| 打开目录 → 数据库目录 | `open::that(db_dir)` |
| 打开官方网站 | `open::that("https://github.com/...")` |
| 退出应用 | 清理资源 → `std::process::exit(0)` |

---

## 三、前端模块设计

### 3.1 路由结构

```
App
├── /              → 主窗口 (Layout)
│   ├── History    → 历史记录页（默认标签）
│   └── Settings   → 设置页
├── PreviewPopup   → 预览编辑弹窗（独立 WebView 窗口）
└── RecordingOverlay → 录音悬浮提示（独立 WebView 窗口）
```

### 3.2 前端与 Rust 通信接口

**Tauri Invoke Commands（前端调用 Rust）：**

| Command | 参数 | 返回值 | 说明 |
| :--- | :--- | :--- | :--- |
| `get_app_state` | - | `State` | 获取当前状态 |
| `get_config` | - | `Config` | 获取完整配置 |
| `save_config` | `Config` | `()` | 保存配置 |
| `get_history` | `page, keyword` | `Vec<History>` | 分页查询历史 |
| `delete_history` | `id` | `()` | 删除单条记录 |
| `clear_history` | - | `()` | 清空全部历史 |
| `re_inject` | `id, text` | `()` | 重新上屏历史文本 |
| `get_filter_words` | - | `Vec<FilterWord>` | 获取过滤词列表 |
| `add_filter_word` | `word` | `()` | 新增过滤词 |
| `delete_filter_word` | `id` | `()` | 删除过滤词 |
| `reset_filter_words` | - | `()` | 恢复默认过滤词 |
| `test_asr_connection` | - | `TestResult` | 测试 ASR 连接 |
| `list_audio_devices` | - | `Vec<Device>` | 列出录音设备 |
| `test_recording` | - | `()` | 测试录音并回放 |
| `confirm_inject` | `text` | `()` | 预览框确认上屏 |
| `cancel_preview` | - | `()` | 放弃预览 |
| `check_hotkey_conflict` | `key` | `bool` | 检测快捷键冲突 |

**Tauri Events（Rust 推送前端）：**

| Event | 携带数据 | 触发时机 |
| :--- | :--- | :--- |
| `state-changed` | `{ from, to }` | 状态机每次转移 |
| `recording-tick` | `{ elapsed_secs }` | 录音中每秒推送 |
| `recognize-result` | `{ text }` | 识别成功 |
| `recognize-error` | `{ error_code, message }` | 识别失败 |
| `inject-result` | `{ success, fallback }` | 上屏成功/失败 |
| `device-action` | `{ action, device }` | 设备插拔 |

### 3.3 组件设计

**PreviewPopup.tsx（预览编辑弹窗）：**

```
┌─────────────────────────────────────┐
│ TerminalVoice - 语音输入预览     [_][X]│
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 这是一个可编辑的文本区域         │  │
│  │ 用户可以自由修改内容            │  │
│  │ Enter 确认 / Ctrl+Enter 换行   │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  [复制到剪贴板]           [确认上屏]  │
│           Enter=确认  ESC=放弃      │
└─────────────────────────────────────┘
```

状态：`idle / success / error`

**Settings.tsx（设置页）：**

```
┌─────────────────────────────────────┐
│ 设置                         [历史] │
├─────────────────────────────────────┤
│ ▶ ASR 配置                          │
│   ┌─ 服务商: [下拉选择] ──────────┐ │
│   ├─ API密钥: [****] [测试连接] ──┤ │
│   └─ 接口地址: [________] ────────┘ │
│ ▶ 录音配置                          │
│ ▶ 文本配置                          │
│ ▶ 快捷键配置                        │
│ ▶ 通用设置                          │
│                                     │
│ [清除所有本地数据]                   │
└─────────────────────────────────────┘
```

---

## 四、数据流

### 4.1 完整用户操作链路

```
时间轴 →

用户按下 F8
  │
  ├─[Rust: hotkey] WM_HOTKEY 触发
  │   ├─ 捕获目标窗口句柄
  │   └─ State: Idle → Recording
  │       └─[Event] → 前端: "state-changed"
  │           └─[React] 打开 RecordingOverlay 悬浮窗口
  │
  ├─[Rust: recorder] cpal 录音开始
  │   └─[Event → 前端] "recording-tick" (每秒)
  │       └─[React] 更新 "倾听中 0:03"
  │
用户松开 F8
  │
  ├─[Rust: hotkey] 检测松开 → 录音时长 > 0.5s ✓
  │   └─[Rust: recorder] 停止录音 → WAV buffer
  │       └─ State: Recording → Recognizing
  │           └─[Event] → 前端: "识别中…"
  │
  ├─[Rust: asr_client] HTTP POST 音频到 ASR API
  │   ├─ 失败 → 重试 1 次
  │   │   └─ 仍失败 → State: Recognizing → Idle
  │   │       └─[Event] → 前端: "recognize-error"
  │   │           └─[React] 托盘气泡提示
  │   │
  │   └─ 成功 → 拿到 raw_text
  │       └─[Rust: preprocess] 标点/过滤/规整
  │           └─ State: Recognizing → Preview { text }
  │               └─[Event] → 前端: "recognize-result"
  │                   └─[React] 打开 PreviewPopup
  │
用户编辑文本 → Enter 确认
  │
  ├─[React] invoke("confirm_inject", { text })
  │   └─[Rust: injector]
  │       ├─ 隐藏预览框
  │       ├─ 激活目标窗口 → 恢复焦点
  │       ├─ 剪贴板粘贴 / SendInput
  │       └─ State: Preview → Idle
  │           ├─[Rust: db] 写入 history 表
  │           └─[Event] → 前端: "inject-result"
  │               └─[React] 关闭 PreviewPopup
```

### 4.2 暂停/恢复流程

```
用户点击"暂停"
  │
  ├─ 任何状态 → Paused
  │   ├─ 录音中 → 终止录音，丢弃音频
  │   ├─ 预览中 → 关闭预览框
  │   └─ 识别中 → 后台继续，但不弹预览框
  │
  └─ 托盘图标切换为暂停态

用户点击"启用"
  │
  └─ Paused → Idle
      └─ 托盘图标恢复运行态
```

---

## 五、安全与隐私架构

```
┌──────────────────────────────────────────┐
│              数据安全边界                   │
│                                           │
│  本地存储（不上传）                         │
│  ┌───────────────┐  ┌──────────────────┐  │
│  │ SQLite        │  │ 日志文件          │  │
│  │ - config      │  │ - 不记录 Key 明文  │  │
│  │ - history     │  │ - 不记录音频内容   │  │
│  │ - filter_words │  │ - 不记录完整文本   │  │
│  └───────────────┘  └──────────────────┘  │
│  ┌───────────────┐                        │
│  │ DPAPI 加密     │                        │
│  │ - API Key     │                        │
│  └───────────────┘                        │
│                                           │
│  网络传输（仅在用户触发）                    │
│  ┌──────────────────────────────────────┐  │
│  │ ASR API 请求                          │  │
│  │ - 音频数据 → 用户选择的 ASR 服务商    │  │
│  │ - 不包含本地数据                     │  │
│  │ - 无遥测 / 无版本检查                 │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## 六、关键技术决策与风险

| 决策 | 选择 | 理由 | 风险 | 缓解 |
| :--- | :--- | :--- | :--- | :--- |
| 桌面框架 | Tauri v2（≥ 2.5） | Rust 核心逻辑 + WebView UI，体积小性能好；生态成熟 | WebView2 在精简版 Windows 上可能未安装 | Tauri 捆绑包会自带 WebView2 Bootstrapper，首次启动自动引导安装 |
| 全局热键 | `tauri-plugin-global-shortcut` v2（底层 `global-hotkey` 0.8+） | 插件已原生提供 press/release 事件，无轮询；跨平台封装 | 与其他全局热键程序冲突 | 启动时注册失败给出明确提示 + 快捷键冲突检测 API |
| 音频路由 | cpal 0.18 | Rust 生态最成熟的跨平台音频库；0.18 新增 Linux PipeWire/PulseAudio 原生后端，MSRV 1.85 | Windows WASAPI 共享/独占模式差异 | 使用默认配置（共享模式）即可，与系统其他应用共存 |
| 文本注入 | arboard（剪贴板）+ enigo 0.6（Unicode 注入） | 三级降级：剪贴板 Ctrl+V（最快，支持中文）→ `enigo.text` → 逐键 fallback | 覆盖用户剪贴板内容 | 注入前保存剪贴板 → 注入后延迟 50ms 恢复 |
| 状态管理（前端） | Zustand 5 | 轻量、无 Provider、TS 友好，相比 Redux 模板代码少 | 生态 < Redux | 对于本项目规模足够；避免过度工程 |
| 构建工具 | Vite 8（Rolldown + Oxc） | 首版基于 Rust 的 Vite，构建速度比 Vite 5 提升数倍；`@vitejs/plugin-react` v6 改用 Oxc，不再依赖 Babel | 少数 Vite 插件尚未适配 Rolldown | 优先使用官方/主流插件；TS 路径别名由 Vite 内置解析，无需 `vite-tsconfig-paths` |
| UI 方案 | React 19 + Tailwind CSS v4 + shadcn/ui CLI v4 | React 19 稳定、Tailwind v4 Oxide 引擎体积更小/构建更快；shadcn/ui 原生支持 v4 零配置 | shadcn/ui 新 base-nova 风格组件替换部分 Radix | 沿用默认 New York + Zinc 主题即可；组件按需拷贝 |
| ASR 集成 | 先集成 1 家，接口抽象化 | 减少 V1.1 工作量 | 服务商 API 变更 | 抽象 trait + 配置文件切换 |
| 打包 | Tauri 内置 NSIS 3.11（主） + WiX v3（MSI，可选） | 无需手动安装 WiX；`tauri build` 自动下载工具链；NSIS 中文支持好、体积小 | MSI 企业分发场景定制复杂 | MSI 仅作为可选 target，主发布用 NSIS；开机自启用 `tauri-plugin-autostart` 而非手写注册表 |

---

## 七、技术指标验证

| PRD 指标 | 目标 | 验证方法 | 预期结果 |
| :--- | :--- | :--- | :--- |
| 内存 ≤ 100MB | 后台常驻 | Task Manager 24h 监控 | Tauri + WebView2 ≈ 50-70MB |
| 冷启动 ≤ 2s | 双击 exe 到托盘就绪 | `Measure-Command` 多次平均 | Rust 原生 ≈ 0.5-1s |
| ASR 端到端 ≤ 3s | 松开按键到预览框弹出 | 短句录制计时 | 取决于网络，客户端 < 0.5s |
| 24h 内存增量 ≤ 10MB | 后台常驻 | 每小时采样 RSS | Tauri 内存管理成熟 |
| CPU 空闲 < 1% | 后台常驻 | Task Manager | 无轮询任务时基本为 0 |
