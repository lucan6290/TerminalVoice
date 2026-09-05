# CODE_MAP.md — 当前代码状态地图

> **最后更新**：2026-09-06
> 本文档精确描述 TerminalVoice 代码库中**每个文件/模块的当前实现状态**，区分「已实现」「部分实现/Mock」「未实现」。修改代码前必看，避免重复工作或错误假设。

---

## 状态图例

| 标记 | 含义 |
| :--- | :--- |
| ✅ | 已实现，可正常工作 |
| 🟡 | 部分实现 / 前端 Mock，后端未接通 |
| 🚧 | 骨架已搭，核心逻辑缺失 |
| ❌ | 未实现（文件不存在或空壳） |
| 🧹 | 早期遗留代码，待迁移/重构 |

---

## 一、前端 `src/`

### 入口与路由

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [main.tsx](../src/main.tsx) | ✅ | React 18 方式挂载 `<App />`，引入 index.css |
| [App.tsx](../src/App.tsx) | ✅ | 应用根组件。包含：`isTauriRuntime()` 环境检测、`useHashRoute()` hash 路由（#/ball, #/panel, #/main, 其他→DevPreview）、`useBackendSync()` 事件监听（监听全部 14 个 Tauri 事件：runtime-state-changed / config-updated / toast / preview-ready / preview-cleared / recording-started / recording-tick / recording-stopped / recording-cancelled / tts-started / tts-stopped / translate-result / rewrite-started / rewrite-result），集中 `unlisteners` 数组管理清理，初始 `loadAll()` + `getAppStatus()` 同步、body class 自动切换、全局 `ToastContainer` + `ErrorModal` 挂载 |

### 样式

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [index.css](../src/index.css) | ✅ | Tailwind v4 完整设计系统：@theme 定义浅/深色两套 color tokens、字体栈、圆角体系（window 22px/card 14px/control 10px/pill 8px）、阴影（shadow-window/shadow-ball）、4 个动画（pulse-dot/breathing-glow/fade-in/ball-bounce）、CSS-only tooltip（`[data-tip]`）、kbd 样式、`.theme-light` neutral 覆盖、滚动条美化 |

### lib/ — 工具层

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [lib/cn.ts](../src/lib/cn.ts) | ✅ | 极简 className 合并：`classes.filter(Boolean).join(" ")`，无 clsx/tailwind-merge |
| [lib/types.ts](../src/lib/types.ts) | ✅ | TS 类型定义：AppStatus（5 状态）、ConfigEntry、AudioInputDevice、TextMode（3模式）、TextProcessMode、HistoryItem、PreviewMode（`"recognition" \| "rewrite"`）、PreviewDraft（含可选 `mode?: PreviewMode`）、ConfirmPreviewInput（含可选 `mode?: PreviewMode`）、FilterWord、ASRProvider、ServiceConfig、ModelInfo、TranslateResultPayload、RewriteResultPayload、RecordingTickPayload、ToastPayload。与 Rust serde 类型一一对应。已移除旧的 `LocalModel` 接口（由 `ModelInfo` 替代） |
| [lib/commands.ts](../src/lib/commands.ts) | ✅ | 封装 24 个 invoke 命令：`getAppStatus`/`createMockPreview`/`confirmPreview`/`cancelPreview`/`injectText`/`testAsrConnection`/`listHistory`/`deleteHistory`/`clearHistory`/`searchHistory`/`reinjectHistory`/`getConfig`/`setConfig`/`listConfig`/`listAudioInputDevices`/`listFilterWords`/`addFilterWord`/`deleteFilterWord`/`toggleFilterWord`/`listModels`/`downloadModel`/`deleteModel`/`exportData`/`importData`。均为直接 `invoke("snake_case", args)` 的薄封装 |
| [lib/events.ts](../src/lib/events.ts) | ✅ | Tauri 事件名称常量。导出 14 个 `EVENT_*` 常量（runtime-state-changed / config-updated / toast / preview-ready / preview-cleared / recording-started / recording-stopped / recording-cancelled / recording-tick / tts-started / tts-stopped / translate-result / rewrite-started / rewrite-result）+ `TauriEventName` 联合类型。前端监听事件时必须使用此处常量，禁止硬编码字符串 |

### stores/ — 状态管理

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [stores/appStore.ts](../src/stores/appStore.ts) | ✅ | Zustand `usePanelStore` 已实现完整 UI 状态：UI 模式（dark/activeTab/appStatus/previewDraft）、快捷设置（pttKey/micDevice/soundOn/muteSys/autoStart）、服务配置（service）、数据（historyItems/filterWords/models/downloadingModels）、运行时特性状态（rewriteMode/ttsSpeaking/translateResult/rewriteResult/recordingDuration/errorMessage）。**已移除全部 Mock 数据**（MOCK_HISTORY/MOCK_FILTER_WORDS/MOCK_LOCAL_MODELS 已删除），数据通过 `loadAll()`（Promise.allSettled）从后端拉取。所有数据操作为 async + 乐观更新 + IPC 调用 + 失败回滚。`persist()` 调用 setConfig 保存，浏览器模式 catch 静默降级。`hydrateFromConfig()` 从后端拉取配置。CONFIG_KEYS 覆盖 ui.*/input.*/service.* 共 15 个键 |
| [stores/toastStore.ts](../src/stores/toastStore.ts) | ✅ | 轻量 Toast：基于 useSyncExternalStore，支持 info/warn/error/success 四级，3s 自动消失，不依赖 Zustand |
| [stores/appStore.test.ts](../src/stores/appStore.test.ts) | 🧹 | 存在但需检查是否为最新测试 |

### windows/ball/ — 悬浮小球窗口

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [windows/ball/BallWindow.tsx](../src/windows/ball/BallWindow.tsx) | ✅ | 悬浮球完整实现：48x48 圆形毛玻璃按钮（backdrop-filter blur+saturate）、`computeBallState()` 函数根据 appStatus/rewriteMode/ttsSpeaking/errorMessage 计算 7 种球状态（idle/recording/thinking/disabled/error/rewrite/tts）、`STATE_META` 定义颜色/标签/glow/图标（mic/error/loader/wand/volume）、hover 显示 tooltip（含录音计时 `formatDuration()`）、点击展开 panel、引入 `TranslatePopup` 子组件、图标使用 lucide-react（Mic/AlertCircle/Loader2/Wand2/Volume2） |

### windows/panel/ — 面板窗口

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [windows/panel/PanelWindow.tsx](../src/windows/panel/PanelWindow.tsx) | ✅ | 面板主组件：顶部栏（状态点 pulse + 标题 + 4 个 IconBtn（录音/更多/最小化/关闭）+ 深浅主题切换 ☀️/🌙）、HomeView（服务配置行+触发键+麦克风+3个ToggleSwitch+底部提示）、TabContent 分发、底部 4 个 TabBtn（Sparkles/BookText/Clock/HelpCircle）。窗口控制按钮（最小化/关闭）已接通 Tauri Window API（`win.hide()`）。内嵌 `PreviewPopup` 组件（覆盖面板，由 `previewDraft` 驱动）。麦克风设备通过 `listAudioInputDevices` 枚举 |
| [windows/panel/tabs/HistoryTab.tsx](../src/windows/panel/tabs/HistoryTab.tsx) | ✅ | 历史记录页：搜索框通过 `searchHistory(q)` 调用后端 IPC 搜索（浏览器环境本地过滤）、删除/清空/重上屏均为 async store action + showToast 反馈 |
| [windows/panel/tabs/DictTab.tsx](../src/windows/panel/tabs/DictTab.tsx) | ✅ | 过滤词（个人词典）页：两栏布局，增删改查均为 async store action（乐观更新+回滚）+ showToast 反馈，支持行内编辑 |
| [windows/panel/tabs/ServiceTab.tsx](../src/windows/panel/tabs/ServiceTab.tsx) | ✅ | 服务配置页：ASR 提供商选择（auto/cloud/offline）、ASR/LLM 端点/密钥/模型配置、ASR 连接测试按钮（`testAsrConnection()`）、离线模型管理（`ModelInfo` 类型 + `formatSize` 辅助函数 + 下载/删除 + 下载中状态指示） |
| [windows/panel/tabs/SkillTab.tsx](../src/windows/panel/tabs/SkillTab.tsx) | 🟡 | 技能页（英文输出/清单/汇报/听写模板），Mock |
| [windows/panel/tabs/HelpTab.tsx](../src/windows/panel/tabs/HelpTab.tsx) | ✅ | 帮助页：版本 v0.2.0、快捷键说明（含 Alt+1 朗读/Alt+2 翻译行）、使用指南（4 步）、AI 整理模式说明（4 种）、底部链接按钮 |
| [windows/panel/PreviewPopup.tsx](../src/windows/panel/PreviewPopup.tsx) | ✅ | 预览弹窗组件（已从 `components/` 迁移至此并重构）：支持 `recognition` 模式（绿色 accent）和 `rewrite` 模式（紫色 accent），不同模式不同标签（"确认语音输入"/"确认改写结果"、"识别原文"/"改写原文"、"整理结果"/"改写结果"），使用 `cn()` 条件 className，传入 `mode` 到 confirm 调用。由 PanelWindow 内嵌，`previewDraft` 驱动 |
| [windows/panel/PreviewPopup.test.tsx](../src/windows/panel/PreviewPopup.test.tsx) | ✅ | 预览弹窗测试 |
| [windows/panel/PanelWindow.test.tsx](../src/windows/panel/PanelWindow.test.tsx) | ✅ | 面板测试 |

### components/ — 通用组件

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [components/ui/Toast.tsx](../src/components/ui/Toast.tsx) | ✅ | Toast 容器组件，从 toastStore 订阅，右上角固定定位，4 种 level 颜色，fade-in 动画 |
| [components/ui/ToggleSwitch.tsx](../src/components/ui/ToggleSwitch.tsx) | ✅ | 开关组件：52x28 圆角 14px，绿色 accent 色，支持 disabled |
| [components/ui/SettingRow.tsx](../src/components/ui/SettingRow.tsx) | ✅ | 设置行组件：左标签 + 右控件（children），card 背景圆角 14px |
| [components/ui/ErrorModal.tsx](../src/components/ui/ErrorModal.tsx) | ✅ | 阻断式错误模态对话框：从 store 的 `errorMessage` 读取，为 null 时不渲染，5s 自动消失，红色 accent（`ring-red-500/30`），点击遮罩或「知道了」关闭。在 App.tsx 全局挂载 |
| [components/ui/TranslatePopup.tsx](../src/components/ui/TranslatePopup.tsx) | ✅ | 翻译结果浮窗：从 store 的 `translateResult` 读取，浮球旁临时显示译文，8s 自动消失，青色 accent（teal），显示原文+译文。在 BallWindow 中渲染 |
| [components/StatusBadge.tsx](../src/components/StatusBadge.tsx) | 🧹 | 早期 MVP 状态徽章：朴素 1px #ddd 边框 pill 样式，中文标签映射。**未接入新设计系统**，当前面板已用绿色状态点替代 |

### pages/ — 旧版页面

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [pages/History.tsx](../src/pages/History.tsx) | 🧹 | 旧版单窗口历史页，待迁移到 panel tabs/HistoryTab |
| [pages/Settings.tsx](../src/pages/Settings.tsx) | 🧹 | 旧版单窗口设置页，待迁移到 panel tabs/ServiceTab + 主窗口 |

### test/

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [test/setup.ts](../src/test/setup.ts) | ✅ | Vitest setup：import @testing-library/jest-dom |

---

## 二、后端 `src-tauri/src/`

### 入口与注册

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [main.rs](../src-tauri/src/main.rs) | ✅ | 调用 `terminalvoice_lib::run()` |
| [lib.rs](../src-tauri/src/lib.rs) | ✅🟡 | Tauri Builder setup：创建 data_dir → 打开 SQLite → manage(Mutex\<Database\>) + manage(Mutex\<AppRuntime\>) → start_hotkey_pipeline → 注册 18 个 invoke_handler（preview 7个 + history 5个 + config 3个 + dictionary 4个 + audio 1个）。**缺失**：插件注册（global-shortcut/clipboard/dialog/shell/autostart 均未注册）、托盘创建、窗口事件处理 |

### 状态机

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [state.rs](../src-tauri/src/state.rs) | ✅ | 5 状态 RuntimeState（Idle/Recording/Recognizing/Preview/Paused）+ 8 事件 RuntimeEvent（HotkeyPressed/HotkeyReleasedWithValidAudio/HotkeyReleasedTooShort/RecognitionSucceeded/RecognitionFailed/ConfirmedPreview/Cancelled/TogglePause）+ InvalidTransition 错误 + AppRuntime（state + paused_from 记忆）+ transition() 完整 match + 7 个单元测试覆盖正常流程/短录音/暂停切换/无效转移/暂停恢复各种场景 |

### commands/ — IPC 命令

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [commands/mod.rs](../src-tauri/src/commands/mod.rs) | ✅ | 声明 config/history/preview 三个子模块 |
| [commands/config.rs](../src-tauri/src/commands/config.rs) | ✅ | ConfigUpdatedPayload（camelCase）+ `get_config(key)`/`set_config(key,value)`（写入DB后 emit "config-updated"）/`list_config()` |
| [commands/history.rs](../src-tauri/src/commands/history.rs) | ✅ | `list_history()` → db.list_history() 按时间 DESC |
| [commands/preview.rs](../src-tauri/src/commands/preview.rs) | ✅🟡 | AppStatus 枚举（与 RuntimeState 对应）+ RuntimeStateChangedPayload + emit_runtime_state() 发送 "runtime-state-changed" + TextMode 枚举（含 as_storage_value/to_backend_mode）+ PreviewDraft/ConfirmPreviewInput（camelCase）+ `get_app_status()` + `create_mock_preview(raw_text)`（**模拟完整流程**：验证Idle→Recording→Recognizing→preprocess→Preview，emit 状态事件，asr_provider="mock"）+ `confirm_preview(input)`（→Idle，写DB，返回 HistoryItem）。**注意**：create_mock_preview 是 mock，真实 ASR 未接入 |

### services/ — 业务服务

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [services/mod.rs](../src-tauri/src/services/mod.rs) | ✅ | 声明 db/preprocess 两个子模块 |
| [services/db.rs](../src-tauri/src/services/db.rs) | ✅ | SQLite 完整实现：Database(Connection) + open()/in_memory() + initialize()（WAL模式、foreign_keys、3张表：config(key PK, value)/history(id PK AUTOINCREMENT, created_at, source_text, final_text, text_mode, asr_provider)/filter_words(id PK AUTOINCREMENT, word UNIQUE, is_default, created_at)）+ seed_default_filter_words()（INSERT OR IGNORE）+ CRUD（get_config/set_config UPSERT/list_config/insert_history/list_history ORDER BY created_at DESC, id DESC/get_history_by_id/count_default_filter_words）+ NewHistoryItem/HistoryItem/ConfigEntry 结构体 + HistoryItem::new_for_test() 测试辅助 + 3 单元测试（schema+默认过滤词数量/插入排序/config CRUD） |
| [services/preprocess.rs](../src-tauri/src/services/preprocess.rs) | ✅ | 文本预处理：TextMode（Normal/Developer/Raw）+ PreprocessConfig（mode/add_punctuation/filter_words/single_line/custom_filter_words）+ Default 实现（Normal+全开）+ DEFAULT_FILTER_WORDS（10个：嗯啊呃哦那个这个就是然后反正就是说）+ process_text()（Raw直返/Normal先过滤词→单行→末尾补句号/Developer仅单行规整）+ process_normal_text() 便捷函数 + 5 单元测试 |

### 配置

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [tauri.conf.json](../src-tauri/tauri.conf.json) | ✅🟡 | 3 窗口配置（main/ball/panel），ball 和 panel 为透明无边框置顶，build 配置 devUrl=http://localhost:1420 / frontendDist=../dist，CSP=null。**缺失**：plugins 配置、bundle 详细配置、trayIcon |
| [capabilities/default.json](../src-tauri/capabilities/default.json) | 🟡 | 仅授权 core:default + core:window:allow-show + core:window:allow-set-focus。**缺失**：global-shortcut/clipboard-manager/dialog/shell/autostart 等插件权限 |
| [Cargo.toml](../src-tauri/Cargo.toml) | 🟡 | 已声明依赖：tauri 2/serde/chrono/rusqlite/cpal 0.16/rubato 0.16/enigo 0.6/rdev（rustdesk fork）/arboard 3。**问题**：cpal 版本为 0.16 与 [v0.1/ARCHITECTURE.md](v0.1/ARCHITECTURE.md) 中规划的 0.18 不一致；**缺失**：reqwest/tokio/tracing/windows-sys/hound/tauri-plugin-* 等依赖 |

---

## 三、待新建的后端模块（按 [v0.1/](v0.1/) V1.1 + [v0.2/](v0.2/) 浮球方案规划）

以下模块在规划文档中已设计，但**代码尚未创建**：

| 模块文件 | 功能 | 优先级 |
| :--- | :--- | :---: |
| `services/hotkey.rs` | 全局热键（tauri-plugin-global-shortcut 封装，Right Alt/Alt+1/Alt+2） | P0 |
| `services/audio/recorder.rs` | cpal 录音（16KHz/16bit/mono） | P0 |
| `services/asr/cloud.rs` | 云端 ASR HTTP 客户端（OpenAI Whisper API 兼容） | P0 |
| `services/inject/clipboard.rs` | arboard 剪贴板操作（备份+注入+恢复） | P0 |
| `services/inject/keyboard.rs` | enigo SendInput 文本注入 | P0 |
| `commands/audio.rs` | 录音开始/停止/取消 IPC | P0 |
| `commands/inject.rs` | 文本注入 IPC | P0 |
| `tray.rs` | 系统托盘（双图标+菜单+Explorer恢复） | P1 |
| `services/crypto.rs` | Windows DPAPI 加密 API Key | P1 |
| `services/logger.rs` | tracing 日志（按天滚动+脱敏） | P1 |
| `services/llm/client.rs` | OpenAI 兼容 LLM HTTP 客户端（AI 整理） | P2 |
| `services/tts/edge.rs` | edge-tts 在线 TTS | P2 |
| `services/translate/` | 多引擎翻译（借鉴 Pot 插件架构，自研） | P3 |
| `services/asr/local.rs` | 本地 Whisper/SenseVoice 离线识别 | P3 |
| `windows.rs` | 三窗口管理（创建/显示/隐藏/定位） | P1 |

---

## 四、待新建的前端模块

| 模块 | 功能 | 优先级 |
| :--- | :--- | :---: |
| `hooks/useTauriEvent.ts` | Tauri 事件监听 hook（泛型封装 listen） | P0 |
| `windows/panel/views/` | 面板状态视图（DictationView/ReadingView/TranslateView 等） | P1 |
| `windows/settings/SettingsWindow.tsx` | 主设置窗口（Key 配置、模型下载等） | P2 |

> **注意**：`lib/events.ts` 已实现（事件名常量 + `TauriEventName` 联合类型），见 lib/ 章节。

---

## 五、注意事项

1. **PreviewPopup 已迁移**：从 `components/PreviewPopup.tsx` 迁移到 `windows/panel/PreviewPopup.tsx`，已重写为使用设计系统（Tailwind + `cn()`），支持 recognition/rewrite 双模式。`components/` 下的旧版已删除。
2. **StatusBadge 是遗留组件**：使用朴素 inline style 而非 Tailwind 设计系统。面板的状态显示已用绿色圆点替代。
3. **pages/History.tsx 和 pages/Settings.tsx 是旧版**：对应早期单窗口 MVP，正在迁移到 panel/tabs/ 和未来的 settings/ 窗口。
4. **前端 Mock 数据已全部移除**：appStore 不再包含 MOCK_HISTORY/MOCK_FILTER_WORDS/MOCK_LOCAL_MODELS，所有数据通过 IPC 从后端拉取。浏览器环境下 invoke 调用 catch 静默降级，列表为空。
5. **Cargo.toml 版本偏差**：当前 cpal 为 0.16，但架构文档规划为 0.18；enigo 为 0.6.1（与规划一致）；缺少 reqwest/tokio/tracing/hound 等依赖。补齐依赖时注意版本统一。
6. **capabilities 权限不足**：目前仅 window show/focus 权限，接入任何 Tauri 插件前必须先在 capabilities/default.json 中授权对应权限。
7. **设计系统以 index.css 的 @theme 为准**：颜色 token 使用 CSS 变量（`var(--bg-primary)` 等），Tailwind v4 通过 @theme 注册后可直接用 `bg-bg-primary` 等 utility 类。
8. **SkillTab 仍为 Mock**：技能页（英文输出/清单/汇报/听写模板）仍使用 Mock 数据，待接通后端。
