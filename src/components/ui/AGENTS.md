# AGENTS.md — src/components/ui/ 原子组件

> 最基础、可复用的无状态原子组件。这是设计系统的落地层，面板与悬浮球都复用这些组件。

## 文件清单

| 文件 | 职责 | 关键 props |
| :--- | :--- | :--- |
| [ToggleSwitch.tsx](ToggleSwitch.tsx) | 开关（`role="switch"`） | `checked`、`onChange?(checked)` |
| [SettingRow.tsx](SettingRow.tsx) | 三段配置行 | `label`、`helpIcon?`、`helpTip?`、`childrenLeft?`、`childrenRight?`、`className?` |
| [Toast.tsx](Toast.tsx) | Toast 通知容器（`ToastContainer`） | 无 props，从 toastStore 订阅 |
| [ErrorModal.tsx](ErrorModal.tsx) | 错误浮层（阻塞式） | 无 props，从 store 读取 `errorMessage` |
| [TranslatePopup.tsx](TranslatePopup.tsx) | 翻译结果浮层（非阻塞） | 无 props，从 store 读取 `translateResult` |
| [HotkeyRecorder.tsx](HotkeyRecorder.tsx) | 按键录入按钮（快捷键自定义） | `value`、`onChange(next)`、`widthClass?`、`className?`；导出 `formatKeyLabel(key)` |

## 组件规范

### ToggleSwitch

- 默认尺寸 md: 40×22（knob 18px），紧凑 sm: 34×18（knob 14px）
- 绿色开启 / `bg-neutral-600` 关闭
- 用 `role="switch"` + `aria-checked`，保持无障碍
- `onClick` 内部 `e.stopPropagation()`，防止触发外层行点击

### SettingRow

- 三段布局：左侧标签（shrink-0）+ 中间主体（flex-1 min-w-0）+ 右侧控件（shrink-0）
- 支持 `helpIcon` 显示帮助图标（`data-tip` 触发 CSS tooltip）
- `childrenLeft` 放主体控件（input/select），`childrenRight` 放右侧附加（如 ChevronRight）
- 背景 `bg-neutral-800 rounded-xl`，符合设计系统的 card 圆角

### ToastContainer

- 固定顶部居中，`z-[100]`，`pointer-events-none`（子项恢复 pointer-events-auto）
- 从 [toastStore](../../stores/toastStore.ts) 订阅，4 种 level 对应不同图标/颜色
- 动画 `animate-fade-in`

### ErrorModal

- 阻塞式错误浮层：`fixed inset-0 z-50`，`w-[300px]`，红色 accent（`red-500/15`、`red-400`）
- `AlertCircle` + `X` 图标，5 秒自动消失（`setTimeout`）
- 从 `usePanelStore` 读取 `errorMessage`，非空时显示

### TranslatePopup

- 非阻塞翻译结果浮层：`absolute left-full ml-3 top-0`，`w-[240px]`，青色 accent（`teal-400`）
- `Languages` 图标，8 秒自动消失
- 从 `usePanelStore` 读取 `translateResult`，显示原文 + 译文
- 作为 BallWindow 的子组件挂载

### HotkeyRecorder

- 按键录入按钮：默认 `rounded-lg px-3 py-1.5 font-mono text-[13px]`，深色背景（`bg-neutral-900`）配白色文字；捕获态绿色边框 + `animate-pulse`
- 点击进入捕获态后监听 `window.keydown`（capture 阶段），捕获到合法键后调用 `onChange(next)`；Esc 取消录制，blur 自动取消
- 通过私有 `eventToKeyName()` 将 `KeyboardEvent.code`（如 `AltRight`/`Digit1`/`KeyA`/`F6`）映射为后端 `parse_hotkey` 可识别的键名字符串
- 导出 `formatKeyLabel(key)` 将键名转成 UI 友好名（如 `RightAlt`→`Right-Alt`，`LeftCtrl`/`Ctrl`→`Ctrl`）
- 保存中（`onChange` 返回 Promise 期间）显示"保存中..."

## 约定

- **无状态 / 受控优先**：原子组件只接收 props 渲染，不直接读写 store（`ToastContainer` 是唯一例外，它职责就是订阅 toast store）。
- 命名 `PascalCase.tsx`，导出具名组件（当前均用具名导出 `export function`）。
- 样式遵守 [docs/DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md)：圆角用 `rounded-xl`（card 14px）、字号 `text-[13px]`~`text-[14px]`、颜色用 neutral/green token。
- 新增原子组件前，先检查是否已有等价实现，避免重复。
- 新增后更新本文档清单 + [docs/DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md) 组件规范章节。
