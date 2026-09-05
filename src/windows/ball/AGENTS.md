# AGENTS.md — src/windows/ball/ 悬浮球窗口

> 48×48 毛玻璃悬浮球，Tauri `ball` 窗口（`#/ball`）。常驻置顶，视觉由后端 `AppRuntime` 状态驱动。

## 文件

| 文件 | 职责 |
| :--- | :--- |
| [BallWindow.tsx](BallWindow.tsx) | 悬浮球唯一组件 |

## 状态映射（核心逻辑）

组件内定义了状态计算函数和元数据表，是悬浮球视觉的核心：

1. **`computeBallState()`**：综合 `appStatus`（后端状态）、`rewriteMode`、`ttsSpeaking`、`errorMessage` 计算球的可视状态（7 态）。优先级：`error > tts > rewrite > appStatus 映射`：
   - `errorMessage` 非空 → `error`（红点 + AlertCircle）
   - `ttsSpeaking` → `tts`（紫点 + Volume2）
   - `rewriteMode` → `rewrite`（紫点 + Wand2）
   - `Idle → idle`（绿点 + Mic）
   - `Recording → recording`（蓝麦 + 呼吸光晕）
   - `Recognizing → thinking` / `Preview → thinking`（橙点 + Loader2 脉冲）
   - `Paused → disabled`（灰点）
2. **`STATE_META`**：定义 7 个可视状态的 `core`/`ring` 颜色、`label` 文案、`icon`、是否 `glow`。
3. **`formatDuration()`**：格式化录音时长（`recordingDuration` 秒 → `M:SS`）。

## 交互

- **点击**：`openPanel()` 调用 `Window.getByLabel("panel")` 显示并聚焦面板窗口；浏览器环境静默返回。
- **hover**：显示左侧 tooltip 气泡（黑色半透明），同时按钮 `scale(1.08)`。
- **TranslatePopup**：作为子组件挂载在球右侧，从 store 读取 `translateResult`，非空时显示翻译结果浮层。

## 约定

- 状态只读，来自 `usePanelStore`（`appStatus` + 前端标志 `rewriteMode`/`ttsSpeaking`/`errorMessage`），**悬浮球自身不改变状态**（状态由后端 push，经 App.tsx 同步到 store）。
- 毛玻璃效果用 `backdrop-filter: blur(14px) saturate(180%)`（含 `-webkit-` 前缀）。
- 颜色用 `var(--color-*)` 或 Tailwind（`bg-sky-400`、`bg-amber-400`），遵循设计系统。
- 图标 `lucide-react`：`Mic`/`AlertCircle`/`Loader2`/`Wand2`/`Volume2`，按 `STATE_META` 配置选用。
- 若后端状态机新增状态（见 docs/STATE_MACHINE.md），需同步更新 `computeBallState()` 和 `STATE_META`。
