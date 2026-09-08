# DESIGN_SYSTEM.md — 前端设计系统规范

> **最后更新**：2026-09-06
> 本文档描述 TerminalVoice 的前端设计 Tokens 和组件规范，定义在 [src/index.css](../src/index.css) 的 `@theme` 块中。所有 UI 组件必须遵循此规范，保持视觉一致性。

---

## 一、技术基础

- **CSS 框架**：Tailwind CSS v4（`@tailwindcss/vite` 插件，零配置文件）
- **主题定义**：`@theme { ... }` 块注册 CSS 变量和 Tailwind utilities
- **深色模式**：通过 `<body>` 上的 `.dark` 类手动切换（非 `prefers-color-scheme` 自动）
- **浅色模式**：通过 `<body>` 上的 `.theme-light` 类（覆盖 Tailwind neutral-* utilities）
- **透明窗口**：`<body class="window-transparent">` 移除默认背景

---

## 二、颜色系统

### 2.1 色板（浅/深色对照）

| Token | CSS 变量 | 浅色 | 深色 | 用途 |
| :--- | :--- | :--- | :--- | :--- |
| bg-primary | `--color-bg-primary` | `#FFFFFF` | `#1C1C1E` | 面板/窗口主背景 |
| bg-secondary | `--color-bg-secondary` | `#F2F2F7` | `#2C2C2E` | 卡片/输入框背景 |
| bg-tertiary | `--color-bg-tertiary` | `#E5E5EA` | `#3A3A3C` | 选中态/分隔行背景 |
| fg-primary | `--color-fg-primary` | `#1C1C1E` | `#F2F2F7` | 主文字 |
| fg-secondary | `--color-fg-secondary` | `#8E8E93` | `#8E8E93` | 次要文字/提示文字 |
| fg-tertiary | `--color-fg-tertiary` | `#AEAEB2` | `#636366` | 辅助文字/占位符 |
| accent | `--color-accent` | `#34C759` | `#30D158` | 主绿色（状态点/进度条/开关） |
| accent-dim | `--color-accent-dim` | `#E8FAE9` | `#1A3A1E` | 绿色淡色背景 |
| danger | `--color-danger` | `#FF3B30` | `#FF453A` | 关闭/删除/错误 |
| warning | `--color-warning` | `#FF9500` | `#FF9F0A` | 警告/识别中橙色 |
| info | `--color-info` | `#007AFF` | `#0A84FF` | 信息蓝色/录音中 |
| divider | `--color-divider` | `#E5E5EA` | `#38383A` | 分割线 |
| ring | `--color-ring` | `#34C75933` | `#30D15833` | 聚焦环/光晕（带透明度） |
| ball-bg | `--color-ball-bg` | `rgba(255,255,255,0.85)` | `rgba(40,40,40,0.85)` | 悬浮球毛玻璃背景 |
| ball-border | `--color-ball-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` | 悬浮球边框 |
| shadow-color | `--color-shadow-color` | `rgba(0,0,0,0.12)` | `rgba(0,0,0,0.5)` | 阴影颜色 |

### 2.2 使用方式

Tailwind v4 注册后可直接在 utility class 中使用：

```html
<!-- 背景色 -->
<div class="bg-bg-primary">面板背景</div>
<div class="bg-bg-secondary">卡片背景</div>

<!-- 文字色 -->
<span class="text-fg-primary">主文字</span>
<span class="text-fg-secondary">次要文字</span>

<!-- 强调色 -->
<div class="bg-accent">绿色按钮/状态点</div>
<div class="text-accent">绿色文字</div>

<!-- 功能色 -->
<span class="text-danger">删除</span>
<span class="text-warning">识别中</span>
<span class="text-info">录音中</span>
```

---

## 三、字体排印

### 3.1 字体栈

```css
--font-sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei",
             "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Consolas", monospace;
```

### 3.2 字号规范

| 用途 | class | 字号 | 字重 |
| :--- | :--- | :--- | :--- |
| 窗口标题 | `text-xl` ~ `text-[22px]` | 22px | font-medium (500) |
| 区组标签 | `text-base` ~ `text-[17px]` | 17px | font-normal (400) |
| 按键显示（热键） | `text-lg` ~ `text-[20px]` | 20px | font-normal + font-mono |
| 正文 | `text-sm` | 14px | font-normal |
| 小提示文字 | `text-xs` ~ `text-[13px]` | 13px | font-normal + text-fg-secondary |
| 辅助数字（额度等） | `text-lg` | 18px | font-normal + 等宽风格 |

---

## 四、圆角体系

| Token | CSS 变量 | 值 | 用途 |
| :--- | :--- | :--- | :--- |
| `--radius-window` | — | `22px` | 面板窗口整体圆角 |
| `--radius-card` | — | `14px` | 卡片/输入框/设置行/进度条容器 |
| `--radius-control` | — | `10px` | 按钮/小控件 |
| `--radius-pill` | — | `9999px` (full) | 开关/状态点/胶囊按钮/小球 |

### Tailwind 中直接使用

```html
<div class="rounded-[22px]">窗口面板</div>
<div class="rounded-[14px] bg-bg-secondary">卡片</div>
<div class="rounded-full">开关/小球</div>
```

---

## 五、阴影

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `shadow-window` | `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)` | 面板窗口阴影（浅色） |
| `shadow-window`（深色） | `0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)` | 面板窗口阴影（深色） |
| `shadow-ball` | `0 4px 16px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)` | 悬浮球阴影 |

使用方式：通过 CSS 类 `shadow-window` / `shadow-ball`（在 index.css 中定义）。

---

## 六、动画

定义在 `@keyframes` 中，共 4 个动画：

| 名称 | Keyframes | 用途 | 使用 |
| :--- | :--- | :--- | :--- |
| `pulse-dot` | scale 1→1.3→1，opacity 变化 | 状态点脉冲（识别中橙色） | `animate-pulse-dot` |
| `breathing-glow` | box-shadow 呼吸扩散 | 录音中麦克风光晕 | `animate-breathing-glow` |
| `fade-in` | opacity 0→1 + translateY(8px→0) | 面板/弹窗进入动画 | `animate-fade-in` |
| `ball-bounce` | translateY(0→-4px→0)，循环 | 悬浮球悬浮微动 | `animate-ball-bounce` |

```html
<!-- 使用示例 -->
<div class="animate-pulse-dot w-3 h-3 rounded-full bg-warning"></div>
```

动画时长/缓动：
- pulse-dot：1.5s ease-in-out infinite
- breathing-glow：2s ease-in-out infinite
- fade-in：0.3s ease-out forwards
- ball-bounce：3s ease-in-out infinite

---

## 七、间距与布局

### 7.1 面板内边距

- 面板四周 padding：`p-6`（24px）
- 条目间距（设置行之间）：`gap-3.5`（14px）
- 分割线上下间距：`my-2.5`（10px）
- 卡片内间距：`p-4`（16px）

### 7.2 面板尺寸

- 宽度：`380px`（tauri.conf.json 配置）
- 高度：标准 `612px`
- 悬浮球：`48x48px`（视觉尺寸），窗口 64x64

### 7.3 顶部栏高度

- 高度：约 `48px`
- 拖拽区：`data-tauri-drag-region` 属性标记（Tauri 原生拖拽）

---

## 八、组件规范

### 8.1 状态点（StatusDot）

```html
<!-- 空闲状态：绿色静态 -->
<div class="w-3.5 h-3.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-ring)]"></div>

<!-- 录音状态：绿色 pulse -->
<div class="w-4 h-4 rounded-full bg-accent animate-pulse-dot shadow-[0_0_12px_var(--color-accent)]"></div>

<!-- 识别状态：橙色 pulse -->
<div class="w-3.5 h-3.5 rounded-full bg-warning animate-pulse-dot"></div>

<!-- 暂停状态：灰色无动画 -->
<div class="w-3.5 h-3.5 rounded-full bg-fg-tertiary"></div>
```

### 8.2 ToggleSwitch

已有组件 [components/ui/ToggleSwitch.tsx](../src/components/ui/ToggleSwitch.tsx)：
- 尺寸：52x28px
- 圆角：14px（rounded-full）
- 开启：bg-accent
- 关闭：bg-bg-tertiary
- 圆点：24x24px white，translate-x 切换
- 带 0.2s transition

### 8.3 SettingRow

已有组件 [components/ui/SettingRow.tsx](../src/components/ui/SettingRow.tsx)：
- 外层：rounded-[14px] bg-bg-secondary px-4 py-3
- 左标签区：text-base text-fg-primary（可带 sub-label text-xs text-fg-secondary）
- 右控件区：children，flex justify-end
- 可点击行：cursor-pointer hover:bg-bg-tertiary transition-colors

### 8.4 Toast

已有组件 [components/ui/Toast.tsx](../src/components/ui/Toast.tsx)：
- 位置：右上角 fixed top-4 right-4
- 宽度：max-w-[320px]
- 圆角：rounded-[14px]
- 层级：z-50
- 4 种 level：info (bg-info)、success (bg-accent)、warn (bg-warning)、error (bg-danger)
- 动画：animate-fade-in
- 自动消失：默认 3s

### 8.5 悬浮球（BallWindow）

核心样式：
```css
.ball-button {
  width: 48px; height: 48px;
  border-radius: 9999px;
  background: var(--color-ball-bg);
  backdrop-filter: blur(14px) saturate(180%);
  border: 1px solid var(--color-ball-border);
  box-shadow: var(--shadow-ball);
  transition: transform 0.2s ease;
}
.ball-button:hover { transform: scale(1.08); }
```

Tooltip：使用 CSS `[data-tip]` 属性，hover 时左侧弹出黑色气泡。

**7 状态视觉系统**（由 `computeBallState()` 驱动）：

| 视觉态 | 颜色 | 图标 | 光晕 | 标签 |
| :--- | :--- | :--- | :--- | :--- |
| `idle` | 🟢 绿色 | 无（圆点） | 无 | "就绪 · 按住 Right-Alt 说话" |
| `recording` | 🔵 天蓝 (`sky-400`) | Mic | breathing-glow | "录音中 · 松开上屏" |
| `thinking` | 🟠 琥珀 (`amber-400`) | Loader2 (spin) | breathing-glow | "识别中…" |
| `disabled` | ⚫ 灰色 | 无（圆点） | 无 | "已暂停" |
| `error` | 🔴 红色 (`red-500`) | AlertCircle | breathing-glow | "出错了 · 点击查看" |
| `rewrite` | 🟣 紫色 (`purple-400`) | Wand2 | breathing-glow | "改写模式 · 选中文字后说话" |
| `tts` | 🟦 青色 (`teal-400`) | Volume2 | breathing-glow | "朗读中 · Alt+1 停止" |

> 状态优先级：`error` > `tts` > `rewrite` > 按 `appStatus` 映射。详见 [STATE_MACHINE.md](STATE_MACHINE.md) 七之二节。

### 8.6 底部 Tab 栏

- 高度：约 56px
- 5 个图标等距分布（Sparkles/BookText/Clock/HelpCircle/另一个）
- 图标尺寸：22x22px
- 激活态：text-accent
- 非激活态：text-fg-secondary
- 点击反馈：active:scale-95

### 8.7 进度条

- 高度：8px
- 圆角：4px (rounded-full)
- 轨道：bg-bg-tertiary
- 填充：bg-accent
- 宽度：通过 inline style 或 w-[X%] 设置

### 8.8 ErrorModal（错误模态对话框）

已有组件 [components/ui/ErrorModal.tsx](../src/components/ui/ErrorModal.tsx)：
- 位置：`fixed inset-0 z-50`（全屏遮罩 + 居中卡片）
- 遮罩：`rgba(0,0,0,0.4)` 半透明黑
- 卡片：`w-[300px] rounded-2xl bg-neutral-900 ring-1 ring-red-500/30 shadow-2xl p-5`
- 强调色：红色系（`red-500/15` 图标背景、`red-400` 图标色）
- 图标：`AlertCircle`（lucide-react）
- 自动消失：5 秒后自动关闭
- 交互：点击遮罩或"知道了"按钮关闭
- 数据源：从 `usePanelStore.errorMessage` 读取，为 `null` 时不渲染

### 8.9 TranslatePopup（翻译结果浮窗）

已有组件 [components/ui/TranslatePopup.tsx](../src/components/ui/TranslatePopup.tsx)：
- 位置：`absolute left-full ml-3 top-0`（悬浮球右侧）
- 宽度：`w-[240px]`
- 圆角：`rounded-xl`
- 背景：`rgba(20, 20, 22, 0.95)` + `backdrop-filter: blur(14px) saturate(180%)`
- 强调色：青色系（`teal-400` 标题/图标）
- 图标：`Languages`（lucide-react）
- 自动消失：8 秒后自动关闭
- 布局：原文（灰色 `neutral-400`）+ 分割线 + 译文（白色 `neutral-100`）
- 动画：`animate-fade-in`
- 数据源：从 `usePanelStore.translateResult` 读取，为 `null` 时不渲染

### 8.10 PreviewPopup（预览弹窗 — 双模式）

已有组件 [windows/panel/PreviewPopup.tsx](../src/windows/panel/PreviewPopup.tsx)：
- 位置：`absolute inset-0 z-20`（面板全屏覆盖）
- 背景：`bg-neutral-900 text-neutral-100`
- 圆角：`rounded-[22px]`（与面板一致）
- **双模式**（由 `PreviewDraft.mode` 决定）：

| 模式 | 强调色 | 标题 | 副标题 | 确认按钮 |
| :--- | :--- | :--- | :--- | :--- |
| `recognition`（默认） | 🟢 绿色 (`green-400`/`green-500`) | "确认语音输入" | "可编辑整理结果，确认后写入当前输入框" | 绿色确认上屏 |
| `rewrite` | 🟣 紫色 (`purple-400`/`purple-500`) | "确认改写结果" | "确认后将替换选中文本" | 紫色确认上屏 |

- 布局：header（标题+关闭）→ 原文只读区（`bg-neutral-800 rounded-xl`）→ ↓ 箭头 → 可编辑 textarea → footer（放弃+确认按钮）
- 快捷键：Ctrl+Enter 确认 / Esc 放弃
- 使用 `cn()` 工具做条件 className（如 `accentText`/`accentBg`/`accentRing`/`accentHover` 按模式切换）
- 确认时传递 `mode` 字段到 `confirmPreview()`

---

## 九、深色/浅色主题切换

### 切换逻辑

在 [PanelWindow.tsx](../src/windows/panel/PanelWindow.tsx) 中，点击主题按钮切换 `<body>` 类：

```ts
// 深色
document.body.classList.add("dark");
document.body.classList.remove("theme-light");

// 浅色
document.body.classList.remove("dark");
document.body.classList.add("theme-light");
```

主题偏好持久化到 `ui.dark` 配置键。

### CSS 主题切换原理

深色模式使用 `.dark` 类选择器覆盖 CSS 变量：

```css
.dark {
  --color-bg-primary: #1C1C1E;
  --color-fg-primary: #F2F2F7;
  /* ... 其他深色值 */
}
```

浅色模式 `.theme-light` 类额外覆盖 Tailwind neutral 色板 utilities，因为面板窗口是透明背景（body 无 bg），Tailwind 默认 neutral 偏深色。

---

## 十、透明窗口处理

Ball 和 Panel 窗口在 Tauri 中配置为 `transparent: true` + `decorations: false`。

在 [App.tsx](../src/App.tsx) 中，路由到 ball/panel 时给 body 添加 `window-transparent` 类：

```css
html:has(body.window-transparent),
body.window-transparent,
body.window-transparent #root {
  background: transparent !important;
}
```

透明窗口的可见卡片外不要留 padding 或外扩 box-shadow，否则 WebView2 透明合成区域容易露出灰色矩形底。浏览器开发预览时，额外添加 `browser-preview-dark` 类显示深色桌面背景（`#0A0A0A`）。

---

## 十一、CSS Tooltip（data-tip）

无需 JS 组件，纯 CSS 实现：

```html
<button data-tip="就绪 · 按住 Right-Alt 说话">
  <!-- 悬浮球内容 -->
</button>
```

Tooltip 样式在 index.css 中通过 `[data-tip]:hover::before/::after` 实现，气泡显示在元素左侧（小球场景），深色模式自动切换为深底白字。

自定义位置可通过 `data-tip-position="top|right|bottom|left"`。

---

## 十二、滚动条

全局统一 6px 宽圆角滚动条：

```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: var(--color-divider); border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }
```

---

## 十三、Kbd 按键样式

```html
<kbd class="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs font-mono">Right-Alt</kbd>
```

样式：背景 bg-bg-tertiary、圆角 rounded、等宽字体、字号 text-xs。

---

## 十四、图标使用

图标库：**lucide-react**（package.json 已声明）。

```tsx
import { Mic, Settings, X, Minus, Sun, Moon } from "lucide-react";

<Mic size={18} strokeWidth={2} />
<X size={16} />
```

图标尺寸规范：
- 底部 Tab 图标：22px
- 顶部栏按钮图标：18px
- 悬浮球麦克风图标：20px
- Toast 图标：16px

---

## 十五、className 合并工具

使用 [lib/cn.ts](../src/lib/cn.ts) 的极简 `cn()` 函数（无 clsx/tailwind-merge 依赖）：

```tsx
import { cn } from "@/lib/cn";

<div className={cn(
  "base-class",
  isActive && "bg-accent text-white",
  className  // 外部传入
)} />
```

> **注意**：`cn` 只是简单的 `filter(Boolean).join(" ")`，不处理 Tailwind 类名冲突。当前项目类名简单，不需要 tailwind-merge。
