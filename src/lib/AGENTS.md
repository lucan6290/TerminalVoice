# AGENTS.md — src/lib/ 工具层

> 纯 TypeScript 工具层，**不含任何 React 依赖**。是跨层共享的最底层，禁止引用 `stores/`、`windows/`、`components/`。

## 文件清单

| 文件 | 职责 | 关键点 |
| :--- | :--- | :--- |
| [types.ts](types.ts) | 共享类型定义，与 Rust serde 对齐 | 见下方「类型契约」 |
| [commands.ts](commands.ts) | Tauri `invoke` 命令封装 | 24 个命令，薄封装 |
| [events.ts](events.ts) | Tauri 事件名称常量 | 14 个 `EVENT_*` 常量 + `TauriEventName` 联合类型，禁止硬编码事件字符串 |
| [cn.ts](cn.ts) | className 合并工具 | 极简 `filter(Boolean).join(" ")`，无 clsx/tailwind-merge |

## 约定

### 类型契约（types.ts）

- 与后端 `src-tauri/src/commands/*.rs` 和 `services/*.rs` 中的 serde 结构一一对应。
- Rust 端带 `#[serde(rename_all = "camelCase")]` 的，TS 端用 camelCase（如 `PreviewDraft.sourceText`、`asrProvider`）。
- **例外**：`HistoryItem` 的字段是 `snake_case`（`created_at`/`source_text`/`final_text`/`text_mode`/`asr_provider`），因为 `db.rs` 直接序列化未做 rename。**新增字段前先确认 Rust 端实际序列化格式**，不要想当然。
- 枚举用字符串字面量联合类型（`type AppStatus = "Idle" | ...`），与 Rust 枚举 variant 名一致。

### IPC 命令封装（commands.ts）

- 每个命令一个薄封装函数，`camelCase` 函数名 → `snake_case` invoke 名。
- 命令名字符串集中在顶部 `COMMANDS` 常量对象（`as const`），**新增命令先在此登记**。
- 参数通过 `invoke(cmd, { key: value })` 传对象；参数名与 Rust 函数形参名一致（如 `{ rawText }` 对应 Rust 的 `raw_text` 经 Tauri 自动转 camelCase）。
- 返回值用 `invoke<T>(...)` 泛型标注。
- 命令列表见 [docs/IPC_API.md](../../docs/IPC_API.md)。

### 事件常量（events.ts）

- 导出 14 个 `EVENT_*` 常量（如 `EVENT_RUNTIME_STATE_CHANGED`、`EVENT_CONFIG_UPDATED` 等）。
- 导出 `TauriEventName` 联合类型供 TypeScript 类型检查。
- **前端监听事件时必须使用此处常量，禁止硬编码字符串**。

### cn.ts

- 仅做 `filter(Boolean).join(" ")`。**不要**引入 clsx/tailwind-merge——当前类名简单，无冲突处理需求。如未来确有需求，先讨论再改。

## 新增文件规范

- 文件命名：`camelCase.ts`
- 纯函数/纯类型，不引入 React、Zustand、DOM 副作用
- 如果新增工具需要被 `stores` 和 `windows` 共用，放这里
- 新增类型必须同步更新 [docs/IPC_API.md](../docs/IPC_API.md) 的共享类型章节
