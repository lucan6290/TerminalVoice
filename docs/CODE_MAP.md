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
| [App.tsx](../src/App.tsx) | ✅ | 应用根组件。包含：`isTauriRuntime()` 环境检测、`useHashRoute()` hash 路由（#/ball, #/panel, #/main, 其他→DevPreview）、`useBackendSync()` 事件监听（监听全部 15 个 Tauri 事件：runtime-state-changed / config-updated / toast / preview-ready / preview-cleared / recording-started / recording-tick / recording-stopped / recording-cancelled / tts-started / tts-stopped / translate-result / rewrite-started / rewrite-result / llm-streaming-delta），集中 `unlisteners` 数组管理清理，初始 `loadAll()` + `getAppStatus()` 同步、body class 自动切换、全局 `ToastContainer` + `ErrorModal` 挂载。新增 `MainWindow` 组件（#/main，设置页：开机自启/深色模式/服务状态/关于） |

### 样式

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [index.css](../src/index.css) | ✅ | Tailwind v4 完整设计系统：@theme 定义浅/深色两套 color tokens、字体栈、圆角体系（window 22px/card 14px/control 10px/pill 8px）、阴影（shadow-window/shadow-ball）、4 个动画（pulse-dot/breathing-glow/fade-in/ball-bounce）、CSS-only tooltip（`[data-tip]`）、kbd 样式、`.theme-light` neutral 覆盖、滚动条美化 |

### lib/ — 工具层

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [lib/cn.ts](../src/lib/cn.ts) | ✅ | 极简 className 合并：`classes.filter(Boolean).join(" ")`，无 clsx/tailwind-merge |
| [lib/types.ts](../src/lib/types.ts) | ✅ | TS 类型定义：AppStatus（5 状态）、ConfigEntry、AudioInputDevice、TextMode（3模式）、TextProcessMode、HistoryItem（含 `durationMs`/`audioFilePath`/`llmRewritten`/`skillId`/`appContext` 可选字段）、PreviewMode（`"recognition" \| "rewrite"`）、PreviewDraft（`mode` 必填 + `durationMs`/`llmRewritten`/`skillId` 可选）、ConfirmPreviewInput（`mode` 必填 + 同上可选字段）、FilterWord、ASRProvider、ServiceConfig（含 `asrFullUrl`/`llmFullUrl`/`translateTargetLang`/`skipPreview`）、ModelInfo、TranslateResultPayload、RewriteResultPayload、RecordingTickPayload、ToastPayload、VoiceSkill、LlmStreamingDeltaPayload、UpdateInfo、UpdateProgressPayload、HotkeyConfig（含 `DEFAULT_HOTKEY_CONFIG` 常量）。与 Rust serde 类型一一对应。已移除旧的 `LocalModel` 接口（由 `ModelInfo` 替代） |
| [lib/commands.ts](../src/lib/commands.ts) | ✅ | 封装 32 个 invoke 命令：`getAppStatus`/`createMockPreview`/`confirmPreview`/`cancelPreview`/`injectText`/`testAsrConnection`/`testLlmConnection`/`fetchAsrModels`/`fetchLlmModels`/`listHistory`/`deleteHistory`/`clearHistory`/`searchHistory`/`reinjectHistory`/`getConfig`/`setConfig`/`listConfig`/`listAudioInputDevices`/`listFilterWords`/`addFilterWord`/`deleteFilterWord`/`toggleFilterWord`/`listModels`/`downloadModel`/`deleteModel`/`exportData`/`importData`/`listSkills`/`setSkill`/`getActiveSkill`/`setHotkeyConfig`/`getAppVersion`。均为直接 `invoke("snake_case", args)` 的薄封装，命令名集中在顶部 `COMMANDS` 常量对象 |
| [lib/events.ts](../src/lib/events.ts) | ✅ | Tauri 事件名称常量。导出 17 个 `EVENT_*` 常量（runtime-state-changed / config-updated / toast / preview-ready / preview-cleared / recording-started / recording-stopped / recording-cancelled / recording-tick / tts-started / tts-stopped / translate-result / rewrite-started / rewrite-result / llm-streaming-delta / tray-navigate / tray-check-update）+ `TauriEventName` 联合类型。前端监听事件时必须使用此处常量，禁止硬编码字符串 |
| [lib/i18n.ts](../src/lib/i18n.ts) | ✅ | 中英双语模块：`zh`/`en` 两个字典（约 290 条 key，覆盖全部 UI 文案）+ `t(key, params?)` 插值翻译 + `useT()` React hook（基于 useSyncExternalStore 订阅语言变化）+ `getLang`/`setLang`/`toggleLang`/`syncLangFromBackend`。语言持久化到 `localStorage` 并同步后端 `ui.lang` 配置。UI 文案一律走 `t()`，禁止硬编码中文 |
| [lib/utils.ts](../src/lib/utils.ts) | ✅ | `isTauriRuntime()`：检测 `window.__TAURI_INTERNALS__` 判断是否在 Tauri 运行时（从 App.tsx 抽出复用） |

### stores/ — 状态管理

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [stores/appStore.ts](../src/stores/appStore.ts) | ✅ | Zustand `usePanelStore` 已实现完整 UI 状态：UI 模式（dark/activeTab/appStatus/previewDraft/uiLang）、快捷设置（pttKey/micDevice/soundOn/muteSys/autoStart）、服务配置（service，含 translateTargetLang/skipPreview）、数据（historyItems/filterWords/models/downloadingModels/skills/activeSkillId）、运行时特性状态（rewriteMode/ttsSpeaking/translateResult/rewriteResult/recordingDuration/errorMessage/llmStreamingText）。**已移除全部 Mock 数据**（MOCK_HISTORY/MOCK_FILTER_WORDS/MOCK_LOCAL_MODELS 已删除），数据通过 `loadAll()`（Promise.allSettled）从后端拉取。所有数据操作为 async + 乐观更新 + IPC 调用 + 失败回滚。`persist()` 调用 setConfig 保存，浏览器模式 catch 静默降级。`hydrateFromConfig()` 从后端拉取配置。CONFIG_KEYS 覆盖 ui.*/input.*/service.* 共 18 个键（含 `ui.lang`、`input.skipPreview`、`service.translateTargetLang`、`service.activeSkill`） |
| [stores/toastStore.ts](../src/stores/toastStore.ts) | ✅ | 轻量 Toast：基于 useSyncExternalStore，支持 info/warn/error/success 四级，3s 自动消失，不依赖 Zustand |
| [stores/appStore.test.ts](../src/stores/appStore.test.ts) | 🧹 | 存在但需检查是否为最新测试 |

### windows/ball/ — 悬浮小球窗口

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [windows/ball/BallWindow.tsx](../src/windows/ball/BallWindow.tsx) | ✅ | 悬浮球完整实现：48x48 圆形毛玻璃按钮（backdrop-filter blur+saturate）、`computeBallState()` 函数根据 appStatus/rewriteMode/ttsSpeaking/errorMessage 计算 7 种球状态（idle/recording/thinking/disabled/error/rewrite/tts）、`STATE_META` 定义颜色/标签/glow/图标（mic/error/loader/wand/volume）、hover 显示 tooltip（含录音计时 `formatDuration()`）、点击展开 panel、引入 `TranslatePopup` 子组件、图标使用 lucide-react（Mic/AlertCircle/Loader2/Wand2/Volume2） |

### windows/panel/ — 面板窗口

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [windows/panel/PanelWindow.tsx](../src/windows/panel/PanelWindow.tsx) | ✅ | 面板主组件：顶部栏（状态点 pulse + 标题 + 4 个 IconBtn（录音/更多/最小化/关闭）+ 深浅主题切换 ☀️/🌙）、HomeView（服务配置行+触发键+麦克风+3个ToggleSwitch+底部提示）、TabContent 分发、底部 4 个 TabBtn（Sparkles/BookText/Clock/HelpCircle）。`StateView` 组件集成在 HomeView 上方，实时显示录音/识别/TTS/LLM 流式/翻译状态。`displayDraft` 优先使用 `llmStreamingText` 展示 LLM 流式文本。窗口控制按钮（最小化/关闭）已接通 Tauri Window API（`win.hide()`）。内嵌 `PreviewPopup` 组件（覆盖面板，由 `previewDraft` 驱动）。麦克风设备通过 `listAudioInputDevices` 枚举 |
| [windows/panel/StateView.tsx](../src/windows/panel/StateView.tsx) | ✅ | 紧凑状态视图组件：在面板主页内容区上方显示实时状态卡片。优先级：Recording > Recognizing > TTS speaking > LLM streaming > Translate > Idle(null)。录音态显示计时，LLM 流式态显示实时文本（line-clamp-3），翻译态显示译文摘要。使用 lucide-react 图标（Mic/LoaderCircle/Volume2/Sparkles/Languages/Square） |
| [windows/panel/tabs/HistoryTab.tsx](../src/windows/panel/tabs/HistoryTab.tsx) | ✅ | 历史记录页：搜索框通过 `searchHistory(q)` 调用后端 IPC 搜索（浏览器环境本地过滤）、删除/清空/重上屏均为 async store action + showToast 反馈 |
| [windows/panel/tabs/DictTab.tsx](../src/windows/panel/tabs/DictTab.tsx) | ✅ | 过滤词（个人词典）页：两栏布局，增删改查均为 async store action（乐观更新+回滚）+ showToast 反馈，支持行内编辑 |
| [windows/panel/tabs/ServiceTab.tsx](../src/windows/panel/tabs/ServiceTab.tsx) | ✅ | 服务配置页：ASR 提供商选择（auto/cloud/offline）、ASR/LLM 端点/密钥/模型配置、ASR 连接测试按钮（`testAsrConnection()`）、离线模型管理（`ModelInfo` 类型 + `formatSize` 辅助函数 + 下载/删除 + 下载中状态指示）、翻译目标语言选择器 |
| [windows/panel/tabs/SkillTab.tsx](../src/windows/panel/tabs/SkillTab.tsx) | ✅ | 技能页：4 个语音技能卡片（英文输出/清单模式/汇报格式/听写模板），通过 `listSkills`/`setSkill`/`getActiveSkill` IPC 调用后端，卡片点击激活/取消技能 |
| [windows/panel/tabs/HelpTab.tsx](../src/windows/panel/tabs/HelpTab.tsx) | ✅ | 帮助页：版本 v0.2.0、快捷键说明（含 Alt+1 朗读/Alt+2 翻译行）、使用指南（4 步）、AI 整理模式说明（4 种）、底部链接按钮 |
| [windows/panel/tabs/SettingsTab.tsx](../src/windows/panel/tabs/SettingsTab.tsx) | ✅ | 设置页：偏好设置 / 数据管理（备份/恢复）/ 关于与更新（检查更新/退出）三区块，通过 `exportData`/`importData`/`checkUpdate`/退出 等 store action 驱动 |
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
| [components/ui/HotkeyRecorder.tsx](../src/components/ui/HotkeyRecorder.tsx) | ✅ | 按键录入按钮：点击后进入捕获状态，监听下一次 keydown 并通过 `eventToKeyName()` 将 KeyboardEvent.code 转成后端键名字符串；Esc 取消；导出 `formatKeyLabel()` 做展示格式化（Left/Right 修饰键友好名） |
| [components/ui/UpdateModal.tsx](../src/components/ui/UpdateModal.tsx) | ✅ | 应用更新弹窗：展示新版本号、下载进度、下载/立即重启按钮，从 store 的 `updateInfo`/`updateProgress` 读取，用于 `tauri-plugin-updater` 自动更新流程 |
| [components/StatusBadge.tsx](../src/components/StatusBadge.tsx) | 🧹 | 已删除。面板状态显示使用 `StateView.tsx` 替代 |

### pages/ — 已清理

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| `pages/History.tsx` | 🧹 | 已删除。功能迁移到 `windows/panel/tabs/HistoryTab.tsx` |
| `pages/Settings.tsx` | 🧹 | 已删除。功能迁移到 `windows/panel/tabs/ServiceTab.tsx` + 主窗口 `MainWindow` |

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
| [lib.rs](../src-tauri/src/lib.rs) | ✅ | Tauri Builder setup：注册 `tauri-plugin-single-instance`（第二实例唤起面板窗口）+ `tauri-plugin-autostart` + `tauri-plugin-updater` + `tauri-plugin-shell` + `tauri-plugin-process` → setup 中初始化日志系统（`logging::init_logging()`，写入 `app_data_dir/logs/terminalvoice.log`）→ 隐藏 ball/panel 任务栏图标 → 隐藏 main/panel 初始窗口 → 创建 data_dir → 打开 SQLite → 还原悬浮球显隐并定位右上角 → manage(Mutex\<Database\>) + manage(Mutex\<AppRuntime\>) + manage(PipelineHandle) → start_hotkey_pipeline → setup_tray → 注册 32 个 invoke_handler（preview 9个 + history 5个 + config 3个 + dictionary 4个 + audio 1个 + backup 2个 + model 3个 + skills 3个 + hotkey 1个 + updater 1个）。**已注册**：autostart/single-instance/updater/shell/process 插件、系统托盘 |

### 状态机

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [state.rs](../src-tauri/src/state.rs) | ✅ | 5 状态 RuntimeState（Idle/Recording/Recognizing/Preview/Paused）+ 9 事件 RuntimeEvent（HotkeyPressed/HotkeyReleasedWithValidAudio/HotkeyReleasedTooShort/RecognitionSucceeded/RecognitionFailed/DirectInjectSucceeded/ConfirmedPreview/Cancelled/TogglePause）+ InvalidTransition 错误 + AppRuntime（state + paused_from 记忆 + rewrite_mode 标志）+ transition() 完整 match + 8 个单元测试覆盖正常流程/短录音/暂停切换/无效转移/暂停恢复/rewrite_mode 标志各种场景 |

### commands/ — IPC 命令

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [commands/mod.rs](../src-tauri/src/commands/mod.rs) | ✅ | 声明 audio/backup/config/dictionary/history/hotkey/model/preview/skills/updater 十个子模块 |
| [commands/config.rs](../src-tauri/src/commands/config.rs) | ✅ | ConfigUpdatedPayload（camelCase）+ `get_config(key)`/`set_config(key,value)`（写入DB后 emit "config-updated"）/`list_config()` |
| [commands/history.rs](../src-tauri/src/commands/history.rs) | ✅ | `list_history()` → db.list_history() 按时间 DESC |
| [commands/hotkey.rs](../src-tauri/src/commands/hotkey.rs) | ✅ | `set_hotkey_config(payload: HotkeyConfigPayload)`：校验三个键名合法后写入 DB（`input.pttKey/ttsKey/translateKey`），并通过 PipelineHandle 发送 `ReloadHotkeys` 触发热键管线热重载 |
| [commands/preview.rs](../src-tauri/src/commands/preview.rs) | ✅ | AppStatus 枚举（与 RuntimeState 对应）+ RuntimeStateChangedPayload + emit_runtime_state() 发送 "runtime-state-changed" + TextMode 枚举（含 as_storage_value/to_backend_mode）+ PreviewDraft/ConfirmPreviewInput（camelCase，含 durationMs/llmRewritten/skillId）+ `get_app_status()` + `create_mock_preview(raw_text)`（**模拟完整流程**：验证Idle→Recording→Recognizing→preprocess→Preview，emit 状态事件，asr_provider="mock"）+ `confirm_preview(input)`（先 hide panel 再注入，→Idle，写DB，返回 HistoryItem）+ `cancel_preview()` + `inject_text(text)` + `inject_text_and_save_history()`（confirm/direct-inject 共享：注入+写历史+toast）+ `test_asr_connection()` + `test_llm_connection()`（最小 ping 请求验证 endpoint/key/model）+ `fetch_asr_models()` / `fetch_llm_models()`（拉取模型列表）。**注意**：create_mock_preview 是 mock，真实 ASR 未接入；`input.skipPreview=true` 时识别完成走 `DirectInjectSucceeded` 直接上屏（直注失败自动回退预览） |
| [commands/updater.rs](../src-tauri/src/commands/updater.rs) | ✅ | `get_app_version()` 返回当前应用版本号（供「关于/检查更新」使用） |
| [commands/skills.rs](../src-tauri/src/commands/skills.rs) | ✅ | 技能相关 IPC 命令：`list_skills()` 返回所有预设 VoiceSkill 列表 / `set_skill(skill_id)` 传入 skill_id 存入 `service.activeSkill` 配置，空字符串清除 / `get_active_skill()` 读取 `service.activeSkill` 返回 Option\<String\> |

### services/ — 业务服务

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [services/mod.rs](../src-tauri/src/services/mod.rs) | ✅ | 声明 24 个子模块：app_context/asr/asr_cloud/asr_offline/audio/backup/clipboard/db/events/hotkey/injector/llm/logging/model_manager/paths/pipeline/preprocess/recorder/rewrite/secrets/skills/translate/tts/vad |
| [services/app_context.rs](../src-tauri/src/services/app_context.rs) | ✅ | 应用上下文识别：根据焦点窗口进程名识别当前应用（用于历史记录 `appContext` 字段） |
| [services/db.rs](../src-tauri/src/services/db.rs) | ✅ | SQLite 完整实现：Database(Connection) + open()/in_memory() + initialize()（WAL模式、foreign_keys、3张表：config(key PK, value)/history(id PK AUTOINCREMENT, created_at, source_text, final_text, text_mode, asr_provider)/filter_words(id PK AUTOINCREMENT, word UNIQUE, is_default, created_at)）+ seed_default_filter_words()（INSERT OR IGNORE）+ CRUD（get_config/set_config UPSERT/list_config/insert_history/list_history ORDER BY created_at DESC, id DESC/get_history_by_id/count_default_filter_words）+ NewHistoryItem/HistoryItem/ConfigEntry 结构体 + HistoryItem::new_for_test() 测试辅助 + 3 单元测试（schema+默认过滤词数量/插入排序/config CRUD） |
| [services/preprocess.rs](../src-tauri/src/services/preprocess.rs) | ✅ | 文本预处理：TextMode（Normal/Developer/Raw）+ PreprocessConfig（mode/add_punctuation/filter_words/single_line/custom_filter_words）+ Default 实现（Normal+全开）+ DEFAULT_FILTER_WORDS（10个：嗯啊呃哦那个这个就是然后反正就是说）+ process_text()（Raw直返/Normal先过滤词→单行→末尾补句号/Developer仅单行规整）+ process_normal_text() 便捷函数 + 5 单元测试 |
| [services/logging.rs](../src-tauri/src/services/logging.rs) | ✅ | 日志系统：tracing + tracing-subscriber，`init_logging()` 在 setup 中调用，日志写入 `app_data_dir/logs/terminalvoice.log`（append 模式），级别通过 `RUST_LOG` 环境变量控制（默认 info），`get_log_path()` 返回日志路径。带时间戳（`%Y-%m-%d %H:%M:%S%.3f`）和 target 模块名 |
| [services/skills.rs](../src-tauri/src/services/skills.rs) | ✅ | 语音技能模块：VoiceSkill 结构体（id/name/description/prompt，camelCase）+ `list_skills()` 返回 4 个预设技能（english=英文输出/list=清单模式/report=汇报格式/dictation=听写模板），每个技能有专用 system prompt + `find_skill(id)` 按 ID 查找 + 4 个单元测试 |
| [services/events.rs](../src-tauri/src/services/events.rs) | ✅ | 事件发射层：定义录音/改写/TTS/翻译/LLM 流式事件常量 + emit 函数。包含 `emit_runtime_state()`/`transition_runtime()`（状态转移+emit）/`emit_toast()`/`emit_recording_started/stopped/cancelled/tick()`/`emit_rewrite_started/result()`/`emit_tts_started/stopped()`/`emit_translate_result()`/`emit_llm_streaming_delta(delta, accumulated)`。全项目共 17 个事件（config-updated/preview-ready/preview-cleared/tray-navigate/tray-check-update 在对应 command/tray 模块直接 emit），与前端 events.ts 对应 |
| [services/llm.rs](../src-tauri/src/services/llm.rs) | ✅ | LLM 客户端：LlmClient + LlmConfig（endpoint/api_key/model）+ TextProcessMode（Off/Proofread/Polish/Structure）+ `organize()`（非流式整理）/`organize_streaming()`（流式整理，SSE delta 回调）/`process_with_prompt_streaming()`（自定义 system prompt 流式，用于技能）/`translate()`（翻译）/`rewrite()`（改写）+ 内部 `stream_request()` 处理 SSE 响应 + SseAccumulator 解析器（处理 UTF-8 跨 chunk）+ 5 个单元测试 |
| [services/pipeline.rs](../src-tauri/src/services/pipeline.rs) | ✅ | 核心语音管线：`start_hotkey_pipeline()` 启动热键监听线程 → `run_pipeline()` 事件循环处理 7 种 HotkeyEvent（Pressed/Released/Cancelled/RewritePressed/RewriteReleased/TtsToggle/Translate）。`apply_llm()` 检查 `service.activeSkill`：有技能则用 `process_with_prompt_streaming` + 技能 prompt，否则用 `organize_streaming`，均通过 `emit_llm_streaming_delta` 推送流式文本。`handle_translate()` 支持口译模式（无选中文本→录音→ASR→翻译→TTS），包含 `stop_interpretation()` 和 `translate_selected_text()`。`handle_rewrite_pressed/released()` 处理改写流程。使用 tracing 日志 |
| [services/model_manager.rs](../src-tauri/src/services/model_manager.rs) | ✅ | 离线模型管理：ModelInfo 结构体 + `predefined_models()` 返回 2 个模型（whisper-tiny/whisper-base），使用真实 HuggingFace URL（`huggingface.co/ggerganov/whisper.cpp`）+ `list_models()`（标记 installed 状态）/`download_model()`（WinHTTP 下载 + SHA256 校验）/`delete_model()`/`verify_model()`（SHA256 哈希比对）/`get_model_path()`/`get_installed_model_path()` + 4 个单元测试 |

### 配置

| 文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| [tauri.conf.json](../src-tauri/tauri.conf.json) | ✅ | 3 窗口配置（main/ball/panel），ball 和 panel 为透明无边框置顶，build 配置 devUrl=http://localhost:1420 / frontendDist=../dist，CSP=null。`trayIcon` 配置（icon.ico）+ `bundle` 完整配置（NSIS/WiX 安装器、中英文支持、版权信息、Utility 分类） |
| [capabilities/default.json](../src-tauri/capabilities/default.json) | ✅ | 授权 core:default + core:window:allow-show/hide/set-focus/set-position/close/start-dragging + autostart:default。已覆盖 autostart 插件权限 |
| [Cargo.toml](../src-tauri/Cargo.toml) | ✅ | 已声明依赖：tauri 2（tray-icon feature）/serde/chrono/rusqlite（bundled）/cpal 0.16/rubato 0.16/enigo 0.6/rdev（rustdesk fork）/arboard 3.6/hound/serde_json/base64/zeroize/windows-sys 0.59/zip/tracing/tracing-subscriber（env-filter+fmt+chrono）/tauri-plugin-autostart/tauri-plugin-single-instance/sha2。dev-dependencies: tempfile |

---

## 三、后端模块实现状态总览

> 所有规划模块均已创建。以下为各模块的实现程度速查。

| 模块文件 | 状态 | 说明 |
| :--- | :---: | :--- |
| `services/hotkey.rs` | ✅ | 全局热键监听（rdev）：支持可配置 HotkeyConfig（ptt/tts/translate 三键），默认 RightAlt/1/2；`HotkeyEdgeState` 状态机 + 边缘检测（长按 PTT 录音、Shift+PTT 改写、Alt+tts/translate 触发）+ `parse_hotkey()/format_hotkey()` 键名 ↔ rdev::Key 互转 + 4 测试。热键通过 `Arc<RwLock<HotkeyConfig>>` 在运行时热更新，无需重启监听线程 |
| `services/recorder.rs` | ✅ | cpal 录音：16KHz/16bit/mono，支持所有 SampleFormat（i8~f64），`Recorder` + `AudioBuffer` + `resample_to_16k()` + `list_input_devices()` + 3 测试 |
| `services/asr.rs` | ✅ | ASR trait 抽象层：`AsrProvider` trait + `AsrMode`（Auto/Cloud/Offline）+ `create_provider()` 工厂 |
| `services/asr_cloud.rs` | ✅ | 云端 ASR：WinHTTP multipart 请求（OpenAI Whisper API 兼容），重试逻辑，endpoint 解析 + 5 测试 |
| `services/asr_offline.rs` | 🟡 | 离线 ASR 引擎骨架：`OfflineAsrEngine` 结构 + 模型加载验证，但 `transcribe()` 未接入实际推理引擎（返回错误） |
| `services/audio.rs` | ✅ | 音频处理：`encode_wav()`（f32→16bit PCM WAV）+ `resample_to_16k()`（rubato）+ `float_to_i16()` |
| `services/injector.rs` | ✅ | 文本注入：enigo `text()` 首选，失败回退 arboard 剪贴板 + Ctrl+V + 1 测试 |
| `services/clipboard.rs` | ✅ | 剪贴板操作：`backup_clipboard()` / `restore_clipboard()`（延迟 500ms 恢复） |
| `services/rewrite.rs` | ✅ | 选中文本捕获：`capture_selected_text()` 模拟 Ctrl+C 读取剪贴板 + 恢复 |
| `services/tts.rs` | ✅ | Windows SAPI COM TTS：`speak()` / `stop_speaking()` / `is_speaking()`，异步朗读 + 取消 |
| `services/translate.rs` | ✅ | 文本翻译：基于 LLM 的翻译，`translate(text, target_lang, config)` |
| `services/secrets.rs` | ✅ | DPAPI 加密：`protect_secret()` / `unprotect_secret()` / `encode_config_value()` / `decode_config_value()`，自动加密 API Key |
| `services/vad.rs` | ✅ | 能量 VAD：RMS 静音检测，`VadState`（Speaking/Silence/SilenceTimeout）+ `VadConfig` |
| `services/llm.rs` | ✅ | LLM 客户端：SSE 流式 + 非流式 + 自定义 prompt + 翻译 + 改写 + SseAccumulator + 5 测试 |
| `services/pipeline.rs` | ✅ | 核心管线：持有 `Arc<RwLock<HotkeyConfig>>`，启动时从 DB 加载热键配置；监听线程每次按键前读取最新 config 实现热重载；`PipelineControl::ReloadHotkeys` 指令重新读 DB 并 toast 通知。热键事件循环 + 录音→ASR→LLM 流式→预览 + 口译模式 + 改写 + TTS |
| `services/model_manager.rs` | ✅ | 模型管理：HuggingFace URL + SHA256 校验 + 下载/删除/列表 + 4 测试 |
| `services/logging.rs` | ✅ | tracing 日志：文件输出到 `app_data_dir/logs/terminalvoice.log` |
| `services/skills.rs` | ✅ | 语音技能：4 预设技能 + `find_skill()` + 4 测试 |
| `services/events.rs` | ✅ | 事件层：15 个事件常量 + emit 函数 |
| `services/db.rs` | ✅ | SQLite：3 表 + WAL + CRUD + 3 测试 |
| `services/preprocess.rs` | ✅ | 文本预处理：3 模式 + 过滤词 + 标点 + 5 测试 |
| `tray.rs` | ✅ | 系统托盘：`setup_tray()` + 菜单（打开面板/退出）|

---

## 四、前端模块实现状态总览

> 所有规划组件均已创建，无待新建模块。

| 模块 | 状态 | 说明 |
| :--- | :---: | :--- |
| `windows/panel/StateView.tsx` | ✅ | 面板状态卡片（录音/识别/TTS/LLM流式/翻译），替代原规划的 `views/` 多文件方案 |
| `App.tsx` → `MainWindow` 组件 | ✅ | 主设置窗口（#/main，开机自启/深色模式/服务状态/关于），替代原规划的独立 `SettingsWindow.tsx` |
| `lib/events.ts` | ✅ | 17 个事件常量 + `TauriEventName` 联合类型，`useBackendSync()` 在 App.tsx 集中监听；另有通用 `hooks/useTauriEvent.ts` hook 供组件局部监听 |
| `lib/i18n.ts` | ✅ | 中英双语字典 + `useT()` hook，全 UI 文案经 `t()` 翻译，切换语言即时生效（见 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) 与 [AGENTS.md](../AGENTS.md) 约定） |

---

## 五、注意事项

1. **PreviewPopup 已迁移**：从 `components/PreviewPopup.tsx` 迁移到 `windows/panel/PreviewPopup.tsx`，已重写为使用设计系统（Tailwind + `cn()`），支持 recognition/rewrite 双模式。`components/` 下的旧版已删除。
2. **遗留组件已清理**：`StatusBadge.tsx`、`pages/History.tsx`、`pages/Settings.tsx` 已删除。面板状态显示使用 `StateView.tsx`，历史页使用 `HistoryTab.tsx`，设置页使用 `ServiceTab.tsx` + 主窗口 `MainWindow`。
3. **pages/ 目录已清理**：旧版 `History.tsx` 和 `Settings.tsx` 已删除，功能已迁移到 panel tabs 和主窗口。
4. **前端 Mock 数据已全部移除**：appStore 不再包含 MOCK_HISTORY/MOCK_FILTER_WORDS/MOCK_LOCAL_MODELS，所有数据通过 IPC 从后端拉取。浏览器环境下 invoke 调用 catch 静默降级，列表为空。
5. **Cargo.toml 依赖已补齐**：tracing/tracing-subscriber、tauri-plugin-autostart、tauri-plugin-single-instance、reqwest/tokio、sha2、serde_json 等依赖均已声明。cpal 0.16、enigo 0.6.1 保持不变。
6. **capabilities 权限已补齐**：已授权 core:window:allow-show/hide/set-focus/set-position/close/start-dragging + autostart:default，覆盖当前所有插件。
7. **设计系统以 index.css 的 @theme 为准**：颜色 token 使用 CSS 变量（`var(--bg-primary)` 等），Tailwind v4 通过 @theme 注册后可直接用 `bg-bg-primary` 等 utility 类。
8. **SkillTab 已接通后端**：技能页通过 `listSkills`/`setSkill`/`getActiveSkill` IPC 从后端拉取 4 个预设技能（english/list/report/dictation），不再使用 Mock 数据。
