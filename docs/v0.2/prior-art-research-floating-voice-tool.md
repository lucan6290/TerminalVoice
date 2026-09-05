# Prior Art 研究报告：浮球式语音 + AI 文字整理工具

**研究日期**：2026-09-05
**研究意图**：在动手实现「浮球式」语音工具前，调研外部是否已存在可复用、可借鉴、可改造的成熟开源方案。
**目标产品形态**：Windows 后台常驻的**悬浮小球 + 极简界面**工具，将语音输入、AI 文字整理、语音改写串联为一个整体；保留现有「云端 ASR + 预处理」能力，叠加本地离线引擎。

## 一、研究意图与约束

### 产品形态

- **桌面版悬浮小球 + 极简界面**：后台常驻浮球，交互极简（对应 PomeType 的浮球形态）。
- **保留「云端 ASR + 预处理」**：现有 TerminalVoice 的云端 ASR 与文本预处理链路保留，作为在线识别主路径。
- **叠加本地离线引擎**：下载本地模型后，断网时完成基础听写（在线/离线双模式）。

### 两个核心动作

| 动作 | 触发 | 行为 |
| :--- | :--- | :--- |
| **说** | 默认按住 `Right Alt` 说话，松开 | 语音识别 + AI 整理后，把文字写入当前焦点输入框；可切换「免提模式」（按一次开始、再按一次提交） |
| **改** | 选中输入框文字，按触发键后口述修改要求 | 将选中文本 + 语音指令发送给 LLM 改写，结果自动替换原选区 |

### 主要功能清单

| 功能 | 说明 | 现状 |
| :--- | :--- | :--- |
| 语音输入 | 按住热键录音 → ASR 识别 → 文本注入当前焦点输入框；在线走用户配置的云端 ASR，离线走本地 Whisper/SenseVoice | 规划中（状态机已完成，录音/ASR/注入未实现） |
| AI 文字整理 | 识别结果可选「原意校对 / 自然润色 / 结构整理」三种 LLM 后处理模式，也可关闭整理直接输出原文 | 规划中（规则级预处理已完成，LLM 调用未实现） |
| 语音改写 | 选中输入框已有文字 → 按触发键口述修改要求 → LLM 改写 → 自动替换选区 | 规划中（文本捕获/LLM 改写/写回注入均未实现） |
| 基础离线听写 | 下载本地模型后，断网时自动切换离线引擎完成基础语音转写 | 规划中（无本地模型推理代码） |
| 个人词典 | 自定义口语过滤词，支持增删改查 | 部分实现（DB 表结构 + 默认种子数据已有，CRUD 接口未暴露） |
| 历史记录 | 查看过往识别/改写记录 | 部分实现（列表查询已有，删除/搜索/重新上屏未实现） |
| 数据备份与恢复 | 导出/导入配置、词典、历史等用户数据 | 规划中 |
| 剪贴板恢复 | 语音输入完成后恢复用户原始剪贴板内容 | 规划中 |

### 目标用户

- 经常在微信、浏览器、Word/WPS、笔记、编辑器和终端里输入文字的 Windows 用户。
- 不想配置模型、命令行或 API Key，希望安装后直接使用中文 AI 语音输入的人。
- 需要断网时继续完成基础听写的人。

### 产品边界

- 仅支持 Windows 10 / 11 x64。
- 不适合 macOS、Linux、移动端、企业内网部署或「所有功能完全离线」的用户。

### 技术栈约束

- 现有代码库为 **Rust + Tauri v2 + React 19 + TypeScript + Tailwind CSS**（与 TerminalVoice 同栈）。
- 优先选择 MIT / Apache 等宽松 License，**规避 GPL 传染性**。

## 二、候选清单

### Direct（直接同类：全局语音听写/输入工具）

| 项目 | 语言/栈 | License | 定位 | Stars | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [Handy](https://github.com/cjpais/Handy) | Rust + Tauri v2 + React | MIT | 离线语音转文字，按住说话→松开写入焦点输入框 | 31,031 | 活跃（今日仍 push） |
| [Freely 语音输入法](https://soft.china.com/down/2312449.html) | Windows 原生 | 开源 | 本地离线 Whisper 听写，全局系统级输入 | — | 未知 |
| [AuraScribe](https://aurascribe.dev/) | Rust | MIT | Windows 语音听写，热键触发→文本注入任意应用 | 2 | 低活跃 |
| [whisper-dictation](https://github.com/foges/whisper-dictation) | Python + Whisper | — | 多平台后台听写，全局热键，完全离线 | — | 维护中 |
| [audiov](https://github.com/WhiteSmoogy/audiov) | whisper.cpp + fcitx5 | — | Linux 语音打字，本地识别 + fcitx5 注入 | — | 低活跃 |

### Related（相邻：语音 + AI 整理 / 改写）

| 项目 | 语言/栈 | License | 定位 | Stars | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [LessAI](https://github.com/GTJasonMK/lessAI) | Rust + Tauri 2 | MIT | 中文改写工作台（可审阅/回滚/写回） | 496 | 低活跃 |

### 参考对象（非开源）

| 项目 | 说明 |
| :--- | :--- |
| [PomeType](https://github.com/ShiliuX-Team/pometype) | 用户指定的参考产品。Windows 浮球式 AI 语音助手（说/听/译/改写/口译/离线），GitHub 仓库仅为官方资料（无源码，无 License） |

## 三、复用决策矩阵

### 1. 「说」+「离线听写」+「AI 整理」→ **Adapt Handy**

| 维度 | 评估 |
| :--- | :--- |
| License | MIT，可商用、可闭源改造 |
| 活跃度 | 31k★ / 2.8k fork / 今日仍 push |
| 技术契合 | Rust + Tauri v2 + React + Tailwind，与现有代码库 100% 同栈 |
| 可复用核心 crate | 见下方「Handy 核心 Crate 清单」 |

Handy 官方定位即「最容易 fork 的语音转文字工具」，录音/推理/VAD/注入这套最硬核链路已获大规模验证，不应从零重造。复用策略：**保留现有「云端 ASR + 预处理」作为在线主路径**，Handy 用于复用「离线听写引擎 + 文本注入 + 全局热键」链路，两者共存。

#### Handy 核心 Crate 清单（基于 Handy Cargo.toml 验证）

| Crate | Handy 使用版本 | 来源 | 功能 | TerminalVoice 用途 |
| :--- | :--- | :--- | :--- | :--- |
| `transcribe-cpp` | 0.2.0 | crates.io | whisper.cpp / GGML 后端 Rust 绑定，支持 Vulkan/Metal GPU 加速 | 离线 Whisper 模型推理 |
| `transcribe-rs` | 0.3.8 (features: onnx) | crates.io | 多引擎转写库（Parakeet/SenseVoice/Moonshine 等 ONNX 模型） | 离线 SenseVoice/Parakeet 推理 |
| `cpal` | 0.16.0 | crates.io | 跨平台低级音频 I/O（rustaudio 组织维护） | 麦克风录音采集 |
| `vad-rs` | git (cjpais/vad-rs) | Git fork | 基于 Silero VAD 的语音活动检测 | 静音检测、自动断句 |
| `rdev` | git (rustdesk-org/rdev) | Git fork | 全局键盘/鼠标事件监听与模拟（Windows 使用 WH_KEYBOARD_LL 钩子） | Right Alt 热键监听 |
| `rubato` | 0.16.2 | crates.io | 音频采样率转换，支持 SIMD 加速 | 麦克风采样率 → 模型要求采样率 |
| `enigo` | 0.6.1 | crates.io | 跨平台键盘/鼠标模拟（text/key/button） | 识别结果文本注入焦点输入框 |

> **注意**：`vad-rs` 和 `rdev` 在 Handy 中使用的是 Git fork 而非 crates.io 原版，集成时需使用相同的 Git 依赖声明。

### 2. 「语音改写」→ **组合自研**

无完全对应的现成单项目，本质是能力编排：

- 语音改写 = 文本捕获 + STT + LLM 改写 + 写回注入（四块 Handy 均已具备）。

[LessAI](https://github.com/GTJasonMK/lessAI) 的「修改对 / Diff / 可回滚 / Finalize 写回」设计值得借鉴，但它是整篇文档改写工作台，与「选中文本即时改写」粒度不同，仅参考交互范式。

## 四、决策建议

**Adapt（以 Handy 为底座扩展），而非 Build from scratch。**

理由：

1. Handy 与现有技术栈完全一致，MIT 可自由改造；
2. 「说 + 离线听写 + AI 整理 + 文本注入」核心链路已被 31k 星项目验证；
3. 新增的「语音改写」为薄层叠加（LLM prompt + 写回注入），非核心难点。

### 关键决策记录（已确认）

**服务后端模式：沿用 TerminalVoice 的「用户自带 Key」模式（选项 A）。**

即用户自己配置 ASR / LLM 服务的 API Key，本地可控、隐私优先，不内置官方云服务。影响：

- 「说」的识别走用户配置的 ASR（云端主路径）+ 本地离线引擎（断网兜底）；
- 「AI 整理 / 改写」走用户配置的 LLM API；
- 不做 PomeType 式的「官方云 + 零配置」后端，无需运营自建服务。

## 五、代码库现状（截至 2026-09-05）

### 已实现模块

| 模块 | 文件 | 状态 | 说明 |
| :--- | :--- | :--- | :--- |
| 状态机 | `src-tauri/src/state.rs` | ✅ 完成 | 5 状态（Idle/Recording/Recognizing/Preview/Paused）、8 事件、7 个单元测试 |
| 文本预处理 | `src-tauri/src/services/preprocess.rs` | ✅ 完成 | 3 模式（Normal/Developer/Raw）、10 个默认过滤词、5 个单元测试 |
| SQLite 数据库 | `src-tauri/src/services/db.rs` | ✅ 完成 | 3 表（config/history/filter_words）、WAL 模式、2 个单元测试 |
| IPC 命令 | `src-tauri/src/commands/` | ⚠️ 骨架 | 4 个命令：get_app_status、create_mock_preview、confirm_preview、list_history |
| 悬浮小球 UI | `src/windows/ball/BallWindow.tsx` | ⚠️ 纯前端 | 4 状态视觉 + 拖拽，未连接后端状态机 |
| 极简面板 UI | `src/windows/panel/PanelWindow.tsx` | ⚠️ 纯前端 mock | 设置项均为内存状态，Tab 页显示"待实现" |
| 前端类型契约 | `src/lib/types.ts` + `commands.ts` | ✅ 完成 | AppStatus/TextMode/HistoryItem/PreviewDraft 类型定义 |
| Zustand Store | `src/stores/appStore.ts` | ⚠️ 纯前端 | PanelState 状态管理，与后端 AppRuntime 无连接 |
| PreviewPopup | `src/components/PreviewPopup.tsx` | ✅ 完成 | 预览编辑 + 确认/取消，2 个前端测试 |

### 未实现模块

| 模块 | 当前状态 | 所需依赖 |
| :--- | :--- | :--- |
| 全局热键监听 | 无 | `rdev`（Git fork）+ Tauri global-shortcut 插件注册 |
| 麦克风录音 | 无 | `cpal` 0.16.0 |
| 音频重采样 | 无 | `rubato` 0.16.2 |
| VAD 静音检测 | 无 | `vad-rs`（cjpais Git fork） |
| 云端 ASR 客户端 | 无 | `reqwest` + 具体 ASR API 对接 |
| 离线模型推理 | 无 | `transcribe-cpp` 0.2.0 / `transcribe-rs` 0.3.8 |
| 文本注入 | 无 | `enigo` 0.6.1 |
| LLM HTTP 客户端 | 无 | `reqwest` + OpenAI 兼容 API |
| 系统托盘 | 无 | `tauri-plugin-tray` 或 Tauri v2 tray API |
| 配置持久化 | DB 表已建，无读写代码 | config 表 CRUD IPC 命令 |
| DPAPI 加密 | 无 | `windows-sys` 或 `keyring` crate |
| 剪贴板备份/恢复 | 无 | `arboard` 或 `@tauri-apps/plugin-clipboard-manager` |
| 数据备份/导出 | 无 | zip 打包逻辑 |

### 前后端断开问题

- 后端 `AppRuntime` 状态机与前端 `BallWindow` 的 `BallState` **完全独立**，无同步机制
- 前端 `commands.ts` 定义了 `getAppStatus()` 但**没有任何组件调用它**
- 前端 `appStore` 中的 recording/soundOn/muteSys/autoStart 均为纯内存状态，刷新丢失
- `capabilities/default.json` 仅对 main 窗口声明了 `core:default` 权限，ball/panel 窗口**未声明任何权限**
- package.json 中声明的 4 个 Tauri 插件（global-shortcut/clipboard-manager/dialog/shell）**均未在后端注册，也未在前端 import**

### 现有 Rust 依赖

```toml
tauri = "2"
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
rusqlite = { version = "0.40", features = ["bundled"] }
```

### 现有前端依赖（与功能相关的）

```json
"@tauri-apps/api": "^2.11.0",
"@tauri-apps/plugin-global-shortcut": "^2.3.0",
"@tauri-apps/plugin-clipboard-manager": "^2.3.0",
"zustand": "^5.0.0",
"lucide-react": "^0.553.0"
```

## 六、基础设施缺失项与实现要求

以下是实现四个保留功能所必需的基础设施，按依赖关系排序。

### 6.1 全局热键监听

- **目标**：捕获 Right Alt 按住/松开事件，驱动状态机 HotkeyPressed / HotkeyReleasedWithValidAudio / HotkeyReleasedTooShort
- **方案**：使用 `rdev`（rustdesk-org Git fork），在独立线程中运行 `listen(callback)` 阻塞监听
- **需新增 Cargo 依赖**：`rdev = { git = "https://github.com/rustdesk-org/rdev" }`
- **需修改**：`lib.rs` 中启动热键监听线程；`state.rs` 的 transition 方法由热键回调触发
- **注意**：rdev 在 Windows 上使用 WH_KEYBOARD_LL 钩子，需要消息循环；Right Alt 对应 `Key::AltGr`

### 6.2 麦克风录音

- **目标**：按住热键期间采集 PCM 音频流，松开后传递给 ASR
- **方案**：使用 `cpal` 0.16.0，枚举输入设备 → 选择默认/用户指定麦克风 → build_input_stream → 收集 f32 样本到 Vec
- **需新增 Cargo 依赖**：`cpal = "0.16.0"`
- **需新增模块**：`src-tauri/src/services/recorder.rs`
- **关键参数**：采样率 16000 Hz（Whisper/SenseVoice 要求）、单声道、f32 格式

### 6.3 音频重采样

- **目标**：将麦克风的实际采样率（通常 44100/48000）转换为模型要求的 16000 Hz
- **方案**：使用 `rubato` 0.16.2 的 Fft resampler
- **需新增 Cargo 依赖**：`rubato = "0.16.2"`
- **集成位置**：recorder.rs 中，cpal 回调内实时重采样

### 6.4 VAD 静音检测

- **目标**：检测语音起止，支持「免提模式」自动断句；过滤短于阈值的无效录音
- **方案**：使用 `vad-rs`（cjpais Git fork），基于 Silero VAD ONNX 模型
- **需新增 Cargo 依赖**：`vad-rs = { git = "https://github.com/cjpais/vad-rs", default-features = false }`
- **集成位置**：recorder.rs 中，每帧音频送入 VAD 判断是否有语音活动

### 6.5 文本注入

- **目标**：将识别/改写结果写入当前焦点输入框
- **方案**：使用 `enigo` 0.6.1，通过 `Enigo::text()` 模拟键盘输入
- **需新增 Cargo 依赖**：`enigo = "0.6.1"`
- **需新增模块**：`src-tauri/src/services/injector.rs`
- **注意**：enigo 的 `text()` 在某些应用（如微信）中可能需要回退到逐字符 `key(Unicode(c))` 方式

### 6.6 配置持久化

- **目标**：将用户设置（ASR provider/key、LLM endpoint/key、热键、麦克风选择等）持久化到 SQLite config 表
- **现状**：config 表 schema 已存在（key TEXT PK, value TEXT NOT NULL），但无任何读写代码
- **需新增**：config 表的 get/set/list IPC 命令；前端 appStore 初始化时从后端加载配置
- **需新增模块**：`src-tauri/src/services/config.rs`

### 6.7 LLM HTTP 客户端

- **目标**：调用用户配置的 OpenAI 兼容 API，用于 AI 文字整理和语音改写
- **需新增 Cargo 依赖**：`reqwest = { version = "0.12", features = ["json", "stream"] }`、`tokio`（reqwest 运行时）
- **需新增模块**：`src-tauri/src/services/llm.rs`
- **接口设计**：支持自定义 endpoint + api_key + model；支持流式响应（SSE）；支持非流式 fallback

### 6.8 云端 ASR 客户端

- **目标**：对接至少一家云端 ASR 服务商 API
- **需新增 Cargo 依赖**：`reqwest`（同上）
- **需新增模块**：`src-tauri/src/services/asr_cloud.rs`
- **接口设计**：trait AsrProvider { async fn recognize(&self, audio: &[f32]) -> Result<String> }；支持多 provider 切换

### 6.9 系统托盘

- **目标**：后台常驻入口，提供打开面板/退出等操作
- **方案**：Tauri v2 内置 tray API（`tauri::tray::TrayIconBuilder`）
- **需修改**：`lib.rs` 中构建 TrayIcon；准备托盘图标资源

### 6.10 Capabilities 权限补全

- **现状**：`capabilities/default.json` 仅对 main 窗口声明 `core:default`
- **需修改**：为 ball 和 panel 窗口添加权限声明；启用 global-shortcut、clipboard-manager 等插件权限

## 七、里程碑排序

基于依赖关系和功能价值，建议以下实施顺序。每个里程碑交付可验证的最小可用增量。

### M1：配置持久化 + 前后端状态同步

**目标**：打通前后端通信链路，使设置可保存、状态可同步。

| 任务 | 产出 |
| :--- | :--- |
| config 表 CRUD IPC 命令 | get_config / set_config / list_config |
| 前端 appStore 初始化加载配置 | 启动时调用 get_config 填充 store |
| BallWindow 连接后端状态机 | 定时轮询 getAppStatus() 或通过 Tauri event 推送 |
| capabilities 权限补全 | ball/panel 窗口权限声明 |

**验收标准**：修改面板设置 → 重启应用 → 设置保留；浮球状态与后端状态机一致。

### M2：全局热键 + 录音 + 文本注入

**目标**：实现「按住 Right Alt 说话 → 松开 → 文本写入焦点输入框」的最小闭环（使用 mock ASR）。

| 任务 | 产出 |
| :--- | :--- |
| rdev 热键监听线程 | Right Alt 按下/松开 → 状态机事件 |
| cpal 录音模块 | recorder.rs：设备枚举 + 音频采集 + 重采样 |
| enigo 文本注入模块 | injector.rs：text() 注入 + 回退策略 |
| 替换 create_mock_preview | 真实录音 → 预处理 → 注入（ASR 暂用 mock） |

**验收标准**：按住 Right Alt 对着麦克风说话 → 松开 → 预处理后的文本出现在当前焦点输入框。

### M3：云端 ASR 集成

**目标**：接入真实云端 ASR，替换 mock 识别。

| 任务 | 产出 |
| :--- | :--- |
| ASR 客户端模块 | asr_cloud.rs：trait AsrProvider + 至少 1 家服务商实现 |
| 配置界面 | 面板中添加 ASR provider 选择 + API Key 输入 |
| 状态机扩展 | Recording → Recognizing → Preview 真实流转 |

**验收标准**：按住热键说话 → 云端返回识别结果 → 预览确认 → 注入。

### M4：AI 文字整理

**目标**：识别结果经 LLM 后处理后再上屏。

| 任务 | 产出 |
| :--- | :--- |
| LLM 客户端模块 | llm.rs：OpenAI 兼容 API 调用（流式 + 非流式） |
| 三种整理模式 prompt | 原意校对 / 自然润色 / 结构整理 |
| 配置界面 | 面板中添加 LLM endpoint/key/model + 整理模式选择 |
| PreviewPopup 接入 | 展示整理前后对比，支持编辑后确认 |

**验收标准**：说话 → ASR 识别 → LLM 整理 → 预览编辑 → 确认注入。

### M5：语音改写

**目标**：选中已有文字 → 口述修改要求 → LLM 改写 → 替换选区。

| 任务 | 产出 |
| :--- | :--- |
| 选区文本捕获 | 通过剪贴板探测或 UI Automation 获取选中文本 |
| 改写 prompt 模板 | 选中文本 + 语音指令 → 改写结果 |
| 改写流程串联 | 触发改写 → 录音 → ASR → LLM 改写 → 注入替换 |
| 状态机扩展 | 新增 RewriteRecording / RewriteRecognizing / RewritePreview 状态（或复用现有状态 + mode 标记） |

**验收标准**：在任意输入框选中文字 → 按触发键说"改成更正式的语气" → 选区被改写结果替换。

### M6：基础离线听写

**目标**：断网时使用本地模型完成语音转写。

| 任务 | 产出 |
| :--- | :--- |
| 离线推理模块 | transcribe-cpp / transcribe-rs 集成 |
| 模型下载管理器 | 模型列表 + 下载进度 + 完整性校验 + 存储路径 |
| 在线/离线自动切换 | 网络检测 → 优先云端 → 失败时降级离线 |
| VAD 集成 | vad-rs 静音检测，支持免提模式自动断句 |

**验收标准**：断开网络 → 按住热键说话 → 本地模型返回识别结果 → 注入。

### M7：本地工具补全

**目标**：完善个人词典、历史记录、备份恢复、剪贴板恢复。

| 任务 | 产出 |
| :--- | :--- |
| 个人词典 CRUD | filter_words 表增删改查 IPC + 前端编辑界面 |
| 历史记录增强 | 删除/搜索/重新上屏/复制 |
| 数据备份/恢复 | zip 导出 DB + config → 导入还原 |
| 剪贴板恢复 | 注入前保存剪贴板 → 注入后恢复 |

**验收标准**：所有本地工具功能可用，数据不丢失。

## 八、Handy 集成预验证计划

在正式开发 M2 之前，必须先验证 Handy 核心 crate 可在 TerminalVoice 项目中正常工作。

### 验证项 1：rdev 热键监听

- 创建最小 Rust 示例，引入 `rdev = { git = "https://github.com/rustdesk-org/rdev" }`
- 在 Tauri setup hook 中启动监听线程
- 验证 Right Alt 按下/松开事件可被捕获并打印日志
- **通过标准**：连续 10 次按下/松开均正确触发事件，无误报

### 验证项 2：cpal 录音 + rubato 重采样

- 引入 `cpal = "0.16.0"` + `rubato = "0.16.2"`
- 枚举本机麦克风设备，选择默认设备开始录音
- 将采集到的音频实时重采样到 16000 Hz
- 录制 3 秒音频保存为 WAV 文件，人工回放确认可听清语音
- **通过标准**：WAV 文件可正常播放，语音清晰无失真

### 验证项 3：enigo 文本注入

- 引入 `enigo = "0.6.1"`
- 打开记事本/微信/浏览器地址栏等目标应用
- 调用 `Enigo::text("测试文本")` 注入
- **通过标准**：至少在记事本和浏览器地址栏中成功注入中文文本

### 验证项 4：transcribe-rs 离线推理

- 引入 `transcribe-rs = { version = "0.3.8", features = ["onnx"] }`
- 下载 SenseVoice small 模型（ONNX 格式）
- 用验证项 2 录制的 WAV 文件进行推理
- **通过标准**：返回包含中文文字的转写结果

### 执行原则

- 每项验证独立进行，前一项失败不阻塞后续验证
- 验证代码放在 `examples/` 目录或独立 test binary 中，不污染主代码
- 验证通过后记录实际使用的版本号和注意事项，作为后续开发的基线

## 九、API Key 安全方案

### 存储方式

使用 SQLite config 表存储，value 字段使用 Windows DPAPI 加密后再存入。

- **加密**：写入时调用 `CryptProtectData`（通过 `windows-sys` crate）加密 API Key，Base64 编码后存入 config.value
- **解密**：读取时 Base64 解码后调用 `CryptUnprotectData` 还原明文
- **作用域**：DPAPI 绑定当前 Windows 用户，其他用户/进程无法解密
- **需新增 Cargo 依赖**：`windows-sys = { version = "0.59", features = ["Win32_Security_Cryptography"] }`

### 内存安全

- API Key 仅在 LLM/ASR 请求构建时解密，请求完成后立即 zeroize
- 不在日志中打印 API Key（即使是部分掩码）
- 前端传递 Key 时使用 SecureString 或一次性 token，避免在 DevTools 中暴露

### 备选方案

若 DPAPI 集成复杂度过高，可退而使用 `keyring` crate（跨平台密钥链），Windows 下自动使用 Credential Manager。

## 十、错误处理策略

### 分级反馈

| 级别 | 场景 | 反馈方式 |
| :--- | :--- | :--- |
| **静默重试** | 网络瞬时抖动、ASR 超时 < 2s | 自动重试 1 次，用户无感知 |
| **浮球状态提示** | ASR 失败、LLM 限流、注入失败 | 浮球变红/闪烁 + tooltip 显示简短错误信息 |
| **面板 Toast** | 配置错误、模型下载失败、Key 无效 | 面板顶部弹出 Toast，3 秒自动消失 |
| **阻断提示** | 无麦克风、权限不足、DB 损坏 | 面板模态对话框，必须用户确认 |

### 各模块错误处理

| 模块 | 可能的错误 | 处理方式 |
| :--- | :--- | :--- |
| 热键监听 | 钩子安装失败 | 启动时检测，失败则面板显示"热键不可用"并禁用录音按钮 |
| 录音 | 无麦克风设备、设备被占用 | 浮球变 disabled + tooltip "未检测到麦克风" |
| 云端 ASR | 网络不通、Key 无效、配额耗尽、超时 | 静默重试 1 次 → 失败则降级离线引擎 → 离线也不可用则浮球报错 |
| LLM | 连接失败、Token 超限、格式错误 | 跳过整理，直接使用 ASR 原文上屏 + Toast 提示"AI 整理不可用" |
| 文本注入 | 无焦点窗口、enigo 模拟失败 | 回退到剪贴板粘贴（Ctrl+V）→ 仍失败则复制到剪贴板 + Toast 提示 |
| 离线推理 | 模型文件缺失/损坏、内存不足 | Toast 提示"请重新下载模型" |
| 配置 | DB 锁定、读写失败 | 阻断提示 + 建议重启应用 |

## 十一、浮球 ↔ 面板交互协议

### 通信机制

使用 Tauri v2 的 Event System（`app.emit()` / `app.listen()`）进行窗口间通信。

### 事件清单

| 事件名 | 方向 | Payload | 触发时机 |
| :--- | :--- | :--- | :--- |
| `runtime-state-changed` | 后端 → 前端（全部窗口） | `{ state: AppStatus }` | 状态机每次 transition 成功后 |
| `open-panel` | ball → panel | 无 | 点击浮球打开面板 |
| `minimize-panel` | panel → ball | 无 | 面板最小化按钮 |
| `toast` | 后端 → panel | `{ level: "info"\|"warn"\|"error", message: string }` | 需要向用户展示提示信息时 |
| `config-updated` | 后端 → 前端（全部窗口） | `{ key: string, value: string }` | 配置变更时通知所有窗口刷新 |

### 状态同步规则

- 后端 `AppRuntime` 是状态的**唯一权威来源**
- 前端不维护独立的状态副本，仅订阅 `runtime-state-changed` 事件更新 UI
- BallWindow 的 4 种视觉状态映射：idle→Idle, recording→Recording, thinking→Recognizing, disabled→Paused
- Preview 状态时浮球保持 thinking 样式，面板弹出 PreviewPopup

### 面板 ↔ 浮球位置联动

- 面板打开时定位在浮球右侧/下方（避免遮挡）
- 浮球拖拽后面板跟随移动（通过 Tauri window API `set_position`）
- 面板关闭不影响浮球位置

## 十二、证据引用

### Prior Art 来源

- [Handy GitHub API](https://api.github.com/repos/cjpais/Handy)：31,031 stars，MIT，Rust，tauri-v2，pushed_at 2026-09-05
- [Handy Cargo.toml](https://github.com/cjpais/Handy/blob/main/src-tauri/Cargo.toml)：核心依赖版本与 Git fork 声明的一手来源
- [LessAI GitHub API](https://api.github.com/repos/GTJasonMK/lessAI)：496 stars，MIT，Rust，pushed_at 2026-04-28
- [PomeType GitHub API](https://api.github.com/repos/ShiliuX-Team/pometype)：官方资料仓库，无 License，无源码
- [PomeType 官网](https://www.shiliux.com/pometype)：功能描述（说/听/译/改写/口译/离线听写）

### Handy 核心 Crate 来源

- [transcribe-rs](https://github.com/cjpais/transcribe-rs)：多引擎转写库，Handy 使用 v0.3.8 (onnx)
- [cpal](https://github.com/rustaudio/cpal)：跨平台音频 I/O，Handy 使用 v0.16.0
- [vad-rs (cjpais fork)](https://github.com/cjpais/vad-rs)：Silero VAD 语音活动检测，Git 依赖
- [rdev (rustdesk-org fork)](https://github.com/rustdesk-org/rdev)：全局键盘/鼠标监听与模拟，Git 依赖
- [rubato](https://github.com/henquist/rubato)：音频采样率转换，Handy 使用 v0.16.2
- [enigo](https://github.com/enigo-rs/enigo)：跨平台键盘/鼠标模拟，Handy 使用 v0.6.1

### TerminalVoice 代码库内部来源

- 状态机：`src-tauri/src/state.rs`（5 状态、8 事件、7 个测试）
- 文本预处理：`src-tauri/src/services/preprocess.rs`（3 模式、10 默认过滤词、5 个测试）
- 数据库：`src-tauri/src/services/db.rs`（3 表 schema、2 个测试）
- IPC 命令：`src-tauri/src/commands/preview.rs` + `history.rs`（4 个命令）
- Tauri 配置：`src-tauri/tauri.conf.json`（3 窗口定义）
- Capabilities：`src-tauri/capabilities/default.json`（仅 main 窗口 core:default）
- 前端 Store：`src/stores/appStore.ts`（纯前端 PanelState）
- 类型契约：`src/lib/types.ts` + `src/lib/commands.ts`
