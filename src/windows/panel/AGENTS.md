# AGENTS.md — src/windows/panel/ 极简面板窗口

> 380×612 圆角面板，Tauri `panel` 窗口（`#/panel`）。顶部栏 + 内容区（主页 / Tab 页）+ 底部 Tab 栏。

## 目录

```
panel/
├── PanelWindow.tsx        ← 面板主组件（顶部栏 + 主页 + Tab 分发 + 底部栏）
├── PreviewPopup.tsx       ← 双模式预览弹窗（recognition/rewrite）
├── PanelWindow.test.tsx   ← 测试
└── tabs/                  ← 5 个功能 Tab（详见 tabs/AGENTS.md）
    ├── SkillTab.tsx       ← 语音技能 / AI 整理模式
    ├── DictTab.tsx        ← 自定义词典（过滤词）
    ├── HistoryTab.tsx     ← 历史记录
    ├── ServiceTab.tsx     ← 服务配置（ASR/LLM/离线模型）
    └── HelpTab.tsx        ← 帮助与关于
```

## PanelWindow.tsx 结构

- **根部**：`dark` / `theme-light` class 切换（深浅主题），外层 `background: transparent` 且不留 padding，内层 `w-full h-full rounded-[22px]` 卡片；透明窗口避免在卡片外绘制阴影/背景，防止 WebView2 透明区出现灰色矩形底。
- **顶部栏**：状态点（recording 时脉冲）+ 标题 + 4 个 IconBtn（录音/更多/最小化/关闭）+ 主题切换按钮。带 `data-tauri-drag-region`。
- **内容区**：`activeTab === null` 显示 `HomeView`（服务配置行 + 触发键 + 麦克风 + 3 个开关 + 底部提示）；否则 `TabContent` 分发到对应 Tab。
- **底部栏**：4 个 `TabBtn`（skill/dict/history/help）。**注意：`service` 不在底部栏**，通过主页「服务配置」行进入。

## 关键约定

1. **Tab 状态**：`activeTab` 来自 store（`TabKey | null`），`null` 表示主页。点击已激活 Tab 会回到主页（`setActiveTab(null)`）。
2. **Tab 分发**：`TabContent` 的 `switch` 是唯一分发点，**新增 Tab 需在此登记**，并在 [tabs/AGENTS.md](tabs/AGENTS.md) 更新清单。
3. **窗口控制**：`handleMinimize` / `handleClose` 调用 Tauri Window API（`win.hide()` 隐藏面板窗口，不销毁）。浏览器环境 fallback 为 `showToast` 提示。
4. **主题切换**：`toggleDark` 写 store + 持久化 `ui.dark`；视觉 class 在根部（`dark`/`theme-light`），不在 body。
5. **子组件**：`IconBtn`、`TabBtn`、`HomeView`、`TabContent` 是本文件内的局部组件，不导出。若未来复用再抽取到 `components/ui/`。
6. **交互反馈**：所有动作用 `showToast` 反馈（来自 toastStore）。

## 新增 Tab 步骤

1. 在 [tabs/](tabs/) 新建 `XxxTab.tsx`，具名导出 `XxxTab`
2. 在 store 的 `TabKey` 类型加新键（见 [stores/appStore.ts](../../stores/appStore.ts)）
3. 在 `PanelWindow.tsx` 的 `TabContent` switch 中加 `case`，并在底部栏加 `TabBtn`（如需）
4. 更新 [tabs/AGENTS.md](tabs/AGENTS.md) 清单
