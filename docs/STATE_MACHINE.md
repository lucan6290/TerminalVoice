# STATE_MACHINE.md — 应用状态机详解

> **最后更新**：2026-09-06
> 本文档详细描述 TerminalVoice 的核心状态机实现，位于 [src-tauri/src/state.rs](../src-tauri/src/state.rs)。状态机是整个应用的中枢，所有业务流程（录音→识别→预览→上屏）都由它驱动。

---

## 一、核心价值

状态机确保了：
1. **合法操作唯一入口**：所有状态转移通过 `transition()` 方法统一入口，非法转移返回明确错误
2. **事件驱动**：Rust 后端通过 emit `runtime-state-changed` 事件通知前端，前端被动渲染，无需轮询
3. **可测试**：纯 Rust 逻辑，7 个单元测试覆盖所有关键路径
4. **可扩展**：新增状态（如 Reading/Translating）只需在枚举添加变体并扩展 transition match

---

## 二、状态定义（RuntimeState）

```rust
pub enum RuntimeState {
    Idle,         // 空闲，等待热键按下
    Recording,    // 录音中
    Recognizing,  // 语音识别中
    Preview,      // 预览文本等待用户确认
    Paused,       // 全局暂停（热键无反应）
}
```

### 状态与前端视觉映射

| RuntimeState | 前端 AppStatus | 小球视觉态 | 小球颜色 | 小球标签 | 面板状态点 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Idle` | `"Idle"` | `idle` | 🟢 绿色（glow 脉冲） | "就绪 · 按住 Right-Alt 说话" | 绿色静态 |
| `Recording` | `"Recording"` | `recording` | 🔵 蓝色（breathing-glow）+ 🎤 Mic 图标 | "录音中 · 松开上屏" | 绿色 pulse 放大 |
| `Recognizing` | `"Recognizing"` | `thinking` | 🟠 橙色（pulse-dot）+ ⟳ Loader2 旋转 | "识别中…" | 橙色 pulse |
| `Preview` | `"Preview"` | `thinking` | 🟠 橙色（同 Recognizing） | "识别中…" | 橙色 pulse |
| `Paused` | `"Paused"` | `disabled` | ⚪ 灰色（disabled） | "已暂停" | 灰色 |

> **注意**：`Preview` 状态下小球仍显示 `thinking` 视觉，但面板窗口会覆盖 PreviewPopup 全屏编辑视图。此外，前端 store 中还有 3 个独立于 Rust 状态机的标志位（`rewriteMode`/`ttsSpeaking`/`errorMessage`），它们会驱动额外的小球视觉态（见下方第七节）。

---

## 三、事件定义（RuntimeEvent）

```rust
pub enum RuntimeEvent {
    HotkeyPressed,                  // 热键按下（开始录音）
    HotkeyReleasedWithValidAudio,   // 热键松开，录音有效（>0.5s）
    HotkeyReleasedTooShort,         // 热键松开，录音过短（<0.5s，误触）
    RecognitionSucceeded,           // 识别成功，进入预览
    RecognitionFailed,              // 识别失败
    ConfirmedPreview,               // 用户确认预览文本
    Cancelled,                      // 用户取消（ESC）
    TogglePause,                    // 切换暂停/启用
}
```

---

## 四、状态转移规则（transition）

```rust
impl AppRuntime {
    pub fn transition(&mut self, event: RuntimeEvent) -> Result<RuntimeState, StateError>
}
```

### 4.1 合法转移表

| 当前状态 | 事件 | 下一状态 | 说明 |
| :--- | :--- | :--- | :--- |
| `Idle` | `HotkeyPressed` | `Recording` | 开始录音 |
| `Idle` | `TogglePause` | `Paused` | 进入暂停，记住 `paused_from = Idle` |
| `Recording` | `HotkeyReleasedWithValidAudio` | `Recognizing` | 有效录音，开始识别 |
| `Recording` | `HotkeyReleasedTooShort` | `Idle` | 误触，丢弃 |
| `Recording` | `Cancelled` | `Idle` | ESC 取消 |
| `Recording` | `TogglePause` | `Paused` | 暂停，记住 `paused_from = Recording` |
| `Recognizing` | `RecognitionSucceeded` | `Preview` | 识别成功，显示预览 |
| `Recognizing` | `RecognitionFailed` | `Idle` | 识别失败，回到空闲 |
| `Recognizing` | `Cancelled` | `Idle` | 取消识别 |
| `Recognizing` | `TogglePause` | `Paused` | 暂停，记住 `paused_from = Recognizing` |
| `Preview` | `ConfirmedPreview` | `Idle` | 确认上屏，回空闲 |
| `Preview` | `Cancelled` | `Idle` | 放弃预览 |
| `Paused` | `TogglePause` | `*paused_from` | 恢复到暂停前状态 |

### 4.2 非法转移

任何不在上表中的 (state, event) 组合都返回 `Err(StateError::InvalidTransition { from, event })`。例如：
- `Idle + ConfirmedPreview` → 错误（空闲状态下无预览可确认）
- `Preview + HotkeyPressed` → 错误（预览中不能重新录音）
- `Paused + HotkeyPressed` → 错误（暂停态热键无反应，必须先 TogglePause 恢复）
- `Paused + Cancelled` → 错误（暂停态不可取消）

---

## 五、暂停机制详解

暂停是特殊的"栈式"状态，不是普通状态转移：

```rust
pub struct AppRuntime {
    state: RuntimeState,
    paused_from: Option<RuntimeState>,  // 记住暂停前的状态
}
```

### 暂停进入（TogglePause from 非 Paused）
1. 将 `paused_from` 设为 `Some(current_state)`
2. 状态变为 `Paused`
3. **可从任意非 Paused 状态暂停**（Idle/Recording/Recognizing/Preview 均可）

### 暂停恢复（TogglePause from Paused）
1. 状态恢复为 `paused_from.unwrap()`
2. `paused_from` 清空为 `None`

### 示例流程
```
Idle →(TogglePause)→ Paused(paused_from=Idle)
  →(TogglePause)→ Idle

Recording →(TogglePause)→ Paused(paused_from=Recording)
  →(TogglePause)→ Recording（继续录音）

Recording →(HotkeyReleasedWithValidAudio)→ Recognizing
  →(TogglePause)→ Paused(paused_from=Recognizing)
  →(TogglePause)→ Recognizing
  →(RecognitionSucceeded)→ Preview
  →(ConfirmedPreview)→ Idle
```

---

## 六、完整流程图

```
                         HotkeyPressed
    ┌─────────────────────────────────────────────┐
    │                                             ▼
┌───────┐  HotkeyReleasedTooShort   ┌───────────┐
│  Idle │◄───────────────────────────│ Recording │
└───┬───┘      Cancelled (ESC)       └─────┬─────┘
    │                                     │ HotkeyReleasedWithValidAudio
    │                                     ▼
    │                               ┌─────────────┐
    │     RecognitionFailed         │ Recognizing │
    │◄──────────────────────────────┤             │
    │                   Cancelled   └──────┬──────┘
    │                                     │ RecognitionSucceeded
    │                                     ▼
    │                      ┌───────────────────────┐
    │        Cancelled     │        Preview         │
    │◄─────────────────────┤                       │
    │                      └───────────┬───────────┘
    │                                  │ ConfirmedPreview
    └──────────────────────────────────┘ (回 Idle)

    任意非 Paused 状态 ──TogglePause──► Paused ──TogglePause──► 恢复 paused_from
```

---

## 七、前端同步机制

Rust 端在每次有效状态转移后，通过 `emit_runtime_state()` 向所有窗口广播：

```rust
fn emit_runtime_state(app: &AppHandle, state: RuntimeState) {
    let app_status: AppStatus = state.into();
    let _ = app.emit("runtime-state-changed", RuntimeStateChangedPayload { state: app_status });
}
```

前端在 [App.tsx](../src/App.tsx) 的 `useBackendSync()` 中监听此事件：

```ts
await listen<{ state: AppStatus }>("runtime-state-changed", (e) => {
  usePanelStore.getState().setRuntimeStatus(e.payload.state);
});
```

Zustand store 的 `setRuntimeStatus()` 更新 `panel.appStatus`，触发 BallWindow 和 PanelWindow 重新渲染对应视觉状态。

---

## 七之二、前端状态标志（与 Rust 状态机共存）

除了 Rust 端的 5 状态机外，前端 Zustand store 中还有 3 个独立标志位，它们通过 Tauri 事件更新，驱动小球额外的视觉态：

| 标志位 | 类型 | 触发事件 | 小球视觉态 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `rewriteMode` | `boolean` | `rewrite-started`（→true）/ `rewrite-result`（→false） | `rewrite`（🟣 紫色 + Wand2 图标） | AI 改写进行中 |
| `ttsSpeaking` | `boolean` | `tts-started`（→true）/ `tts-stopped`（→false） | `tts`（🟦 青色 + Volume2 图标） | TTS 朗读中 |
| `errorMessage` | `string \| null` | 后端推送错误时设置 | `error`（🔴 红色 + AlertCircle 图标） | 错误状态 |

`computeBallState()` 函数的优先级（从高到低）：
1. `errorMessage` 非空 → `error`
2. `ttsSpeaking` → `tts`
3. `rewriteMode` → `rewrite`
4. 否则按 `appStatus` 映射（Idle/Recording/Recognizing+Preview/Paused）

> **设计决策**：TTS、翻译、改写等功能不新增 Rust 状态机状态，而是通过前端 store 标志位实现，避免状态机过度膨胀。这些标志位与 Rust 状态机正交——例如 `rewriteMode` 可以在 `Recording` 或 `Recognizing` 状态下为 `true`。

---

## 八、AppRuntime 管理

`AppRuntime` 通过 Tauri 的 `manage()` 注入，以 `Mutex<AppRuntime>` 共享：

```rust
// lib.rs setup 中
app.manage(Mutex::new(AppRuntime::default()));
```

在 command 中通过 `tauri::State<Mutex<AppRuntime>>` 提取使用：

```rust
#[tauri::command]
pub fn get_app_status(runtime: tauri::State<Mutex<AppRuntime>>) -> Result<AppStatus, ()> {
    let rt = runtime.lock().map_err(|_| ())?;
    Ok(rt.state().into())
}
```

Default 实现：初始状态为 `Idle`，`paused_from = None`。

---

## 九、测试覆盖

[state.rs](../src-tauri/src/state.rs) 包含 7 个 `#[cfg(test)]` 单元测试：

| 测试 | 验证场景 |
| :--- | :--- |
| `test_normal_flow` | 完整流程：Idle→Recording→Recognizing→Preview→Idle |
| `test_short_recording` | 短录音丢弃：Idle→Recording→(TooShort)→Idle |
| `test_pause_from_idle` | 从 Idle 暂停再恢复 |
| `test_invalid_transition_rejected` | 非法转移（Idle+ConfirmedPreview）返回 Err |
| `test_pause_resume_recording` | 从 Recording 暂停，恢复后继续录音再完成流程 |
| `test_pause_resume_recognizing` | 从 Recognizing 暂停，恢复后识别成功 |
| `test_pause_confirm_rejected` | Paused 状态下 ConfirmedPreview 被拒绝，恢复后可正常完成 |

运行测试：
```bash
cd src-tauri && cargo test state
```

---

## 十、未来扩展（浮球方案规划）

根据 [v0.2/2026-09-05 浮球方案](v0.2/2026-09-05-floating-ball-voice-tool-plan.md)，以下功能原计划新增 Rust 状态，但实际实现中采用了前端 store 标志位方案（见七之二节），**无需扩展 Rust 状态机**：

| 功能 | 原计划状态 | 实际实现 | 说明 |
| :--- | :--- | :--- | :--- |
| TTS 朗读 | `Reading`/`TTSPlaying` | 前端 `ttsSpeaking` 标志 | `tts-started`/`tts-stopped` 事件驱动 |
| 翻译 | `Translating` | 前端 `translateResult` 状态 | `translate-result` 事件驱动，TranslatePopup 组件显示 |
| AI 改写 | `Rewriting` | 前端 `rewriteMode` 标志 | `rewrite-started`/`rewrite-result` 事件驱动 |

> **结论**：当前 Rust 状态机保持 5 状态（Idle/Recording/Recognizing/Preview/Paused），TTS/翻译/改写等扩展功能通过前端 store 标志位与 Tauri 事件实现，与状态机正交。若未来某功能确实需要状态机层面的约束（如阻止并发录音），再考虑新增 Rust 状态。

如确需新增 Rust 状态：
1. 在 `RuntimeState` 枚举添加变体
2. 在 `AppStatus` 枚举添加对应变体 + `From<RuntimeState>` 转换
3. 在 `transition()` match 中添加合法转移规则
4. 更新前端 BallWindow `computeBallState()` 和 `STATE_META`
5. 更新前端 PanelWindow 对应视图
6. 为新转移路径添加单元测试
