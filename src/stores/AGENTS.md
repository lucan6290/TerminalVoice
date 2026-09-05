# AGENTS.md — src/stores/ 状态管理层

> 前端状态管理。只依赖 `lib/`（类型 + invoke 封装），不依赖 `windows/`、`components/`。

## 文件清单

| 文件 | 方案 | 职责 |
| :--- | :--- | :--- |
| [appStore.ts](appStore.ts) | **Zustand 5** | 核心业务状态 `usePanelStore`（UI 状态 + 服务配置 + 历史/词典/模型数据 + 全部 actions） |
| [toastStore.ts](toastStore.ts) | **useSyncExternalStore**（非 Zustand） | 轻量 Toast 通知 store |

## appStore.ts（核心）

### 状态结构（PanelState）

- **UI state**：`dark`、`activeTab`、`appStatus`
- **快捷设置**：`pttKey`、`micDevice`、`soundOn`、`muteSys`、`autoStart`
- **服务配置**：`service: ServiceConfig`（ASR/LLM 配置）
- **数据**：`historyItems`、`filterWords`、`models`（ModelInfo[]）、`downloadingModels`（Record<string, number>）、`serviceReady`、`quotaDisplay`
- **前端状态标志**（与 Rust 状态机共存）：`rewriteMode`、`ttsSpeaking`、`translateResult`、`rewriteResult`、`recordingDuration`、`errorMessage`
- **Actions**：切换/设置类 + 历史 CRUD + 词典 CRUD + 模型下载/删除 + `loadAll()`

### 关键约定

1. **配置持久化**：布尔/字符串配置通过内部 `persist(key, value)` 调用 `setConfig` 写入后端；`CONFIG_KEYS` 常量集中定义 15 个键名（6 个 UI/input 键 + 9 个 `service.*` 键）。**新增可持久化配置项时必须先在 `CONFIG_KEYS` 加键，并在 `applyConfigEntry` 中加对应 case**。
2. **配置类型转换**：所有配置值存字符串，读取用 `parseBoolean(value, fallback)` 转布尔。
3. **hydrateFromConfig()**：从后端 `listConfig()` 拉取全部配置并逐条 `applyConfigEntry`；浏览器环境下 catch 静默降级。API Key 变更时后端广播 `"__terminalvoice_secret_updated__"` 占位值，触发此方法重新拉取。
4. **loadAll()**：应用初始化时调用，使用 `Promise.allSettled` 并行拉取全部数据（历史/过滤词/模型/配置/状态），任一失败不影响其他。
5. **不可变更新**：所有 action 用 `set((state) => ...)` 返回新对象，禁止直接改 `state`。
6. **异步 action + 乐观更新**：涉及后端调用的 action 用 async，先乐观更新 UI（如立即删除列表项），失败时回滚（恢复原数据）+ `showToast` 报错。不要抛到 UI。
7. **前端状态标志**：`rewriteMode`/`ttsSpeaking`/`errorMessage` 等标志由 Tauri 事件驱动设置（经 `App.tsx` 的 `useBackendSync()` 同步），与 Rust 状态机的 `appStatus` 共存——TTS/翻译/AI 整理等功能未加入 Rust 状态机，而是通过前端标志实现。
8. **`TabKey` 类型**：从本文件导出（`"skill" | "dict" | "history" | "help" | "service"`），PanelWindow 依赖它做 Tab 分发。

## toastStore.ts

- 用 `useSyncExternalStore` 实现（非 Zustand），向外暴露 `useToasts()` / `showToast()` / `dismissToast()`。
- `showToast(message, level = "info", duration = 3000)`，level 有 info/warn/error/success 四级。
- **保持当前实现**，不要改成 Zustand——它是刻意与核心 store 解耦的轻量通知。

## 新增文件规范

- 命名 `camelCase.ts`
- 若引入新的 Zustand store，与 `usePanelStore` 分离职责（如未来音频/录音状态可独立 store）
- 测试文件与源文件同目录，命名 `*.test.ts`
- 修改 `appStore` 的 state/action 签名后，同步更新 [docs/CODE_MAP.md](../docs/CODE_MAP.md) 中 appStore 描述
