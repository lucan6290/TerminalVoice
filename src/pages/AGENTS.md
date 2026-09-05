# AGENTS.md — src/pages/ 遗留页面

> 🧹 **遗留目录，不要再新增文件**。这是早期单窗口 MVP 的页面，已被 `windows/panel/tabs/` 取代。

## 文件

| 文件 | 状态 | 说明 |
| :--- | :--- | :--- |
| [History.tsx](History.tsx) | 🧹 遗留 | 旧版历史页（朴素 `ul/li`，非设计系统），已被 `windows/panel/tabs/HistoryTab.tsx` 取代 |
| [Settings.tsx](Settings.tsx) | 🧹 遗留 | 旧版设置页（占位，仅 Mock ASR 选择），已被 `windows/panel/tabs/ServiceTab.tsx` 取代 |

## 约定

- **禁止新增文件**。
- **禁止在现有功能中引用这些旧组件**（`App.tsx` 当前未路由到它们）。
- 迁移完成后删除整个目录，并同步更新：
  - [docs/CODE_MAP.md](../docs/CODE_MAP.md) 中 `pages/` 相关条目
  - [src/AGENTS.md](../AGENTS.md) 目录分层
