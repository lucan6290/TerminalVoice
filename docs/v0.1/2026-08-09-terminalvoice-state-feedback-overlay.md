# TerminalVoice State Feedback Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real-time recording and recognizing feedback through frontend event subscriptions, overlay UI, and failure notification payloads.

**Architecture:** Backend transitions emit strongly typed events, frontend stores the current status in Zustand, and overlay components subscribe to Tauri events without polling. Tray notifications remain behind a backend adapter so future ASR and recorder modules can reuse the same failure pathway.

**Tech Stack:** React 19, Zustand 5, @tauri-apps/api event API, Vitest 3, Testing Library 16, Tauri v2.

---

## File Structure

- Create: `src/hooks/useTauriEvent.ts` for typed event subscription cleanup.
- Create: `src/hooks/useAppState.ts` for Zustand app status, recording seconds, ASR slow flag, and latest failure message.
- Create: `src/components/RecordingOverlay.tsx` for recording and recognizing feedback.
- Modify: `src/components/StatusBadge.tsx` to read state from props or the store consistently.
- Modify: `src/App.tsx` to wire event subscriptions, overlay rendering, and Mock-flow compatibility.
- Modify: `src/lib/types.ts` to add `AsrProgress`, `AsrFailedPayload`, and event-name constants.
- Modify: `src-tauri/src/lib.rs` to emit `state-changed`, `recording-tick`, `asr-progress`, and `asr-failed` from transition helpers.
- Modify: `src-tauri/src/commands/preview.rs` so Mock flow emits the same events as real flow.

---

## Implementation Steps

- [ ] **Step 1: Extend TypeScript type contracts**

Add these types and event-name constants to `src/lib/types.ts`:

1. `AsrProgress` interface with a single boolean field `slow`.
2. `AsrFailedPayload` interface with a single string field `message`.
3. `AppEvent` and `AppEventPayload` discriminated union type mapping event names to their payload shapes:
   - `"state-changed"` payloads `AppStatus`.
   - `"recording-tick"` payloads `number` (elapsed seconds).
   - `"asr-progress"` payloads `AsrProgress`.
   - `"asr-failed"` payloads `AsrFailedPayload`.
4. Export a constant `EVENT_NAMES` record literal with stable string keys `STATE_CHANGED`, `RECORDING_TICK`, `ASR_PROGRESS`, `ASR_FAILED` whose values match the Tauri event names used in Rust `app.emit()` calls. This prevents string duplication between hooks and components.

**Verify:** `pnpm build` compiles without type errors in `src/lib/types.ts`.

- [ ] **Step 2: Create the typed Tauri event subscription hook**

Create `src/hooks/useTauriEvent.ts`:

1. Accept a generic type `T` for the event payload and an event name string.
2. Call `listen<T>(eventName, callback)` from `@tauri-apps/api/event` inside a `useEffect`.
3. Return the `unlisten` function from the effect cleanup to prevent leaks when the component unmounts.
4. If the Tauri environment is unavailable (e.g., during unit tests with jsdom), degrade gracefully by returning `undefined` instead of throwing so tests can still mount components that use the hook.

**Verify:** `pnpm build` compiles `src/hooks/useTauriEvent.ts` without errors. The hook does not need its own test file because its behavior is covered by `src/hooks/useAppState.test.ts` and component integration tests.

- [ ] **Step 3: Create the Zustand app state store with unit tests**

Create `src/hooks/useAppState.ts`:

1. Define a Zustand store interface `AppStateStore` with these fields:
   - `status: AppStatus` (default `"Idle"`).
   - `elapsedSeconds: number` (default `0`).
   - `asrSlow: boolean` (default `false`).
   - `failureMessage: string | null` (default `null`).
2. Export action setters: `setStatus(status: AppStatus)`, `setElapsedSeconds(n: number)`, `setAsrSlow(slow: boolean)`, `setFailureMessage(msg: string | null)`.
3. Export a `resetFeedbackState()` action that sets `elapsedSeconds` to `0`, `asrSlow` to `false`, and `failureMessage` to `null` without changing `status`. This is called when the app transitions back to `Idle` so stale recording/ASR feedback is cleared.
4. Create the Zustand store with `create<AppStateStore>()(...)`.

Create `src/hooks/useAppState.test.ts`:

1. **State transitions from event payloads:** Simulate the Zustand store receiving `setStatus("Recording")` and verify `status` is `"Recording"`; call `setStatus("Recognizing")` and verify `status` is `"Recognizing"`; call `resetFeedbackState()` and verify `elapsedSeconds`, `asrSlow`, and `failureMessage` reset to defaults while `status` is unchanged.
2. **Elapsed seconds set and read back:** Call `setElapsedSeconds(12)` and assert `elapsedSeconds` is `12`.
3. **ASR slow flag toggled:** Call `setAsrSlow(true)` and assert `asrSlow` is `true`; call `setAsrSlow(false)` and assert it is `false`.
4. **Failure message set, replaced, and cleared:** Call `setFailureMessage("网络不可达")` and assert `failureMessage` is `"网络不可达"`; call `setFailureMessage(null)` and assert it is `null`.

**Verify:** `pnpm test -- src/hooks/useAppState.test.ts` passes all four test cases.

- [ ] **Step 4: Create the recording overlay component with unit tests**

Create `src/components/RecordingOverlay.tsx`:

1. Import `useAppState` from the Zustand store. Do NOT import `useTauriEvent` directly here -- the event subscriptions are wired in `App.tsx` so the overlay remains a pure display component that is easy to test.
2. Read `status`, `elapsedSeconds`, `asrSlow`, and `failureMessage` from the store.
3. When `status` is `"Recording"`, render the text `倾听中 {elapsedSeconds}` formatted as `倾听中 0:12` (minutes:seconds with zero-padded seconds). Apply `pointer-events: none` so the overlay never steals focus from the target application.
4. When `status` is `"Recognizing"`:
   - If `asrSlow` is `false`, render `识别中…`.
   - If `asrSlow` is `true`, render `识别中…(较慢)`.
5. When `status` is `"Paused"`, render `已暂停`.
6. When `status` is `"Idle"` or `"Preview"`, render nothing (return `null`).
7. If `failureMessage` is non-null, render a brief error indicator next to or below the overlay text so the user sees immediate failure feedback without needing to check the tray.
8. Format elapsed seconds as `M:SS` (e.g., `0:05`, `1:12`). Seconds less than 10 are zero-padded (e.g., `0:03`, not `0:3`).
9. The root element must have `data-testid="recording-overlay"` for test targeting and `role="status"` for accessibility.

Create `src/components/RecordingOverlay.test.tsx`:

1. **Renders `倾听中 0:12` during recording:** Mock the Zustand store to return `status: "Recording"` and `elapsedSeconds: 12`. Render `<RecordingOverlay />` and assert the text `倾听中 0:12` is visible on screen.
2. **Renders `识别中…(较慢)` when ASR slow flag is true:** Mock the store to return `status: "Recognizing"` and `asrSlow: true`. Render the component and assert `识别中…(较慢)` is visible.
3. **Renders nothing when Idle:** Mock the store to return `status: "Idle"` and assert the `data-testid="recording-overlay"` element is not in the document.
4. **Renders failure message when present:** Mock the store to return `status: "Idle"` and `failureMessage: "网络不可达"`. Render the component and assert `网络不可达` is visible on screen. (Idle with a failure message means a recent failure occurred; the overlay still shows the message until `resetFeedbackState()` is called.)

**Verify:** `pnpm test -- src/components/RecordingOverlay.test.tsx` passes all four test cases.

- [ ] **Step 5: Update StatusBadge to read from Zustand store as fallback**

Modify `src/components/StatusBadge.tsx`:

1. Keep the existing `status` prop for backward compatibility so existing callers (`App.tsx`) continue to work without changes.
2. Import `useAppState` and read `status` from the store.
3. When a `status` prop is provided, use it directly (prop takes precedence). When no prop is provided, read from the Zustand store.
4. This allows components that do not pass a prop (future pages or child components) to still display the correct status without prop drilling.

**Verify:** `pnpm build` compiles without errors. The existing `PreviewPopup.test.tsx` continues to pass because `StatusBadge` is not directly referenced in those tests -- `App.tsx` still passes the prop.

- [ ] **Step 6: Add Tauri event emission helpers in the Rust backend**

Modify `src-tauri/src/lib.rs`:

1. Add `use tauri::Emitter;` to the imports.
2. After `app.manage(Mutex::new(AppRuntime::default()));`, wrap the `AppRuntime` in a newtype or a helper struct `AppState` that holds both `AppRuntime` and `AppHandle`. This struct exposes a `transition_and_emit(&mut self, event: RuntimeEvent) -> Result<RuntimeState, StateError>` method that calls `self.runtime.transition(event)`, then emits the appropriate Tauri event based on the new state:
   - On every transition, emit `"state-changed"` with the serialized `AppStatus`.
   - When transitioning to `Recording`, spawn a `tokio::time::interval` that emits `"recording-tick"` with elapsed seconds; store the interval handle so it can be aborted on the next transition away from `Recording`.
   - When transitioning to `Recognizing`, record the start time; after 5 seconds, if still in `Recognizing`, emit `"asr-progress"` with `{ "slow": true }`.
   - When transitioning to `Idle` from `Recognizing` via `RecognitionFailed`, emit `"asr-failed"` with a user-facing message.
3. Manage `AppState` instead of bare `AppRuntime` so all command handlers can transition and emit in one call.
4. Keep the existing `AppRuntime::transition` method unchanged -- the new behavior is additive, layered in `AppState`.

**Verify:** `cd src-tauri && cargo build` compiles without errors. Existing Rust tests (preprocess, db, state) continue to pass.

- [ ] **Step 7: Emit events from Mock flow and add a Rust integration test**

Modify `src-tauri/src/commands/preview.rs`:

1. In `create_mock_preview`, call `state.transition_and_emit()` instead of `runtime.transition()` so the Mock flow emits `"state-changed"`, `"recording-tick"`, `"asr-progress"`, and `"asr-failed"` events matching the real flow.
2. In `confirm_preview`, call `state.transition_and_emit(RuntimeEvent::ConfirmedPreview)` so state transitions are emitted.
3. Keep the existing command signatures and return types unchanged so frontend command wrappers do not need modification.

Add a Rust integration test to `src-tauri/src/commands/preview.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_flow_emits_state_changed_events() {
        // Use a test helper that wraps AppRuntime with an event collector
        // and verifies state-changed events fire for each transition.
    }
}
```

The test creates a test `AppState` backed by an in-memory event collector (a `Vec<String>` or similar), runs the Mock flow transitions, and asserts that every transition call produces exactly one `"state-changed"` event with the correct `AppStatus` payload. This test does not require a real Tauri `AppHandle`.

**Verify:** `cd src-tauri && cargo test commands::preview -- --nocapture` passes the new test and all existing preview tests.

- [ ] **Step 8: Wire event subscriptions and overlay rendering in App.tsx**

Modify `src/App.tsx`:

1. Add `useTauriEvent` imports for all four event types.
2. Add `useAppState` import and destructure the store's setters.
3. Subscribe to `EVENT_NAMES.STATE_CHANGED` and call `setStatus(payload)` on each event.
4. Subscribe to `EVENT_NAMES.RECORDING_TICK` and call `setElapsedSeconds(payload)` on each event.
5. Subscribe to `EVENT_NAMES.ASR_PROGRESS` and call `setAsrSlow(payload.slow)` on each event.
6. Subscribe to `EVENT_NAMES.ASR_FAILED` and call `setFailureMessage(payload.message)` on each event.
7. Render `<RecordingOverlay />` near the top of the component tree so it is always visible regardless of the current tab.
8. In `handleCancel` and after successful `handleConfirm`, call `resetFeedbackState()` from the store so stale recording seconds and failure messages are cleared when returning to `Idle`.
9. Keep the existing `getAppStatus()` polling in `useEffect` as a fallback so the Mock flow still works if Tauri events are not yet connected. The Zustand store's `status` is the single source of truth used by `StatusBadge`; remove the local `useState<AppStatus>` and replace it with the store.
10. Do NOT remove the Mock flow (`startMockFlow`, `createMockPreview`, `confirmPreview`) -- this plan keeps Mock flow working.

Create `src/App.test.tsx`:

1. **Mock preview flow keeps working after store integration:** Mock `createMockPreview` and `confirmPreview` from `src/lib/commands`. Render `<App />`, type text into the mock input, click "生成预览", assert the preview appears, click "确认上屏", and assert the preview closes and history updates.
2. **Idle status renders correctly:** Assert the initial rendered output contains `空闲` from `StatusBadge`.
3. **RecordingOverlay is not rendered at Idle:** Assert the `data-testid="recording-overlay"` element is not in the document when the app starts.

**Verify:** `pnpm test -- src/App.test.tsx` passes all three test cases.

- [ ] **Step 9: Run the full verification suite**

Run all frontend and Rust tests together to confirm no regressions.

**Verify:**
- `pnpm test` passes all frontend tests.
- `cd src-tauri && cargo test commands::preview -- --nocapture` passes the new preview event emission test.
- `cd src-tauri && cargo test` passes the full Rust test suite.

---

## Required TDD Coverage

- `src/hooks/useAppState.test.ts` verifies state transitions from event payloads.
- `src/components/RecordingOverlay.test.tsx` renders `倾听中 0:12` during recording.
- `src/components/RecordingOverlay.test.tsx` renders `识别中…(较慢)` when ASR slow flag is true.
- `src/App.test.tsx` keeps Mock preview flow working after store integration.
- Rust test `commands::preview::tests::mock_flow_emits_state_changed_events` verifies event emission through a test emitter abstraction.

## Verification

Run:

```bash
pnpm test
```

Expected: all frontend tests pass.

Run:

```bash
cd src-tauri && cargo test commands::preview -- --nocapture
```

Expected: preview event emission tests pass.

## Manual Verification

- Start `pnpm tauri dev` and confirm the UI renders with the `空闲` status badge.
- Click "生成预览" and confirm the status badge updates to `识别中` then `预览中` as the Mock flow progresses.
- Confirm the `RecordingOverlay` component does not render visually during `Idle` or `Preview` states.
- After confirming a preview, confirm the status returns to `空闲`.

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src/hooks/useTauriEvent.ts src/hooks/useAppState.ts src/hooks/useAppState.test.ts src/components/RecordingOverlay.tsx src/components/RecordingOverlay.test.tsx src/components/StatusBadge.tsx src/App.tsx src/App.test.tsx src/lib/types.ts src-tauri/src/lib.rs src-tauri/src/commands/preview.rs
git commit -m "feat: 添加状态反馈悬浮提示与事件订阅"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
