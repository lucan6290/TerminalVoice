# AGENTS.md — TerminalVoice 项目导航

> 本文档是 Agent（AI 助手）的第一张地图。所有进入本项目的 Agent **必须先读此文件**，以快速理解项目结构、关键约定、当前状态和文档索引。

---

## 一、项目定位

**TerminalVoice** — Windows 平台常驻全局语音输入桌面工具。核心形态：桌面悬浮小球 + 极简面板，支持三大核心动作：
- **说**（按住 Right Alt 语音输入 → ASR → 可选 AI 整理 → 直接上屏）
- **听**（Alt+1 朗读选中文本）
- **译**（Alt+2 翻译/口译）

---

## 二、技术栈

| 层 | 技术 |
| :--- | :--- |
| 桌面框架 | **Tauri v2**（Rust 后端 + WebView2 前端） |
| 前端 | **React 19 + TypeScript 5.7** |
| 构建 | **Vite 8**（Rolldown + Oxc） + `@vitejs/plugin-react` |
| 样式 | **Tailwind CSS v4**（`@tailwindcss/vite` 插件零配置） |
| 状态管理 | **Zustand 5**（`usePanelStore`）+ `useSyncExternalStore`（Toast） |
| 图标 | **lucide-react** |
| 后端 | **Rust 1.85+** |
| 数据库 | **SQLite**（`rusqlite` 0.40 bundled，WAL 模式） |
| 测试 | **Vitest 3**（jsdom）+ Rust 内置 `#[cfg(test)]` |

---

## 三、目录结构（当前实际）

```
TerminalVoice/
├── AGENTS.md                     ← 你正在读（Agent 入口）
├── README.md                     ← 项目说明
├── CLAUDE.md                     ← Git 工作流规则
├── package.json                  ← 前端依赖与脚本
├── vite.config.ts                ← Vite 配置（React + Tailwind 插件）
├── vitest.config.ts              ← Vitest 配置（jsdom）
├── tsconfig.json                 ← TS 严格模式
├── index.html                    ← Vite 入口 HTML（lang=zh-CN）
│
├── src/                          ← 前端源码（React + TS）
│   ├── main.tsx                  ← React 入口
│   ├── App.tsx                   ← 路由 + Tauri 事件桥接 + 环境检测
│   ├── index.css                 ← Tailwind v4 主题 tokens + 全局样式
│   ├── lib/
│   │   ├── commands.ts           ← Tauri invoke 封装（24 个命令）
│   │   ├── events.ts             ← Tauri 事件名称常量（14 个事件）
│   │   ├── types.ts              ← 共享 TS 类型（与 Rust serde 对齐）
│   │   └── cn.ts                 ← className 合并工具（极简 join）
│   ├── stores/
│   │   ├── appStore.ts           ← Zustand: usePanelStore（核心状态 + loadAll() + 异步 action）
│   │   └── toastStore.ts         ← Toast 外部 store
│   ├── windows/                  ← 多窗口入口（hash 路由分发）
│   │   ├── ball/BallWindow.tsx   ← 悬浮小球窗口（#/ball，7 状态视觉 + computeBallState）
│   │   └── panel/                ← 极简面板窗口（#/panel）
│   │       ├── PanelWindow.tsx   ← 面板主组件（顶部栏+首页+Tab+底栏）
│   │       ├── PreviewPopup.tsx  ← 双模式预览弹窗（recognition/rewrite）
│   │       └── tabs/             ← 5 个 Tab：Skill/Dict/History/Help/Service（IPC 驱动）
│   ├── components/               ← 通用组件
│   │   ├── ui/                   ← 原子组件：Toast/ToggleSwitch/SettingRow/ErrorModal/TranslatePopup
│   │   └── StatusBadge.tsx       ← 早期 MVP 状态徽章（待整合）
│   ├── pages/                    ← 旧版页面（History/Settings，待迁移）
│   └── test/setup.ts             ← Vitest setup（jest-dom）
│
├── src-tauri/                    ← Rust 后端
│   ├── Cargo.toml                ← Rust 依赖（tauri 2 / rusqlite / cpal 等）
│   ├── tauri.conf.json           ← Tauri 配置：3 窗口（main/ball/panel）
│   ├── capabilities/default.json ← 权限：仅 core:default + window show/focus
│   ├── build.rs
│   └── src/
│       ├── main.rs               ← 入口：调用 terminalvoice_lib::run()
│       ├── lib.rs                ← setup：DB + Runtime + 24 个 invoke handler
│       ├── state.rs              ← 5 状态机（Idle/Recording/Recognizing/Preview/Paused）+ 8 事件
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── config.rs         ← 配置 CRUD + config-updated 事件
│       │   ├── history.rs        ← 历史列表
│       │   └── preview.rs        ← 状态查询/mock 预览/确认 + 状态事件推送
│       └── services/
│           ├── mod.rs
│           ├── db.rs             ← SQLite（config/history/filter_words 三表）
│           └── preprocess.rs     ← 文本预处理（3 模式 + 过滤词 + 标点）
│
└── docs/                         ← 项目文档
    ├── CODE_MAP.md               ← ⭐ 当前代码状态地图（必看）
    ├── IPC_API.md                ← ⭐ IPC 接口契约（invoke + events）
    ├── STATE_MACHINE.md          ← ⭐ 状态机详细文档
    ├── DESIGN_SYSTEM.md          ← ⭐ 前端设计 Tokens + 组件规范
    ├── picture/                  ← UI 设计截图
    ├── v0.1/                     ← V1.1 历史文档（早期单窗口方案）
    │   ├── ARCHITECTURE.md       ← V1.1 目标架构蓝图
    │   ├── IMPLEMENTATION.md     ← V1.1 6 阶段实施方案
    │   ├── TerminalVoice_PRD_V1.0.md ← PRD V1.1（产品需求+验收标准）
    │   ├── UNIMPLEMENTED_FEATURES.md ← 9 子系统缺口分析
    │   └── 2026-08-09-*.md       ← 11 份 V1.1 实施计划
    └── v0.2/                     ← v0.2 浮球方案文档（当前版本规划）
        ├── 2026-09-05-floating-ball-voice-tool-plan.md ← 浮球方案总计划
        ├── ui-requirements-floating-voice-tool.md      ← 浮球 UI 需求
        └── prior-art-research-floating-voice-tool.md   ← Handy/Pot 复用调研
```

---

## 四、当前实现状态速查

项目处于**从早期 MVP 骨架向三窗口浮球方案演进**的阶段。请阅读 [docs/CODE_MAP.md](docs/CODE_MAP.md) 获取每个模块的完整状态。以下是核心结论：

### ✅ 已实现且可用
- Rust 状态机 `state.rs`（5 状态 + 8 事件 + 7 单元测试）
- 文本预处理 `preprocess.rs`（Normal/Developer/Raw + 过滤词 + 标点，5 测试）
- SQLite 数据库 `db.rs`（三表 + WAL + 默认过滤词，3 测试）
- 前端三窗口路由（`main` 隐藏 / `ball` 悬浮球 / `panel` 面板）
- BallWindow：7 状态视觉（idle/recording/thinking/disabled/error/rewrite/tts）+ `computeBallState()` + 毛玻璃效果
- PanelWindow：顶部栏 + 首页快捷设置 + 深浅主题 + 5 个 Tab + Service 页
- PreviewPopup：双模式预览弹窗（recognition=绿色 / rewrite=紫色），Ctrl+Enter 确认 / Esc 取消
- ErrorModal / TranslatePopup：全局浮层组件，自动消失
- 设计系统完整：Tailwind v4 tokens（颜色/圆角/阴影/字体/动画）
- Zustand store：`loadAll()`（Promise.allSettled 初始化）+ 异步 action（乐观更新 + 回滚）+ hydrate/persist 配置
- IPC 联通：24 个 invoke 命令 + 14 个 Tauri 事件（`useBackendSync()` 集中监听）

### ⚠️ 前端 Mock，后端未实现
- 录音、ASR 识别、文本注入（Cargo.toml 已声明 cpal/enigo/rdev/arboard 但代码未用）
- 全局热键（前端 package.json 有 plugin API，但 Rust 未注册插件）
- 系统托盘、DPAPI 加密、日志（tracing）、Tauri 插件注册

### 🔴 遗留组件（早期 MVP，未接入新架构）
- `StatusBadge.tsx`：朴素 inline style，未使用设计系统
- `pages/History.tsx`、`pages/Settings.tsx`：旧版单页路由，待迁移到 panel tabs

---

## 五、关键约定

### 5.1 命名与序列化

**Rust → TS 字段命名**：所有 Rust struct 使用 `#[serde(rename_all = "camelCase")]`，TS 端使用 camelCase。参见 [lib/types.ts](src/lib/types.ts)。

**IPC 命令命名**：Rust 端 `snake_case`（如 `get_app_status`），TS 封装层同名。

**文件命名**：
- Rust：`snake_case.rs`
- TS/TSX：`PascalCase.tsx`（组件）、`camelCase.ts`（工具/hook/store）
- 目录：`camelCase/`

### 5.2 样式约定

- 使用 **Tailwind v4**，通过 `index.css` 中 `@theme` 块定义 design tokens
- 深浅主题通过 `<body>` 上的 `.dark` / `.theme-light` 类切换
- 透明窗口（ball/panel）通过 `<body class="window-transparent">` 实现
- className 合并使用 [lib/cn.ts](src/lib/cn.ts)（极简，无 clsx/tailwind-merge）
- 动画关键帧定义在 `index.css`（pulse-dot / breathing-glow / fade-in / ball-bounce）
- Tooltip 使用 CSS `[data-tip]` 属性实现，无需 JS 组件

### 5.3 窗口路由

- 基于 `window.location.hash` 的轻量路由，见 `App.tsx` 的 `useHashRoute()`
- `#/ball` → BallWindow（tauri.conf.json 默认）
- `#/panel` → PanelWindow
- `#/main` → 主窗口（占位，待实现）
- 其他 hash（含空）→ DevPreview（浏览器开发时并列预览两窗口）

### 5.4 环境检测

- `isTauriRuntime()` 通过检测 `window.__TAURI_INTERNALS__` 判断是否在 Tauri 中运行
- 浏览器环境下所有 invoke 调用 catch 静默降级，使用前端 Mock 数据
- 开发时可直接 `pnpm dev` 在浏览器预览 UI，无需启动 Tauri

### 5.5 Tauri 运行时

- Rust 状态通过 `tauri::generate_handler![]` 注册 invoke commands
- Rust→前端推送通过 `app.emit("event-name", payload)`
- 当前已注册 14 个事件：`runtime-state-changed`、`config-updated`、`toast`、`preview-ready`、`preview-cleared`、`recording-started`、`recording-tick`、`recording-stopped`、`recording-cancelled`、`tts-started`、`tts-stopped`、`translate-result`、`rewrite-started`、`rewrite-result`
- 前端在 `useBackendSync()` hook 中集中监听全部 14 个事件（使用 `unlisteners` 数组统一管理），事件名称常量定义在 [lib/events.ts](src/lib/events.ts)

### 5.6 文档版本管理规则

文档分两类，职责明确，**不得混淆**：

**① 全局文档（根目录 + docs/ 根，实时更新）**

描述**当前代码实际状态**，随代码修改同步更新，始终反映最新代码：
- 根目录：`AGENTS.md`、`README.md`、`CLAUDE.md`
- docs/ 根：`CODE_MAP.md`、`IPC_API.md`、`STATE_MACHINE.md`、`DESIGN_SYSTEM.md`

**② 版本文档（docs/vX.X/，只读归档）**

每个版本一个目录，存放该版本的**需求/计划/方案/调研**等规划类文档，版本发布后归档不再修改：
- `docs/v0.1/` — V1.1 单窗口方案（已归档）
- `docs/v0.2/` — 当前浮球方案
- 未来版本（v0.3、v1.0 等）：直接新建 `docs/vX.X/` 目录，放入该版本的增量/变更文档即可
- 版本文档之间相互引用时使用相对路径（同目录内直接引用），全局文档引用版本文档时使用 `docs/vX.X/xxx.md` 路径

**规则红线**：
- 不得将版本规划文档放到 docs/ 根目录
- 不得将实时状态文档（CODE_MAP 等）移动到版本目录
- 新版本开始时，先创建 `docs/vX.X/` 并写入该版本的需求/计划，再开始编码
- 编码过程中只更新全局文档，不修改已归档的旧版本文档

### 5.7 文档实时同步规则（强制）

**任何代码变更，只要会影响其他 Agent 对项目的理解，都必须同步更新对应文档，使文档始终与代码一致。**

需要更新文档的变更类型（不限于此）：

| 变更类型 | 必须更新的文档 |
| :--- | :--- |
| 新增/删除/重命名 IPC 命令或事件 | [docs/IPC_API.md](docs/IPC_API.md) + [docs/CODE_MAP.md](docs/CODE_MAP.md) |
| 修改状态机（状态/事件/转移规则） | [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) + [docs/CODE_MAP.md](docs/CODE_MAP.md) |
| 新增/删除/迁移模块、文件、目录 | [docs/CODE_MAP.md](docs/CODE_MAP.md) + 对应子目录的 `AGENTS.md` |
| 修改共享类型（lib/types.rs / lib/types.ts） | [docs/IPC_API.md](docs/IPC_API.md) 共享类型章节 + 对应 `AGENTS.md` |
| 修改设计 tokens、组件规范 | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) + 对应组件 `AGENTS.md` |
| 修改关键约定（命名/序列化/依赖方向等） | 根 [AGENTS.md](AGENTS.md) 对应章节 |
| 修改构建/依赖/环境要求 | [README.md](README.md) 技术栈/环境章节 |

**判定标准**：
- 「变更是否改变了其他 Agent 对『这个模块是什么、怎么用、有哪些接口』的认知？」——是 → 必须更新文档。
- 单纯的重构实现细节、不影响接口/结构/约定的内部改动，可只更新 `CODE_MAP.md` 中的状态标注。

**执行要求**：
- 文档更新与代码变更在**同一次提交**中完成，禁止「先改代码、文档以后补」。
- 更新后的文档必须**准确反映变更后的实际状态**，不得保留过时描述。
- 若发现文档与代码不一致（文档落后于代码），以代码为准，并**主动补写文档**，而不是让不一致持续存在。

---

## 六、文档索引

| 文档 | 用途 | 何时读 |
| :--- | :--- | :--- |
| **AGENTS.md**（本文件） | 项目导航入口 | 进入项目时 |
| [README.md](README.md) | 项目说明、快速开始 | 首次了解项目 |
| [docs/CODE_MAP.md](docs/CODE_MAP.md) | 每个文件/模块的当前状态、缺口 | 修改代码前必看 |
| [docs/IPC_API.md](docs/IPC_API.md) | IPC 命令、事件、类型契约 | 涉及前后端通信时 |
| [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) | 状态机定义、转移规则、测试 | 修改 state.rs 或状态相关逻辑时 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | 颜色/圆角/字体/阴影 tokens + 组件规范 | 写 UI 组件时 |
| [docs/v0.2/](docs/v0.2/) | **当前版本规划**（浮球方案 PRD/计划/调研） | 开发 v0.2 新功能时 |
| [docs/v0.1/](docs/v0.1/) | **历史版本文档**（V1.1 单窗口方案，已归档） | 参考历史设计决策时 |
| [CLAUDE.md](CLAUDE.md) | Git 工作流（main 分支、本地提交、不 push） | 提交代码前 |

---

## 七、常用命令

```bash
# 前端开发（浏览器预览，不启动 Tauri）
pnpm dev              # http://localhost:1420

# Tauri 开发（前端 + Rust 后端一起启动）
pnpm tauri dev

# 前端测试
pnpm test             # 单次运行
pnpm test:watch       # watch 模式

# 前端构建
pnpm build

# Tauri 打包
pnpm tauri build

# Rust 测试（在 src-tauri/ 下）
cargo test
```

---

## 八、Git 规则（来自 CLAUDE.md）

- 只保留 `main` 主分支，不使用长期开发分支
- 每次修改直接在工作区完成并本地提交
- **默认只做本地提交，不推送远程**
- 未经用户明确要求，不执行 `git push`、创建远程仓库或配置远程地址
