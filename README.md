# TerminalVoice

> Windows 平台常驻全局语音输入桌面工具 — 桌面悬浮小球 + 极简面板，按住说话，松开上屏。

![Status](https://img.shields.io/badge/status-MVP%20开发中-orange)
![Tauri](https://img.shields.io/badge/Tauri-v2-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![Rust](https://img.shields.io/badge/Rust-1.85+-dea584)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 项目简介

TerminalVoice 是一款 Windows 桌面端的全局语音输入工具。以一个始终置顶的 **48x48 悬浮小球** 常驻桌面，配合 **极简圆角面板**，提供三大核心能力：

- 🎙️ **说**（Right Alt）：按住说话 → ASR 语音识别 → 可选 AI 整理 → 直接注入到当前光标位置
- 🔊 **听**（Alt+1）：选中文字 → TTS 朗读
- 🌐 **译**（Alt+2）：选中翻译 / 语音口译

设计理念：不侵入原软件、不自动执行命令、保持"输入→确认→发送"的习惯流程。所有数据本地保存，音频仅发送至用户自选的 ASR 服务商。

---

## 当前状态

项目处于**从 MVP 骨架向三窗口浮球方案演进**阶段：

- ✅ 前端三窗口 UI 已基本完成（悬浮球 + 面板 + 设计系统），可在浏览器中预览
- ✅ 后端骨架已搭好（状态机、SQLite、文本预处理、配置 CRUD、IPC 桥接）
- ⚠️ 录音、ASR、文本注入、热键、托盘等核心功能尚未接入（Cargo.toml 已声明依赖待实现）
- 📋 详见 [docs/CODE_MAP.md](docs/CODE_MAP.md) 了解每个模块的完整状态

---

## 快速开始

### 环境要求

- **Rust** >= 1.85 (stable)
- **Node.js** >= 22 LTS
- **pnpm** >= 10（推荐 corepack 启用）
- **Visual Studio Build Tools 2022**（C++ 桌面开发 + Windows 10/11 SDK）
- **WebView2 Runtime**（Win10 2004+ / Win11 已内置）

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 仅前端开发（浏览器预览 UI，推荐做样式/组件时使用）
pnpm dev
# → http://localhost:1420

# 完整 Tauri 开发（前端 + Rust 后端）
pnpm tauri dev
```

### 测试

```bash
# 前端测试（Vitest + jsdom）
pnpm test

# Rust 测试
cd src-tauri && cargo test
```

### 构建

```bash
# 前端构建
pnpm build

# Tauri 打包（NSIS 安装包）
pnpm tauri build
```

---

## 技术栈

### 前端

| 类别 | 技术 |
| :--- | :--- |
| 框架 | React 19 + TypeScript 5.7 |
| 构建 | Vite 8（Rolldown + Oxc） |
| 样式 | Tailwind CSS v4（零配置，@theme 自定义 tokens） |
| 状态管理 | Zustand 5 |
| 图标 | lucide-react |
| 测试 | Vitest 3 + Testing Library + jsdom |
| 桌面 API | @tauri-apps/api v2 + 插件（global-shortcut / clipboard-manager / dialog / shell） |

### 后端

| 类别 | 技术 |
| :--- | :--- |
| 桌面框架 | Tauri v2 |
| 语言 | Rust 2021 edition |
| 数据库 | SQLite（rusqlite 0.40 bundled，WAL 模式） |
| 音频采集 | cpal 0.16（待接入） |
| 文本注入 | enigo 0.6 + arboard 3（待接入） |
| 全局热键 | rdev（待接入，计划迁移 tauri-plugin-global-shortcut） |
| HTTP | reqwest（待接入） |
| 加密 | Windows DPAPI（待接入） |

---

## 架构概览

```
┌──────────────────────────────────────────────┐
│            Windows 桌面环境                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ 终端 CLI  │  │ VS Code  │  │ 任意输入框 │  │
│  └─────┬────┘  └─────┬────┘  └─────┬─────┘  │
│        │              │              │        │
│        └──────────────┼──────────────┘        │
│                       │ SendInput/Clipboard   │
│                       ▼                       │
│  ┌─────────────────────────────────────┐      │
│  │       TerminalVoice 进程             │      │
│  │                                       │      │
│  │  ┌───────────────────────────────┐    │      │
│  │  │     Rust 后端 (src-tauri)     │    │      │
│  │  │  状态机 · 录音 · ASR · 注入   │    │      │
│  │  │  预处理 · SQLite · 配置 · 托盘  │    │      │
│  │  └───────────────┬───────────────┘    │      │
│  │                  │ Tauri IPC          │      │
│  │  ┌───────────────┴───────────────┐    │      │
│  │  │   WebView (React + Tailwind)  │    │      │
│  │  │  ┌───────┐   ┌────────────┐   │    │      │
│  │  │  │ 悬浮球 │   │  极简面板   │   │    │      │
│  │  │  └───────┘   └────────────┘   │    │      │
│  │  └───────────────────────────────┘    │      │
│  └─────────────────────────────────────┘      │
└──────────────────────────────────────────────┘
```

### 三窗口体系

| 窗口 | Label | 尺寸 | 特性 | 路由 |
| :--- | :--- | :--- | :--- | :--- |
| 悬浮小球 | `ball` | 64x64 | 透明、无边框、置顶、任务栏隐藏 | `#/ball` |
| 极简面板 | `panel` | 388x620 | 透明、无边框、置顶、任务栏隐藏 | `#/panel` |
| 主窗口 | `main` | 520x600 | 默认隐藏，设置/管理页（待实现） | `#/main` |

---

## 项目结构

```
src/                    # 前端 React + TS
├── windows/            # 三窗口入口
│   ├── ball/           # 悬浮小球
│   └── panel/          # 面板（含 5 个 Tab）
├── components/ui/      # 原子 UI 组件
├── stores/             # Zustand 状态管理
├── lib/                # invoke 封装、类型、工具
└── pages/              # 旧版页面（待迁移）

src-tauri/              # 后端 Rust
├── src/
│   ├── state.rs        # 5 状态机
│   ├── commands/       # Tauri IPC 命令
│   └── services/       # 业务服务（DB、预处理）
└── tauri.conf.json     # 窗口/构建/权限配置

docs/                   # 项目文档（见下方）
```

---

## 文档

**全局文档（实时更新，描述当前代码状态）**：

| 文档 | 说明 |
| :--- | :--- |
| [AGENTS.md](AGENTS.md) | Agent 入口导航（AI 助手必看） |
| [docs/CODE_MAP.md](docs/CODE_MAP.md) | 代码地图 — 每个模块当前状态与缺口 |
| [docs/IPC_API.md](docs/IPC_API.md) | IPC 接口契约（invoke 命令 + 事件） |
| [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) | 应用状态机详解 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | 设计 Tokens 与组件规范 |

**版本文档**：

| 目录 | 说明 |
| :--- | :--- |
| [docs/v0.2/](docs/v0.2/) | **当前版本（v0.2 浮球方案）** 规划文档：总计划、UI 需求、复用调研 |
| [docs/v0.1/](docs/v0.1/) | **v0.1（V1.1 单窗口方案）** 历史归档：PRD、架构、实施方案、11 份计划 |

---

## Git 工作流

- 仅保留 `main` 主分支
- 默认本地提交，不推送远程
- 未经明确要求不执行 `git push`

详见 [CLAUDE.md](CLAUDE.md)。

---

## License

MIT
