# AGENTS.md — src/windows/ 多窗口层

> 每个子目录对应 Tauri 的一个独立窗口（`tauri.conf.json` 中的 label），由 [App.tsx](../App.tsx) 的 hash 路由分发。

## 窗口与路由映射

| 目录 | Tauri label | 路由 | 尺寸 | 特性 |
| :--- | :--- | :--- | :--- | :--- |
| [ball/](ball/) | `ball` | `#/ball` | 80×80 | 透明、无边框、置顶、任务栏隐藏 |
| [panel/](panel/) | `panel` | `#/panel` | 388×620 | 透明、无边框、置顶、任务栏隐藏 |
| （暂无） | `main` | `#/main` | 520×600 | 默认隐藏，`App.tsx` 中为占位 |

## 约定

1. **每个窗口子目录一个入口组件**（`BallWindow.tsx` / `PanelWindow.tsx`），与窗口 label 对应。
2. **窗口内组件只通过 store 读写状态**，跨窗口状态通过 `usePanelStore` 共享（所有窗口运行在同一 React 应用实例中，store 天然共享）。
3. **窗口原生操作**（`Window.getByLabel`、`show`、`setFocus` 等）需先判断 `isTauriRuntime()`，浏览器环境静默返回。
4. 透明窗口组件根部要 `background: "transparent"`，由父级 `.window-transparent` body class 配合。
5. 新增窗口时：在 `tauri.conf.json` 加窗口配置 → 在 `App.tsx` 加路由分支 → 新建子目录 + 入口组件 + 本目录 AGENTS.md。

## 子目录详情

- [ball/AGENTS.md](ball/AGENTS.md) — 悬浮球窗口
- [panel/AGENTS.md](panel/AGENTS.md) — 极简面板窗口（含 tabs）
