# AGENTS.md — src/components/ 通用组件层

> 跨窗口复用的 React 组件。`ui/` 子目录为原子组件，接入设计系统。

## 目录结构

```
components/
└── ui/                   ← 原子 UI 组件（Toast / ToggleSwitch / SettingRow / ErrorModal / TranslatePopup）
```

## ui/ 原子组件

详见 [ui/AGENTS.md](ui/AGENTS.md)。这些组件是面板/悬浮球 UI 的基础，**新 UI 优先复用它们**。

## 已清理

- `StatusBadge.tsx` — 已删除，面板状态显示使用 `StateView.tsx` 替代
- `PreviewPopup.tsx` — 已迁移到 [windows/panel/PreviewPopup.tsx](../windows/panel/PreviewPopup.tsx)，使用设计系统重写为双模式预览弹窗

## 约定

- 组件命名：`PascalCase.tsx`
- 复用组件放 `components/ui/`，业务相关组件放对应 `windows/` 子目录，不要堆在 `components/` 根下
- 样式用 Tailwind + `cn()`，design tokens 用 `var(--color-*)`，不硬编码色值
- 图标统一用 `lucide-react`
- 无状态组件优先函数组件 + 受控 props，避免内部状态
