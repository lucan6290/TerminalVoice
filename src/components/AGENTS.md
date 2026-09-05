# AGENTS.md — src/components/ 通用组件层

> 跨窗口复用的 React 组件。分两部分：`ui/`（原子组件，接入设计系统）和本目录根下两个**遗留组件**。

## 目录结构

```
components/
├── ui/                   ← 原子 UI 组件（Toast / ToggleSwitch / SettingRow / ErrorModal / TranslatePopup）
└── StatusBadge.tsx       ← 🧹 遗留（早期 MVP，未接入设计系统）
```

## ui/ 原子组件

详见 [ui/AGENTS.md](ui/AGENTS.md)。这些组件是面板/悬浮球 UI 的基础，**新 UI 优先复用它们**。

## 🧹 遗留组件（重要）

| 组件 | 状态 | 说明 |
| :--- | :--- | :--- |
| [StatusBadge.tsx](StatusBadge.tsx) | 遗留 | 早期状态徽章，朴素 inline style，中文标签映射。面板已改用绿色状态点替代 |

**规则**：
- **新代码不要依赖遗留组件**。
- 迁移完成后遗留文件应删除，并同步更新本文档与 `docs/CODE_MAP.md`。
- 注：`PreviewPopup.tsx` 已迁移到 [windows/panel/PreviewPopup.tsx](../windows/panel/PreviewPopup.tsx)，使用设计系统重写为双模式预览弹窗（recognition/rewrite）。

## 约定

- 组件命名：`PascalCase.tsx`
- 复用组件放 `components/ui/`，业务相关组件放对应 `windows/` 子目录，不要堆在 `components/` 根下
- 样式用 Tailwind + `cn()`，design tokens 用 `var(--color-*)`，不硬编码色值
- 图标统一用 `lucide-react`
- 无状态组件优先函数组件 + 受控 props，避免内部状态
