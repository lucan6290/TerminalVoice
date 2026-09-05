# AGENTS.md — src/windows/panel/tabs/ 面板功能页

> 面板的 5 个功能 Tab，由 [PanelWindow.tsx](../PanelWindow.tsx) 的 `TabContent` 分发。每个 Tab 是独立组件，具名导出。

## 文件清单

| 文件 | TabKey | 职责 | 状态 |
| :--- | :--- | :--- | :--- |
| [SkillTab.tsx](SkillTab.tsx) | `skill` | AI 整理模式选择 + 免提开关 | ✅ |
| [DictTab.tsx](DictTab.tsx) | `dict` | 自定义词典（过滤词 CRUD，IPC 驱动） | ✅ |
| [HistoryTab.tsx](HistoryTab.tsx) | `history` | 历史记录（搜索/删除/清空/重上屏，IPC 驱动） | ✅ |
| [ServiceTab.tsx](ServiceTab.tsx) | `service` | 服务配置（ASR/LLM/模型，IPC 驱动） | ✅ |
| [HelpTab.tsx](HelpTab.tsx) | `help` | 帮助与关于（快捷键/指南/链接） | ✅ 静态 |

## 通用模式（重要）

每个 Tab 遵循一致的布局骨架：

```tsx
export function XxxTab() {
  const xxx = usePanelStore((s) => s.xxx);        // 状态来自 store
  const setActiveTab = usePanelStore((s) => s.setActiveTab);

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏：返回按钮 + 标题 */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <button onClick={() => setActiveTab(null)} ...>  {/* 返回主页 */}
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">标题</h2>
      </div>
      {/* 内容：flex-1 overflow-y-auto */}
      ...
    </div>
  );
}
```

## 约定

1. **返回主页**：每个 Tab 左上角 `ArrowLeft` 按钮调用 `setActiveTab(null)`。
2. **状态只从 store 读写**：用 `usePanelStore((s) => s.xxx)` 选择器，不定义本地跨组件状态（局部 UI 态如输入框、编辑态用 `useState`）。
3. **写操作走 store action + showToast 反馈**（如增删过滤词、删历史、下载模型）。
4. **标题栏/输入框/卡片样式统一**：`bg-neutral-800 rounded-xl` 卡片、`text-[12px]~[13px]` 文字、`border-white/5` + `focus:border-green-500/40` 输入框、`rounded-lg` 内控件。
5. **列表区**：外层 `flex-1 overflow-y-auto -mx-1 px-1 space-y-*`，需要可选中文本时加 `allow-select`（如 HistoryTab、HelpTab）。
6. **标题栏里放「返回 + 标题 + 可选右侧操作」**（如 HistoryTab 右侧「清空」、DictTab 右侧「N 条生效」）。

## 状态说明

所有 Tab 的增删改通过 store 的异步 action 调用 [lib/commands.ts](../../../lib/commands.ts) 对应 IPC 命令，采用乐观更新 + 失败回滚模式：
- **HistoryTab**：`listHistory` / `searchHistory` / `deleteHistory` / `clearHistory` / `reinjectHistory`
- **DictTab**：`listFilterWords` / `addFilterWord` / `deleteFilterWord` / `toggleFilterWord`
- **ServiceTab**：`listAudioInputDevices` / `listModels` / `downloadModel` / `deleteModel` / `testAsrConnection` + `service.*` 配置持久化
- **HelpTab**：静态内容（版本 v0.2.0，快捷键 Right Alt/Alt+1/Alt+2）
- 浏览器环境下所有命令 catch 静默降级

## 新增 Tab

见 [panel/AGENTS.md](../AGENTS.md) 的「新增 Tab 步骤」。
