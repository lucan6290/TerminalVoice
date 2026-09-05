# TerminalVoice 浮球式语音工具改造方案

**日期**：2026-09-05
**基线**：基于现有 TerminalVoice 代码（骨架/MVP 阶段）+ Handy 复用点 + Pot 翻译方案
**产品形态**：Windows 10/11 x64，桌面悬浮小球 + 极简面板，三核心动作（说/听/译）
**后端模式**：用户自带 Key（ASR/LLM/翻译），云端 ASR + AI 整理为主路径，本地离线模型为断网兜底

---

## 一、关键前置决策

| 决策 | 结论 | 备注 |
| :--- | :--- | :--- |
| 代码基础 | **在现有 TerminalVoice 代码库上扩展** | 现有代码为骨架/MVP，可直接改，不必另起仓库 |
| 核心引擎底座 | **Adapt Handy 的离线引擎 crate** | `transcribe-cpp`（Whisper GGML）、`vad-rs`、`cpal`、`rdev`、`rubato` |
| 翻译模块 | **直接采用 Pot 的多引擎插件方案** | ⚠️ **License 风险**：Pot 为 GPL-3.0，若直接引入 Pot 源码/插件体系会传染整个项目为 GPL；建议**借鉴 Pot 的翻译引擎适配架构（插件式多引擎）但自研实现**，避免 GPL。如必须直接引 Pot 代码，则整个项目需改为 GPL-3.0 开源 |
| TTS | edge-tts（在线，免 Key，中文好）+ Piper（离线） | 双模式 |
| 文本注入 | enigo + arboard（剪贴板优先，SendInput 降级） | 与 PRD 一致 |
| 全局热键 | `tauri-plugin-global-shortcut` | 官方插件 |

> **关于 Pot 的 License 风险提醒**：用户明确要求"直接使用 Pot 方案"。这里需要用户最终确认 —— 若接受 GPL-3.0，可以直接 fork Pot 并在其上叠加语音/TTS 功能；若希望保持 MIT/私有，则必须自研翻译适配层（仅借鉴 Pot 的插件架构思想，不抄代码）。本方案默认按「自研翻译层、借鉴 Pot 架构」推进。

---

## 二、现有代码盘点（基线）

当前 TerminalVoice 处于**极早期骨架阶段**，可复用与需新增内容如下：

### 已具备（可直接复用）

| 模块 | 文件 | 状态 |
| :--- | :--- | :--- |
| 状态机 | `src-tauri/src/state.rs` | ✅ 5 状态（Idle/Recording/Recognizing/Preview/Paused）+ 事件转换，已写测试 |
| 文本预处理 | `src-tauri/src/services/preprocess.rs` | ✅ 三种模式（Normal/Developer/Raw）+ 过滤词/单行/标点，已写测试 |
| 数据层 | `src-tauri/src/services/db.rs` | ✅ SQLite（history/config/filter_words 三表），CRUD 已写 |
| Tauri IPC 骨架 | `src-tauri/src/commands/` | ✅ preview/history 两个 command |
| 前端框架 | `src/`（React 19 + TS + Tailwind v4） | ✅ 入口、路由、mock 预览弹窗 |

### 缺失（必须新增）

| 模块 | 现状 |
| :--- | :--- |
| 录音（cpal） | ❌ 完全没有，目前只有 mock 文本 |
| ASR 调用（云端/本地） | ❌ 没有 HTTP 客户端、没有模型推理 |
| 全局热键 | ❌ 没有注册 global-shortcut 插件 |
| 系统托盘 | ❌ 没有 TrayIcon |
| 悬浮小球窗口 | ❌ tauri.conf.json 只有一个主窗口 |
| 文本注入（上屏） | ❌ 没有 enigo/arboard |
| TTS（朗读） | ❌ 没有音频播放、没有 edge-tts/Piper |
| 翻译引擎 | ❌ 没有任何翻译 API 调用 |
| LLM 调用（整理/改写） | ❌ 没有 HTTP/LLM 客户端 |
| 截图 OCR | ❌ 没有 |
| 前端状态管理 | ❌ 没有 Zustand store |
| UI 设计系统 | ❌ 全是内联样式，无组件库 |
| DPAPI 密钥加密 | ❌ 没有 |
| 配置读写 | ❌ config 表建了但没有 commands |
| 开机自启 | ❌ 没有 autostart 插件 |

**结论**：现有代码只提供了"状态机 + 预处理 + SQLite + 前端骨架"，剩下 80% 都是新增。适合继续在这个骨架上扩展。

---

## 三、目标架构

### 3.1 窗口体系

PomeType 形态需要 **三类 Tauri 窗口**：

```
┌──────────────────────────────────────────────┐
│ 1. 悬浮小球 (FloatingBall)                   │
│    - 48x48 无边框透明窗口，置顶，可拖动        │
│    - 状态色：绿色（空闲）/ 蓝色（录音）/       │
│              橙色（识别中）/ 灰色（暂停）       │
│    - 左键点击：展开/收起面板                  │
│    - 右键：托盘菜单                          │
├──────────────────────────────────────────────┤
│ 2. 极简面板 (Panel Window)                   │
│    - 约 380x560，圆角大卡片，深色/浅色主题    │
│    - 顶部：Logo + 状态点 + 关闭              │
│    - 内容区：根据状态切换（首页/听写中/朗读/  │
│            翻译/改写/离线听写弹窗）          │
│    - 底部：5 个 tab（技能/词典/历史/关于/??）│
├──────────────────────────────────────────────┤
│ 3. 设置/主窗口 (Settings Window)             │
│    - 可隐藏，从面板或托盘打开                │
│    - Key 配置、模型下载、音色选择、备份恢复   │
└──────────────────────────────────────────────┘
```

### 3.2 Rust 后端模块

```
src-tauri/src/
├── main.rs                      # 入口
├── lib.rs                       # 注册 plugins + commands + setup
├── state.rs                     # 扩展状态机（新增 Reading/Translating/Rewriting/TTSPlaying 状态）
├── tray.rs                      # 系统托盘
├── windows.rs                   # 三窗口管理（浮球/面板/设置）
│
├── commands/                    # Tauri IPC
│   ├── mod.rs
│   ├── app.rs                   # 状态查询、暂停/启用
│   ├── asr.rs                   # 云端/本地 ASR 调用
│   ├── audio.rs                 # 录音开始/停止/取消
│   ├── inject.rs                # 文本注入（剪贴板 + enigo）
│   ├── tts.rs                   # 朗读（edge-tts / Piper）
│   ├── translate.rs             # 翻译（多引擎）
│   ├── llm.rs                   # AI 整理/改写（OpenAI 兼容 API）
│   ├── selection.rs             # 获取选中文本
│   ├── ocr.rs                   # 截图 OCR
│   ├── config.rs                # 配置读写（DPAPI 加密）
│   ├── dictionary.rs            # 个人词典 CRUD
│   ├── history.rs               # 历史记录（已存在，扩展）
│   ├── model.rs                 # 本地模型下载/管理
│   └── backup.rs                # 数据备份/恢复
│
├── services/                    # 业务逻辑
│   ├── mod.rs
│   ├── audio/
│   │   ├── recorder.rs          # cpal 录音封装
│   │   ├── vad.rs               # Silero VAD 封装
│   │   └── resample.rs          # rubato 重采样
│   ├── asr/
│   │   ├── cloud.rs             # 云端 ASR（阿里/腾讯/讯飞/Whisper API/OpenAI 兼容）
│   │   ├── local.rs             # 本地 Whisper（transcribe-cpp / whisper-rs）
│   │   └── mod.rs               # 统一 trait
│   ├── preprocess.rs            # （已存在）规则预处理
│   ├── llm/
│   │   ├── client.rs            # OpenAI 兼容 HTTP 客户端
│   │   ├── polish.rs            # AI 整理（原意校对/润色/结构整理）
│   │   ├── rewrite.rs           # 语音改写
│   │   └── translate_llm.rs     # LLM 翻译 fallback
│   ├── tts/
│   │   ├── edge.rs              # edge-tts（WebSocket）
│   │   ├── piper.rs             # Piper 本地 TTS
│   │   └── mod.rs               # 统一 trait + 播放器（rodio）
│   ├── translate/               # 借鉴 Pot 的多引擎插件架构
│   │   ├── mod.rs               # 统一 Translator trait
│   │   ├── engines/             # 各引擎适配器（OpenAI/DeepL/Google/百度/阿里/本地 Ollama）
│   │   └── ocr.rs               # PaddleOCR / Windows OCR
│   ├── inject/
│   │   ├── clipboard.rs         # arboard 剪贴板
│   │   ├── keyboard.rs          # enigo SendInput 注入
│   │   └── selection.rs         # 获取当前选区文本（UI Automation / 剪贴板）
│   ├── hotkey.rs                # global-shortcut 封装（Right Alt / Alt+1 / Alt+2）
│   ├── crypto.rs                # DPAPI 加解密
│   ├── db.rs                    # （已存在）SQLite
│   ├── logger.rs                # tracing 日志
│   └── backup.rs                # 数据备份/恢复（zip）
```

### 3.3 前端结构

```
src/
├── main.tsx
├── App.tsx                       # 无 UI，只挂载全局 store 和事件监听
├── index.css                     # Tailwind + 设计 tokens
│
├── windows/                      # 三个窗口各自的入口
│   ├── ball/                     # 悬浮小球
│   │   ├── BallWindow.tsx
│   │   └── Ball.module.css
│   ├── panel/                    # 极简面板
│   │   ├── PanelWindow.tsx       # 顶部栏 + 内容区 + 底部 tab
│   │   ├── views/
│   │   │   ├── HomeView.tsx      # 首页（可用额度/触发键/麦克风/开关）
│   │   │   ├── DictationView.tsx # "说一句话"录音态
│   │   │   ├── ReadingView.tsx   # 朗读态：显示内容 + 停止
│   │   │   ├── TranslateView.tsx # 翻译/口译态
│   │   │   ├── RewriteView.tsx   # 语音改写态
│   │   │   ├── DictionaryView.tsx# 自定义词条（两栏：词条→替换词）
│   │   │   └── OfflineModelView.tsx # 离线听写开关
│   │   └── components/
│   │       ├── StatusDot.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── KeyCapture.tsx
│   │       ├── ToggleSwitch.tsx
│   │       └── BottomTabs.tsx
│   └── settings/                 # 设置主窗口（保留现有 History/Settings 页）
│       └── SettingsWindow.tsx
│
├── components/                   # 通用组件
│   └── ui/                       # 基础 UI 原子组件
│
├── hooks/
│   ├── useTauriEvent.ts
│   ├── useAppState.ts            # Zustand store
│   └── useHotkey.ts
│
├── lib/
│   ├── commands.ts               # invoke 封装
│   ├── types.ts
│   └── events.ts                 # Tauri 事件常量
│
└── stores/
    └── appStore.ts               # Zustand：runtime state + 配置
```

---

## 四、UI 设计规范（提取自 PomeType 截图）

### 4.1 颜色

| Token | 浅色模式 | 深色模式 | 用途 |
| :--- | :--- | :--- | :--- |
| `--bg-primary` | `#FFFFFF` | `#2A2A2A`（深炭灰，非纯黑） | 面板背景 |
| `--bg-secondary` | `#F5F5F5` | `#353535` | 卡片/输入框背景 |
| `--bg-tertiary` | `#EDEDED` | `#404040` | 分隔行、选中态 |
| `--fg-primary` | `#1A1A1A` | `#F0F0F0` | 主文字 |
| `--fg-secondary` | `#8A8A8A` | `#AAAAAA` | 次要文字（提示、说明） |
| `--accent` | `#5CB85C` | `#6EC06E` | 主绿色（状态点/进度条/开关） |
| `--accent-dim` | `#E8F5E8` | `#2D4A2D` | 绿色背景淡色 |
| `--danger` | `#E55` | `#E55` | 关闭、删除 |
| `--divider` | `#E5E5E5` | `#3A3A3A` | 分割线 |
| `--shadow` | `0 8px 32px rgba(0,0,0,0.12)` | `0 8px 32px rgba(0,0,0,0.4)` | 面板阴影 |

### 4.2 排版

| 元素 | 字号 | 字重 | 字体 |
| :--- | :--- | :--- | :--- |
| 面板标题 (PomeType) | 22px | 500 (Medium) | `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif` |
| 区组标签（设置触发键/可用额度） | 17px | 400 | 同上 |
| 按键显示（Right-Alt） | 20px | 400，等宽数字感 | `ui-monospace, "SF Mono", Consolas` 混合 |
| 正文/说明 | 14px | 400 | 系统字体 |
| 小提示（"开启后停用..."） | 13px | 400，灰色 | 系统字体 |
| 辅助文字（780 分 39 秒） | 18px | 400 | 等宽风格 |

### 4.3 圆角与尺寸

- 面板整体圆角：**20px**
- 输入框/按钮/进度条容器圆角：**14px**
- 状态点直径：**14px**（绿色圆点，带 4px 光晕）
- 小球尺寸：**48x48px**
- 开关（toggle）：**52x28px**，圆角 14px
- 内边距：面板四边 24px，条目间距 14px，分割线间距 10px

### 4.4 布局模式

- 面板宽度：约 **380px**，高度自适应（最小 480px，最大 640px）
- 顶部栏：状态点 + 标题 + 录音指示环 + 三点菜单 + 关闭按钮
- 条目行：左标签（占 40%）+ 右控件（占 60%），垂直居中
- 进度条：高度 **8px**，圆角 4px
- 底部 tab：5 个图标等距分布，左右对齐（左：窗口/最小化图标；右四角：✨技能/📋词典/🕐历史/?帮助）

### 4.5 交互状态

- **录音中**：标题变为"说一句话"，状态点呼吸绿光，右上角显示圆形停止按钮（○）
- **识别中**：状态点橙色
- **朗读中**：浮球同步显示当前朗读文字
- **悬浮小球**：拖动时半透明，悬停放大 1.1x

---

## 五、三核心动作交互流程

### 5.1 说（语音输入 + AI 整理）

```
空闲（绿球）
  │ 用户按住 Right Alt
  ▼
录音中（蓝球 + "说一句话"面板弹出或球变大发光）
  │   ├─ 松开 Right Alt → 进入识别
  │   ├─ 再按 Right Alt（免提模式）→ 提交
  │   └─ ESC → 取消
  ▼
识别中（橙球，面板显示"识别中…"）
  │
  ├─ 云端路径：音频 → ASR API → LLM 整理（可选：原意/润色/结构/关闭）→
  │
  ├─ 本地路径（开启离线听写）：音频 → Whisper/Parakeet → 规则预处理
  │
  ▼
上屏：文本直接注入当前光标位置（剪贴板 Ctrl+V 优先，SendInput 降级）
  │
  ▼
回到空闲（不弹预览框，直接写入，与 PomeType 一致）
```

> 与现有 TerminalVoice PRD 的差异：PomeType **没有预览框**，松开后直接写入。现有 PreviewPopup 需要改造为"可选"（默认关闭，设置中可启用"先预览再上屏"）。

### 5.2 听（Alt+1 朗读原文）

```
用户选中文字
  │ 按 Alt+1
  ▼
[Rust 后端] 获取选中文本（剪贴板探测 / UI Automation）
  │
  ▼
TTS 播放（edge-tts 或 Piper，根据音色选择）
  │   ├─ 浮球显示当前朗读内容（滚动高亮）
  │   ├─ 再按 Alt+1 或 ESC → 停止
  │   └─ 播放完毕 → 回空闲
```

### 5.3 译（Alt+2 翻译 / 口译）

**有选区时**（翻译选中文字）：
```
选中外文 → Alt+2 → 翻译为中文（或反向）→ 直接 TTS 读译文
          ├─ 面板浮窗显示原文+译文
          └─ 可点复制译文
```

**无选区时**（说一句、听一句口译）：
```
Alt+2（无选区）→ 进入"口译录音"模式（橙球）
  │ 说一句外语/中文
  │ 再按 Alt+2 提交
  ▼
STT 识别 → 翻译成目标语言 → TTS 朗读译文
  │
  └─ 检测语言自动判断方向：中→英，英/其他→中
```

---

## 六、主要功能落地映射

| PomeType 功能 | 本项目实现 | 复用来源 | 新增工作量 |
| :--- | :--- | :--- | :--- |
| 语音输入 + AI 整理 | Rust ASR 客户端 + LLM 客户端 + 注入 | 复用 preprocess.rs，新增 cloud.rs/llm.rs | 中 |
| 语音朗读 | TTS 模块 + 音频播放 | 新增 edge-tts + Piper（piper-rs） | 中 |
| 语音口译 | STT + Translate + TTS 串联 | 组合 asr + translate + tts | 低 |
| 划词翻译 | 选区获取 + Translate | Pot 架构借鉴（自研，规避 GPL） | 中 |
| 截图翻译/OCR | 截图 + OCR + Translate | Windows OCR API 或 PaddleOCR | 高 |
| 语音改写 | 选中文本 + 录音 → LLM 改写 → 写回 | 复用 selection + asr + llm + inject | 中 |
| 语音输入技能（英文/清单/汇报/听写） | 预设 prompt 模板 | 新增 skills 模块，LLM prompt 配置 | 低 |
| 离线听写 | transcribe-cpp + Whisper 模型下载管理 | 直接参考 Handy 实现 | 高 |
| 个人词典 | 自定义替换词（读对 → 正确词） | 新增 dictionary 表 + UI | 低 |
| 历史记录 | 已有 history 表，扩展字段 | 复用 db.rs | 低 |
| 数据备份恢复 | 导出/导入 zip | 新增 backup.rs | 低 |
| 粘贴后恢复原剪贴板 | 注入前保存剪贴板，注入后延迟恢复 | arboard 读写 | 低 |
| 悬浮小球 | Tauri 透明无边框窗口 | 新增 Ball window | 中 |
| 极简面板 | Panel 窗口 + 5 视图 | 完全新增，按本规范实现 | 高 |

---

## 七、开发任务清单（建议按顺序分 10 个里程碑）

### M1：基础设施（2-3 天）
- [ ] Cargo.toml 加入依赖：`tauri-plugin-global-shortcut`、`tauri-plugin-clipboard-manager`、`tauri-plugin-autostart`、`cpal`、`reqwest`、`tokio`、`enigo`、`arboard`、`rodio`、`serde_json`、`dirs`、`zip`、`windows`（DPAPI + UI Automation）
- [ ] package.json 加入 `zustand`、`lucide-react`、`clsx`（shadcn/ui 基础）
- [ ] 扩展 `tauri.conf.json`：新增浮球窗口和面板窗口配置（多窗口）
- [ ] 建立 Zustand `appStore` 骨架
- [ ] 建立设计 tokens（index.css @theme）

### M2：全局热键 + 托盘（1-2 天）
- [ ] 注册 `Right Alt`（说）、`Alt+1`（听）、`Alt+2`（译）三组全局热键
- [ ] 实现系统托盘（TrayIcon），含暂停/启用/退出/打开设置
- [ ] 扩展 state.rs：新增 Recording(PTT/Handsfree)、Reading、Translating、Rewriting、TTSPlaying

### M3：悬浮小球 UI（1-2 天）
- [ ] 实现 BallWindow：48x48 无边框透明、可拖动、置顶
- [ ] 状态颜色切换（绿/蓝/橙/灰）
- [ ] 点击展开/收起面板

### M4：极简面板 UI（2-3 天）
- [ ] 实现 PanelWindow：深色/浅色主题、圆角大卡片
- [ ] 顶部栏（状态点+标题+三点+关闭）
- [ ] 首页 HomeView（可用额度→改 Key 配置状态、触发键、麦克风、三个开关）
- [ ] 底部 BottomTabs（5 图标）
- [ ] 通用组件：ToggleSwitch、ProgressBar、KeyCapture、StatusDot

### M5：录音 + 云端 ASR + 上屏（3-4 天）
- [ ] 实现 cpal 录音（16KHz/16-bit/mono PCM）
- [ ] 接入云端 ASR（先支持 OpenAI Whisper API 或用户指定的第一家）
- [ ] 实现文本注入（arboard 剪贴板 + Ctrl+V 优先，enigo 降级）
- [ ] 贯通"按住说话→松开→识别→直接上屏"主链路
- [ ] 免提说话模式（单击开始/再按提交）

### M6：AI 整理 + LLM 配置（2-3 天）
- [ ] 设置页新增 LLM API 配置（Base URL + Key + Model，DPAPI 加密）
- [ ] 实现 LLM HTTP 客户端（OpenAI 兼容）
- [ ] 三档整理模式：原意校对 / 自然润色 / 结构整理 / 关闭
- [ ] 在 ASR → 注入链路中接入 LLM 整理（可关闭）

### M7：朗读（TTS）（2-3 天）
- [ ] 实现 edge-tts（在线，默认中文音色晓晓/云希）
- [ ] 实现 Piper 本地 TTS（离线）
- [ ] 设置页语速/音色选择（普通话/英语/粤语）
- [ ] Alt+1 快捷键：选中文字→朗读；ESC/再按停止
- [ ] ReadingView：浮球同步显示朗读内容

### M8：翻译 + 口译（3-4 天）
- [ ] 建立翻译引擎 trait（借鉴 Pot 插件架构但自研）
- [ ] 先接入 LLM 翻译（复用已有 OpenAI 兼容客户端）
- [ ] 可选接入 DeepL/Google/百度/阿里（按 Key 配置）
- [ ] Alt+2 有选区：翻译 + TTS 读译文 + 面板显示
- [ ] Alt+2 无选区：进入口译录音→STT→翻译→TTS
- [ ] 自动语言检测（中→英，其他→中）

### M9：截图 OCR + 语音改写 + 技能（3-4 天）
- [ ] 截图翻译：框选区域→OCR→翻译→复制
- [ ] 语音改写：选中文字→按触发键口述要求→LLM 改写→写回原位置
- [ ] 语音输入技能：英文输出、列清单、工作汇报、精准听写（预设 prompt）
- [ ] 个人词典（自定义词条：错读词→正确词）UI 两栏布局（参考截图2）

### M10：离线听写 + 本地工具（3-5 天）
- [ ] 引入 `transcribe-cpp`（whisper.cpp GGML 绑定）或 `whisper-rs`
- [ ] 模型下载管理（下载 Whisper.cpp/SenseVoice Small 模型）
- [ ] 离线听写开关面板（参考截图3）：显示模型大小、运行内存、开关
- [ ] 离线模式下：ASR 走本地模型，停用 AI 整理与云端技能
- [ ] 历史记录页（基于现有 History 扩展）
- [ ] 数据备份/恢复（导出 zip）
- [ ] 粘贴后恢复原剪贴板

---

## 八、技术依赖总表

### Rust (Cargo.toml)

```toml
# Tauri 核心 + 插件
tauri = { version = "2", features = ["tray-icon", "window-show", "window-hide"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-dialog = "2"
tauri-plugin-autostart = "2"
tauri-plugin-single-instance = "2"

# 异步
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "rustls-tls", "stream"] }
futures-util = "0.3"

# 音频
cpal = "0.18"
hound = "3.5"        # WAV 编码
rubato = "0.16"     # 重采样
rodio = "0.19"      # 音频播放

# ASR 本地（待评估选哪个）
# whisper-rs = "0.12"        # 纯 Rust
# 或直接用 whisper.cpp 通过 FFI

# VAD
# vad-rs（Silero，参考 Handy）

# 输入注入
enigo = "0.6"
arboard = "3"

# Windows 原生（DPAPI + UI Automation）
[target.'cfg(windows)'.dependencies]
windows = { version = "0.61", features = [
  "Win32_System_Com", "Win32_Security_Cryptography",  # DPAPI
  "Win32_UI_Accessibility",                            # UI Automation 取选区
  "Win32_Graphics_Gdi", "Win32_UI_Input_KeyboardAndMouse",
] }

# 数据
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
rusqlite = { version = "0.40", features = ["bundled"] }
zip = "2"
dirs = "6"

# 日志
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-appender = "0.2"
```

### 前端 (package.json 新增)

```json
{
  "dependencies": {
    "zustand": "^5.0.0",
    "lucide-react": "^0.553.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^3.0.0"
  }
}
```

---

## 九、快捷键总表

| 快捷键 | 功能 | 模式 |
| :--- | :--- | :--- |
| `Right Alt`（按住） | 说话（Push-to-Talk） | 全局 |
| `Right Alt`（单击切换，免提模式） | 开始/提交说话 | 全局 |
| `Alt+1` | 朗读选中文字 / 停止 | 全局 |
| `Alt+2` | 翻译选中文字（朗读译文） | 全局（有选区） |
| `Alt+2`（无选区） | 语音口译（说一句、听一句） | 全局 |
| `Esc` | 取消当前操作（录音/朗读/翻译） | 全局 |

---

## 十、风险与备注

1. **Pot 的 GPL-3.0 风险**：本方案默认「借鉴 Pot 的插件架构思想，自研翻译引擎适配层」，规避 GPL 传染。若用户要求直接复制 Pot 的翻译插件代码，需将整个项目改为 GPL-3.0。
2. **Right Alt 作为触发键的兼容性**：`Right Alt`（AltGr）在部分键盘布局上会产生字符组合，注册全局热键时需测试。PomeType 用 Right Alt，可先按其行为实现。
3. **本地模型体积**：Whisper Small 约 500MB，SenseVoice Small INT8 约 228MB，首次下载需做进度 UI。
4. **截图 OCR**：Windows 10/11 有内置 `Windows.Media.Ocr` API（免额外依赖），优先用它；识别效果不足再引 PaddleOCR。
5. **粤语 TTS 音色**：edge-tts 有 `zh-HK` 音色（如 `zh-HK-HiuMaanNeural`、`zh-HK-WanLungNeural`），可满足粤语地区音色需求。
6. **音频互斥**：朗读 TTS 与录音不能同时进行，需要状态机保护。
