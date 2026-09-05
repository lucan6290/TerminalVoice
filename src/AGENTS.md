# AGENTS.md — src/ 前端源码

> 本目录是 TerminalVoice 的前端（React + TypeScript + Tailwind v4）。所有进入本目录及其子目录的 Agent 先读本文件。

## 定位

`src/` 是运行在 **WebView2** 中的 React 前端，通过 Tauri IPC 与 Rust 后端通信。采用**多窗口**架构：一个 React 应用通过 hash 路由分发到不同窗口（悬浮球 / 面板 / 主窗口）。

## 入口与根文件

| 文件 | 职责 |
| :--- | :--- |
| [main.tsx](main.tsx) | React 入口，`createRoot` 挂载 `<App />`，引入 `index.css` |
| [App.tsx](App.tsx) | 根组件：hash 路由分发、Tauri 事件桥接（`useBackendSync`）、环境检测（`isTauriRuntime`）、body class 管理、`<ToastContainer />` 全局挂载 |
| [index.css](index.css) | Tailwind v4 设计系统：`@theme` 定义全部 design tokens（颜色/圆角/阴影/字体）、动画、CSS tooltip、滚动条、深浅主题类 |

## 目录分层

```
src/
├── main.tsx / App.tsx / index.css   ← 入口 + 根组件 + 设计系统
├── lib/        ← 纯工具层（无 React）：类型、invoke 封装、className 工具
├── stores/     ← 状态管理：Zustand（appStore）+ useSyncExternalStore（toastStore）
├── windows/    ← 多窗口 UI：ball（悬浮球）、panel（面板 + tabs）
├── components/ ← 通用组件：ui/ 原子组件 + 遗留组件
├── pages/      ← 🧹 遗留旧页面（待迁移，不要新增）
└── test/       ← Vitest 全局 setup
```

## 关键约定（必读）

1. **跨层依赖方向**：`lib/` 不依赖任何层；`stores/` 只依赖 `lib/`；`windows/` 和 `components/` 依赖 `lib/` + `stores/`。禁止反向依赖（如 `lib` 引用 `stores` 或 `windows`）。
2. **Tauri 调用统一走 [lib/commands.ts](lib/commands.ts)**：不要在组件里直接 `invoke`，必须通过 commands 封装。
3. **类型统一走 [lib/types.ts](lib/types.ts)**：与 Rust serde 对齐，Rust struct 用 `rename_all = "camelCase"`，TS 端 camelCase（注意 `HistoryItem` 例外，其字段仍是 `snake_case`，见该文件）。
4. **环境检测**：所有 invoke/listen 调用前用 `isTauriRuntime()` 判断（`"__TAURI_INTERNALS__" in window`）；浏览器开发时 catch 静默降级到 Mock 数据。
5. **样式**：用 Tailwind utility + `cn()` 合并；design tokens 在 `index.css` 的 `@theme` 中定义，组件里通过 `bg-bg-primary` 等 utility 或 `var(--color-*)` 引用，**不要硬编码色值**（除少数 inline 动画背景）。
6. **深浅主题**：通过容器最外层 `dark` / `theme-light` class 切换（见 PanelWindow 根部），不在 body 上切。
7. **相对导入**：本目录内统一使用相对路径导入（`../lib/...`、`../../lib/...`），**未配置 `@/` 别名**。

## 当前状态速查

- ✅ 三窗口路由、BallWindow/PanelWindow UI、设计系统、Zustand store、IPC 桥接已实现
- 🟡 大量交互仍是前端 Mock（录音/热键/托盘/历史增删/模型下载等），后端未接通
- 🧹 `pages/` 与 `components/PreviewPopup.tsx`、`components/StatusBadge.tsx` 是早期 MVP 遗留，未接入新架构

详细模块状态见 [docs/CODE_MAP.md](../docs/CODE_MAP.md)，设计规范见 [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md)。
