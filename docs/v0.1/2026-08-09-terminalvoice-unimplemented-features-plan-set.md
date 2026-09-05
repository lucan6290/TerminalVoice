# TerminalVoice Unimplemented Features Plan Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `docs/UNIMPLEMENTED_FEATURES.md` into a sequenced set of independently executable implementation plans, then implement the unfinished TerminalVoice PRD features one subsystem at a time.

**Architecture:** `docs/UNIMPLEMENTED_FEATURES.md` intentionally covers 9 independent subsystems, so this plan does not merge them into one high-risk mega-task. The delivery model is a plan set: each subsystem receives its own TDD implementation plan under `docs/superpowers/plans/`, with dependencies sequenced through stable Rust services, Tauri IPC commands, and React command wrappers.

**Tech Stack:** Rust 1.85, Tauri v2, React 19, TypeScript 5.7, Vite 8, Vitest 3, SQLite via rusqlite 0.40, cpal 0.18, hound 3.5, reqwest 0.12, tokio 1, enigo 0.6, arboard 3, windows-sys 0.61, tracing 0.1, Tauri plugin 2.x family, pnpm.

---

## Scope Check

`docs/UNIMPLEMENTED_FEATURES.md` states that it covers 9 independent subsystems. Implementing all of them in one plan would make tests, review, rollback, and parallel agent ownership unclear. This plan therefore creates a plan set with one implementation plan per subsystem plus one final acceptance plan.

Recommended execution order:

1. Preprocessing punctuation policy, config/filter CRUD, logging, and DB recovery foundation.
2. DPAPI encryption for API keys.
3. Tray lifecycle and state feedback while the app still has Mock input.
4. Hotkey recording and audio encoding.
5. ASR recognition.
6. Preview window and text injection.
7. Full history and settings UI.
8. Packaging and PRD acceptance.

---

## File Structure

Plan files to create:

```text
docs/superpowers/plans/
├── 2026-08-09-terminalvoice-unimplemented-features-plan-set.md
├── 2026-08-09-terminalvoice-foundation-storage-logging.md
├── 2026-08-09-terminalvoice-secure-config-dpapi.md
├── 2026-08-09-terminalvoice-tray-lifecycle.md
├── 2026-08-09-terminalvoice-state-feedback-overlay.md
├── 2026-08-09-terminalvoice-hotkey-recording-audio.md
├── 2026-08-09-terminalvoice-cloud-asr.md
├── 2026-08-09-terminalvoice-preview-injection.md
├── 2026-08-09-terminalvoice-history-settings-ui.md
└── 2026-08-09-terminalvoice-packaging-acceptance.md
```

Existing implementation files that the plan set will touch:

- `src-tauri/Cargo.toml` owns Rust dependency versions and Tauri features.
- `src-tauri/tauri.conf.json` owns window labels, visibility, bundle, tray, and installer configuration.
- `src-tauri/capabilities/default.json` owns Tauri plugin permissions.
- `src-tauri/src/lib.rs` owns plugin registration, app state management, setup wiring, and command registration.
- `src-tauri/src/state.rs` owns runtime transitions and must keep existing `RuntimeState`, `RuntimeEvent`, and `AppRuntime::transition` contracts stable.
- `src-tauri/src/services/preprocess.rs` owns deterministic text preprocessing.
- `src-tauri/src/services/db.rs` owns SQLite schema, history persistence, config storage, filter words, recovery, and trimming.
- `src-tauri/src/services/*.rs` will own new focused backend services for crypto, logger, tray, hotkey, recorder, audio, ASR, and injection.
- `src-tauri/src/commands/*.rs` will own Tauri IPC adapters only.
- `src/lib/types.ts` mirrors Rust command payloads and emitted event payloads.
- `src/lib/commands.ts` wraps Tauri `invoke` calls so React files do not hard-code command names.
- `src/components/*.tsx`, `src/hooks/*.ts`, and `src/pages/*.tsx` own the UI, state subscriptions, overlay, history, and settings.

---

## Task 1: Create Foundation Storage and Logging Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src-tauri/src/services/preprocess.rs`
- Read: `src-tauri/src/services/db.rs`
- Read: `src-tauri/src/lib.rs`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-foundation-storage-logging.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-foundation-storage-logging.md` with this header:

```markdown
# TerminalVoice Foundation Storage Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the low-risk foundation needed by later subsystems: punctuation policy compatibility, config CRUD, filter-word CRUD, history trimming, DB recovery, and redacted file logging.

**Architecture:** Keep deterministic logic in services and expose only thin Tauri command adapters. Extend existing `Database` methods without changing the existing history signatures, and keep log guards alive through managed Tauri state.

**Tech Stack:** Rust 1.85, rusqlite 0.40, chrono 0.4, tracing 0.1, tracing-subscriber 0.3, tracing-appender 0.2, Tauri v2.

---
```

- [ ] **Step 2: Add file map section**

Add this section to the new plan:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to add `tracing`, `tracing-subscriber`, and `tracing-appender`.
- Modify: `src-tauri/src/services/preprocess.rs` to add `asr_provides_punctuation` to `PreprocessConfig` and preserve current default behavior.
- Modify: `src-tauri/src/services/db.rs` to add config CRUD, filter-word CRUD, `open_with_recovery`, `integrity_check`, and `trim_history`.
- Create: `src-tauri/src/services/logger.rs` for daily rolling logs, cleanup, and text redaction helpers.
- Modify: `src-tauri/src/services/mod.rs` to export `logger`.
- Create: `src-tauri/src/commands/config.rs` for config IPC commands.
- Create: `src-tauri/src/commands/filter.rs` for filter-word IPC commands.
- Modify: `src-tauri/src/commands/mod.rs` to export `config` and `filter`.
- Modify: `src-tauri/src/lib.rs` to initialize logger, preserve the logging guard, open DB through recovery, and register new commands.
```

- [ ] **Step 3: Add required TDD tasks**

Add tasks for these exact tests and implementations:

```markdown
## Required TDD Coverage

- `services::preprocess::tests::asr_punctuation_flag_preserves_terminal_punctuation`
- `services::preprocess::tests::asr_without_punctuation_adds_terminal_fallback`
- `services::db::tests::sets_and_reads_config_values`
- `services::db::tests::lists_adds_deletes_and_resets_filter_words`
- `services::db::tests::trim_history_keeps_newest_records`
- `services::db::tests::open_with_recovery_rebuilds_corrupt_database`
- `services::logger::tests::redacts_secret_like_text`
- `services::logger::tests::removes_old_log_files`
```

- [ ] **Step 4: Add verification commands**

Add these commands with expected outcomes:

```markdown
## Verification

Run:

```bash
cd src-tauri && cargo test services::preprocess services::db services::logger -- --nocapture
```

Expected: all focused service tests pass.

Run:

```bash
cd src-tauri && cargo test
```

Expected: the full Rust test suite passes without breaking existing MVP tests.
```

- [ ] **Step 5: Commit only after explicit human authorization**

Add this commit gate:

```markdown
## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/preprocess.rs src-tauri/src/services/db.rs src-tauri/src/services/logger.rs src-tauri/src/services/mod.rs src-tauri/src/commands/config.rs src-tauri/src/commands/filter.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add foundation storage and logging"
```
```

---

## Task 2: Create Secure Config DPAPI Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src-tauri/src/services/db.rs`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-secure-config-dpapi.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-secure-config-dpapi.md` with this header:

```markdown
# TerminalVoice Secure Config DPAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store ASR API keys encrypted with Windows DPAPI and ensure keys are only decrypted in memory for ASR requests.

**Architecture:** Keep Windows-specific cryptography isolated in `services::crypto`, call it from config commands and ASR setup paths, and never log decrypted values. Store ciphertext as base64 in the existing SQLite `config` table.

**Tech Stack:** Rust 1.85, windows-sys 0.61, base64 0.22, rusqlite 0.40, Tauri v2.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to add `windows-sys` with `Win32_Security_Cryptography` and `base64`.
- Create: `src-tauri/src/services/crypto.rs` for `encrypt`, `decrypt`, `encode_ciphertext`, and `decode_ciphertext`.
- Modify: `src-tauri/src/services/mod.rs` to export `crypto`.
- Modify: `src-tauri/src/commands/config.rs` so `asr_api_key` is encrypted on write and never returned by generic config reads.
- Modify: `src-tauri/src/services/logger.rs` so API-key-like strings are redacted before logging.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `services::crypto::tests::round_trips_unicode_secret`
- `services::crypto::tests::ciphertext_does_not_equal_plaintext`
- `commands::config::tests::stores_api_key_as_ciphertext`
- `commands::config::tests::generic_config_read_masks_api_key`
- `services::logger::tests::redacts_api_key_in_log_message`
```

- [ ] **Step 4: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
cd src-tauri && cargo test services::crypto commands::config services::logger -- --nocapture
```

Expected: all secure-config tests pass on Windows.

Run:

```bash
cd src-tauri && cargo test
```

Expected: the full Rust test suite passes.
```

- [ ] **Step 5: Commit only after explicit human authorization**

Add this commit gate:

```markdown
## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/crypto.rs src-tauri/src/services/mod.rs src-tauri/src/commands/config.rs src-tauri/src/services/logger.rs
git commit -m "feat: encrypt asr configuration"
```
```

---

## Task 3: Create Tray Lifecycle Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src-tauri/src/lib.rs`
- Read: `src-tauri/src/state.rs`
- Read: `src-tauri/tauri.conf.json`
- Read: `src-tauri/capabilities/default.json`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-tray-lifecycle.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-tray-lifecycle.md` with this header:

```markdown
# TerminalVoice Tray Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows tray residency, tray menu actions, pause toggling, restart, exit cleanup, and single-instance behavior.

**Architecture:** Keep tray construction in one Rust module and route all state changes through the existing `AppRuntime::transition` API. Tauri setup registers plugins and tray handlers, while menu handlers call focused helper functions for show, pause, restart, directory open, website open, and quit.

**Tech Stack:** Tauri v2 tray-icon feature, tauri-plugin-shell 2, tauri-plugin-dialog 2, tauri-plugin-single-instance 2, Rust 1.85.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to enable `tauri` feature `tray-icon` and add shell, dialog, and single-instance plugins.
- Modify: `src-tauri/tauri.conf.json` to add main window `label`, startup visibility policy, and bundle icons.
- Modify: `src-tauri/capabilities/default.json` to include shell and dialog permissions needed by menu actions.
- Create: `src-tauri/src/tray.rs` for tray icon, menu IDs, menu event handling, left-click show, pause label updates, restart, and quit.
- Modify: `src-tauri/src/lib.rs` to register plugins, call `tray::build_tray`, and handle close-to-tray behavior.
- Modify: `src-tauri/src/state.rs` only if a test exposes a missing lifecycle state transition.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `tray::tests::menu_ids_are_stable`
- `tray::tests::pause_label_matches_runtime_state`
- `tray::tests::restart_command_uses_current_exe`
- `state::tests::toggle_pause_from_preview_returns_to_idle_when_resumed`
```

- [ ] **Step 4: Add manual verification checklist**

Add this checklist:

```markdown
## Manual Verification

- Start with `pnpm tauri dev` and confirm a tray icon appears.
- Left-click the tray icon and confirm the main window shows and focuses.
- Right-click the tray icon and confirm menu items are visible: 显示窗口, 暂停应用, 重启应用, 打开目录, 打开官方网站, 退出应用.
- Toggle pause and confirm the runtime status becomes `Paused`, then toggle again and confirm it becomes `Idle`.
- Close the main window and confirm the process remains alive if close behavior is minimize-to-tray.
- Click exit and confirm the process terminates.
```

- [ ] **Step 5: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
cd src-tauri && cargo test tray state -- --nocapture
```

Expected: tray helper and state tests pass.

Run:

```bash
pnpm tauri dev
```

Expected: the app launches, the tray icon exists, and manual verification passes.
```

---

## Task 4: Create State Feedback Overlay Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src/App.tsx`
- Read: `src/components/StatusBadge.tsx`
- Read: `src-tauri/src/lib.rs`
- Read: `src-tauri/src/commands/preview.rs`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-state-feedback-overlay.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-state-feedback-overlay.md` with this header:

```markdown
# TerminalVoice State Feedback Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real-time recording and recognizing feedback through frontend event subscriptions, overlay UI, and failure notification payloads.

**Architecture:** Backend transitions emit strongly typed events, frontend stores the current status in Zustand, and overlay components subscribe to Tauri events without polling. Tray notifications remain behind a backend adapter so future ASR and recorder modules can reuse the same failure pathway.

**Tech Stack:** React 19, Zustand 5, @tauri-apps/api event API, Vitest 3, Testing Library 16, Tauri v2.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Create: `src/hooks/useTauriEvent.ts` for typed event subscription cleanup.
- Create: `src/hooks/useAppState.ts` for Zustand app status, recording seconds, ASR slow flag, and latest failure message.
- Create: `src/components/RecordingOverlay.tsx` for recording and recognizing feedback.
- Modify: `src/components/StatusBadge.tsx` to read state from props or the store consistently.
- Modify: `src/App.tsx` to wire event subscriptions, overlay rendering, and Mock-flow compatibility.
- Modify: `src/lib/types.ts` to add `AsrProgress`, `AsrFailedPayload`, and event-name constants.
- Modify: `src-tauri/src/lib.rs` to emit `state-changed`, `recording-tick`, `asr-progress`, and `asr-failed` from transition helpers.
- Modify: `src-tauri/src/commands/preview.rs` so Mock flow emits the same events as real flow.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `src/hooks/useAppState.test.ts` verifies state transitions from event payloads.
- `src/components/RecordingOverlay.test.tsx` renders `倾听中 0:12` during recording.
- `src/components/RecordingOverlay.test.tsx` renders `识别中…(较慢)` when ASR slow flag is true.
- `src/App.test.tsx` keeps Mock preview flow working after store integration.
- Rust test `commands::preview::tests::mock_flow_emits_state_changed_events` verifies event emission through a test emitter abstraction.
```

- [ ] **Step 4: Add verification commands**

Add these commands:

```markdown
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
```

---

## Task 5: Create Hotkey Recording Audio Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src-tauri/src/state.rs`
- Read: `src-tauri/src/lib.rs`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-hotkey-recording-audio.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-hotkey-recording-audio.md` with this header:

```markdown
# TerminalVoice Hotkey Recording Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement global F8 press/release recording, ESC cancellation, minimum and maximum duration enforcement, microphone device listing, and WAV encoding.

**Architecture:** Keep global shortcut registration in `services::hotkey`, cpal stream ownership in `services::recorder`, audio encoding in `services::audio`, and IPC test utilities in `commands::audio`. Recording lifecycle writes only through the existing runtime state machine and hands WAV bytes to later ASR work.

**Tech Stack:** tauri-plugin-global-shortcut 2, cpal 0.18, hound 3.5, tokio 1, Rust 1.85, Tauri v2.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to add `tauri-plugin-global-shortcut`, `cpal`, `hound`, and `tokio`.
- Modify: `src-tauri/capabilities/default.json` to allow global-shortcut permissions.
- Create: `src-tauri/src/services/hotkey.rs` for F8 and ESC registration.
- Create: `src-tauri/src/services/recorder.rs` for cpal device discovery, stream start, stream stop, duration tracking, and error callback handling.
- Create: `src-tauri/src/services/audio.rs` for float-sample normalization and 16-bit PCM WAV encoding.
- Create: `src-tauri/src/commands/audio.rs` for `list_audio_devices` and `test_recording`.
- Modify: `src-tauri/src/services/mod.rs` to export `hotkey`, `recorder`, and `audio`.
- Modify: `src-tauri/src/commands/mod.rs` to export `audio`.
- Modify: `src-tauri/src/lib.rs` to register shortcut plugin, manage recorder state, and wire hotkey callbacks.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `services::audio::tests::encodes_valid_wav_header`
- `services::audio::tests::clamps_float_samples_to_i16_range`
- `services::recorder::tests::rejects_release_under_minimum_duration`
- `services::recorder::tests::accepts_release_at_minimum_duration`
- `services::hotkey::tests::paused_runtime_ignores_hotkey_pressed`
- `commands::audio::tests::test_recording_rejects_zero_seconds`
```

- [ ] **Step 4: Add manual verification checklist**

Add this checklist:

```markdown
## Manual Verification

- Start `pnpm tauri dev`.
- Press and hold F8 for more than 0.5 seconds and confirm status becomes `Recording`.
- Release F8 and confirm status becomes `Recognizing` or the mock downstream handoff state configured by this plan.
- Tap F8 for less than 0.5 seconds and confirm it returns to `Idle` without a preview.
- Press ESC during recording and confirm status returns to `Idle`.
- Record for the configured maximum duration and confirm recording stops automatically.
- Open settings or command test path and confirm microphone devices are listed.
```

- [ ] **Step 5: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
cd src-tauri && cargo test services::audio services::recorder services::hotkey commands::audio -- --nocapture
```

Expected: all focused recording tests pass.

Run:

```bash
pnpm tauri dev
```

Expected: manual hotkey and recording verification passes on Windows with a microphone.
```

---

## Task 6: Create Cloud ASR Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src-tauri/src/services/preprocess.rs`
- Read: `src-tauri/src/commands/preview.rs`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-cloud-asr.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-cloud-asr.md` with this header:

```markdown
# TerminalVoice Cloud ASR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert recorded WAV audio into recognized text through a configured cloud ASR provider with timeout, one retry for transient failures, error mapping, and cleanup.

**Architecture:** Define an `AsrClient` trait for provider-specific HTTP calls and a provider-agnostic `services::asr` orchestration layer for retries and user-message mapping. The recording subsystem supplies WAV bytes, ASR success enters preprocessing and preview, and ASR failure emits a tray/UI failure event.

**Tech Stack:** reqwest 0.12, tokio 1, async-trait 0.1, thiserror 2, serde 1, Rust 1.85, Tauri v2.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to add `reqwest`, `tokio`, `async-trait`, and `thiserror`.
- Create: `src-tauri/src/services/asr_client.rs` for `AsrClient`, provider request config, and provider implementation.
- Create: `src-tauri/src/services/asr.rs` for retry policy, error mapping, and recognition orchestration.
- Create: `src-tauri/src/commands/asr.rs` for `test_asr_connection`.
- Modify: `src-tauri/src/services/mod.rs` to export `asr_client` and `asr`.
- Modify: `src-tauri/src/commands/mod.rs` to export `asr`.
- Modify: `src-tauri/src/lib.rs` to route recorded WAV bytes to ASR and preview creation.
- Modify: `src-tauri/src/commands/preview.rs` so Mock preview remains available for tests but real preview can accept ASR text.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `services::asr::tests::retries_timeout_once`
- `services::asr::tests::does_not_retry_auth_failure`
- `services::asr::tests::maps_auth_failure_to_api_key_message`
- `services::asr::tests::maps_empty_audio_to_no_valid_speech_message`
- `services::asr::tests::recognize_returns_successful_text`
- `commands::asr::tests::test_connection_requires_configured_key`
```

- [ ] **Step 4: Add manual verification checklist**

Add this checklist:

```markdown
## Manual Verification

- Configure a valid ASR API key.
- Record a short Chinese sentence and confirm a preview appears within the expected time.
- Disable the network and confirm one retry occurs before a user-facing failure message.
- Configure an invalid key and confirm the message says API 密钥无效.
- Submit empty audio through a test path and confirm the message says 未检测到有效语音.
- Confirm temporary audio files are removed after success, failure, and cancellation.
```

- [ ] **Step 5: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
cd src-tauri && cargo test services::asr commands::asr -- --nocapture
```

Expected: focused ASR tests pass without requiring a real network call.

Run:

```bash
pnpm tauri dev
```

Expected: manual ASR verification passes with a configured provider.
```

---

## Task 7: Create Preview Injection Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src/components/PreviewPopup.tsx`
- Read: `src/components/PreviewPopup.test.tsx`
- Read: `src-tauri/src/commands/preview.rs`
- Read: `src/lib/commands.ts`
- Read: `src/lib/types.ts`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-preview-injection.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-preview-injection.md` with this header:

```markdown
# TerminalVoice Preview Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the target window, show/edit recognized text, confirm with Enter, allow Ctrl+Enter newline, inject text into the target input, and preserve fallback text in the clipboard on failure.

**Architecture:** Keep Windows target capture and injection in `services::injector`, expose IPC through `commands::inject`, and keep React preview behavior independently testable. Confirmation writes history first, then injection attempts to paste via clipboard and keyboard automation, with Unicode typing as fallback where supported.

**Tech Stack:** enigo 0.6, arboard 3, windows-sys 0.61, tauri-plugin-clipboard-manager 2, React 19, Vitest 3, Testing Library 16, Tauri v2.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to add `enigo`, `arboard`, `windows-sys`, and clipboard-manager plugin.
- Modify: `src-tauri/capabilities/default.json` to allow clipboard-manager permissions.
- Create: `src-tauri/src/services/injector.rs` for `TargetWindow`, focus capture, clipboard paste, unicode fallback, and error mapping.
- Create: `src-tauri/src/commands/inject.rs` for `inject_text`.
- Modify: `src-tauri/src/services/mod.rs` to export `injector`.
- Modify: `src-tauri/src/commands/mod.rs` to export `inject`.
- Modify: `src-tauri/src/lib.rs` to manage captured target and register injection commands.
- Modify: `src-tauri/src/commands/preview.rs` so `confirm_preview` writes history, attempts injection, and returns the saved history item.
- Modify: `src/components/PreviewPopup.tsx` to preserve current Enter behavior, explicitly allow Ctrl+Enter newlines, and add a copy button.
- Modify: `src/components/PreviewPopup.test.tsx` to cover copy and keyboard behavior.
- Modify: `src/lib/types.ts` and `src/lib/commands.ts` to add injection types and wrapper.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `services::injector::tests::maps_missing_target_to_no_target_error`
- `services::injector::tests::clipboard_fallback_keeps_text_available`
- `commands::inject::tests::inject_text_rejects_empty_text`
- `commands::preview::tests::confirm_preview_saves_history_before_injection`
- `src/components/PreviewPopup.test.tsx` confirms Enter submits.
- `src/components/PreviewPopup.test.tsx` confirms Ctrl+Enter does not submit.
- `src/components/PreviewPopup.test.tsx` confirms copy button calls clipboard wrapper.
```

- [ ] **Step 4: Add manual verification checklist**

Add this checklist:

```markdown
## Manual Verification

- Open Notepad, place the cursor in an empty document, record text, confirm preview, and verify text appears at the cursor.
- Select existing Notepad text, confirm preview, and verify selected text is replaced.
- Open VS Code editor, confirm preview, and verify text appears in the active editor.
- Close the target window before confirming and verify text remains in the clipboard with a user-facing failure message.
- Press Enter in preview and verify it confirms.
- Press Ctrl+Enter in preview and verify it inserts a newline.
- Press ESC in preview and verify it cancels without history or injection.
```

- [ ] **Step 5: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
pnpm test -- PreviewPopup
```

Expected: preview keyboard and copy tests pass.

Run:

```bash
cd src-tauri && cargo test services::injector commands::inject commands::preview -- --nocapture
```

Expected: focused injection tests pass.
```

---

## Task 8: Create History Settings UI Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `src/pages/History.tsx`
- Read: `src/pages/Settings.tsx`
- Read: `src/lib/commands.ts`
- Read: `src/lib/types.ts`
- Read: `src-tauri/src/services/db.rs`
- Read: `src-tauri/src/commands/history.rs`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-history-settings-ui.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-history-settings-ui.md` with this header:

```markdown
# TerminalVoice History Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete history management and settings UI: details, copy, reinject, delete, clear, search, ASR settings, recording settings, text settings, hotkey settings, and general settings.

**Architecture:** Keep persistence in `Database`, expose each operation through narrow IPC commands, and let React pages call wrappers from `src/lib/commands.ts`. UI state stays local unless it represents cross-page app runtime state, in which case it uses the Zustand store from the feedback plan.

**Tech Stack:** React 19, TypeScript 5.7, Vitest 3, Testing Library 16, Zustand 5, Tauri v2, rusqlite 0.40, tauri-plugin-autostart 2, tauri-plugin-clipboard-manager 2.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/Cargo.toml` to add autostart plugin if it is not already present.
- Modify: `src-tauri/capabilities/default.json` to allow autostart and clipboard permissions.
- Modify: `src-tauri/src/services/db.rs` to add history delete, clear, search, config reads, and filter-word reads used by the UI.
- Modify: `src-tauri/src/commands/history.rs` to add `delete_history`, `clear_history`, `search_history`, and `reinject_history`.
- Modify: `src-tauri/src/commands/config.rs` to add typed reads and writes for settings page sections.
- Modify: `src-tauri/src/commands/filter.rs` to support the filter-word management UI.
- Modify: `src-tauri/src/lib.rs` to register all new commands and autostart plugin.
- Modify: `src/lib/types.ts` to add `AppConfig`, `FilterWord`, `AudioDevice`, and command payload types.
- Modify: `src/lib/commands.ts` to add wrappers for history, config, filter, audio, ASR, and autostart actions.
- Modify: `src/pages/History.tsx` to implement details, copy, reinject, delete, clear, and search.
- Modify: `src/pages/Settings.tsx` to implement five sections from PRD 9.3.
- Create: `src/components/Layout.tsx` if the page layout becomes duplicated across `App.tsx`, `History.tsx`, and `Settings.tsx`.
```

- [ ] **Step 3: Add required tests**

Add these tests to the plan:

```markdown
## Required TDD Coverage

- `services::db::tests::delete_history_removes_one_record`
- `services::db::tests::clear_history_removes_all_records`
- `services::db::tests::search_history_matches_source_and_final_text`
- `commands::history::tests::reinject_history_uses_final_text`
- `src/pages/History.test.tsx` searches and renders matching records.
- `src/pages/History.test.tsx` expands details and copies final text.
- `src/pages/History.test.tsx` deletes one history item after confirmation.
- `src/pages/Settings.test.tsx` renders all five settings sections.
- `src/pages/Settings.test.tsx` saves text preprocessing settings through command wrappers.
- `src/pages/Settings.test.tsx` adds and deletes a filter word.
```

- [ ] **Step 4: Add manual verification checklist**

Add this checklist:

```markdown
## Manual Verification

- History page shows newest records first with formatted time and a 50-character preview.
- History search filters by source text and final text.
- History details reveal source text, final text, text mode, ASR provider, and action buttons.
- Copy writes final text to clipboard.
- Reinject sends final text to the current target input.
- Delete removes one item from UI and DB.
- Clear removes all history after confirmation.
- Settings page shows ASR, recording, text, hotkey, and general sections.
- API key save path stores encrypted data from the secure-config plan.
- Changing hotkey unregisters the previous shortcut and registers the new shortcut.
- Closing the main window follows the configured behavior.
```

- [ ] **Step 5: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
pnpm test -- History Settings
```

Expected: focused frontend page tests pass.

Run:

```bash
cd src-tauri && cargo test services::db commands::history commands::config commands::filter -- --nocapture
```

Expected: focused backend persistence and command tests pass.
```

---

## Task 9: Create Packaging Acceptance Plan

**Files:**
- Read: `docs/UNIMPLEMENTED_FEATURES.md`
- Read: `docs/TerminalVoice_PRD_V1.0.md`
- Read: `src-tauri/tauri.conf.json`
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-packaging-acceptance.md`

- [ ] **Step 1: Write the plan header**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-packaging-acceptance.md` with this header:

```markdown
# TerminalVoice Packaging Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Windows NSIS installer and execute the PRD Section 14 acceptance checklist against the implemented app.

**Architecture:** Keep packaging configuration in Tauri config and generated icon assets, avoid adding auto-update for V1.1, and treat acceptance as a repeatable checklist with evidence links to test output and manual results.

**Tech Stack:** Tauri v2 bundler, NSIS, pnpm, Rust 1.85, Windows 10/11.

---
```

- [ ] **Step 2: Add file map section**

Add this section:

```markdown
## File Structure

- Modify: `src-tauri/tauri.conf.json` to set `bundle.active`, `bundle.targets`, icon paths, NSIS current-user install mode, and Simplified Chinese language.
- Create: `src-tauri/icons/icon.ico` generated from the approved source icon.
- Create: `src-tauri/icons/32x32.png` generated from the approved source icon.
- Create: `src-tauri/icons/128x128.png` generated from the approved source icon.
- Create: `docs/acceptance/2026-08-09-prd-section-14-checklist.md` to track the 43 PRD acceptance items.
```

- [ ] **Step 3: Add acceptance checklist source mapping**

Add this section:

```markdown
## Acceptance Mapping

- PRD 14.1 maps to hotkey and recording acceptance.
- PRD 14.2 maps to cloud ASR acceptance.
- PRD 14.3 maps to preprocessing acceptance.
- PRD 14.4 maps to preview and injection acceptance.
- PRD 14.5 maps to state feedback acceptance.
- PRD 14.6 maps to tray lifecycle acceptance.
- PRD 14.7 maps to history and settings acceptance.
- PRD 14.8 maps to storage, recovery, and logging acceptance.
- PRD 14.9 maps to packaging and non-functional acceptance.
```

- [ ] **Step 4: Add verification commands**

Add these commands:

```markdown
## Verification

Run:

```bash
pnpm build
```

Expected: TypeScript and Vite build successfully.

Run:

```bash
cd src-tauri && cargo test
```

Expected: all Rust tests pass.

Run:

```bash
pnpm tauri build
```

Expected: NSIS installer is created under `src-tauri/target/release/bundle/nsis/`.
```

- [ ] **Step 5: Add manual packaging verification**

Add this checklist:

```markdown
## Manual Verification

- Install the NSIS package as a current user.
- Launch TerminalVoice from the Start menu or installed executable.
- Confirm data persists across restart.
- Confirm uninstall removes application files.
- Confirm user data retention or deletion behavior matches the final installer policy.
- Complete every item in `docs/acceptance/2026-08-09-prd-section-14-checklist.md`.
```

---

## Task 10: Review and Link the Plan Set

**Files:**
- Modify: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Read: every plan created by Tasks 1–9

- [ ] **Step 1: Confirm every subsystem has a dedicated plan**

Check that these files exist:

```bash
dir docs\superpowers\plans\2026-08-09-terminalvoice-foundation-storage-logging.md docs\superpowers\plans\2026-08-09-terminalvoice-secure-config-dpapi.md docs\superpowers\plans\2026-08-09-terminalvoice-tray-lifecycle.md docs\superpowers\plans\2026-08-09-terminalvoice-state-feedback-overlay.md docs\superpowers\plans\2026-08-09-terminalvoice-hotkey-recording-audio.md docs\superpowers\plans\2026-08-09-terminalvoice-cloud-asr.md docs\superpowers\plans\2026-08-09-terminalvoice-preview-injection.md docs\superpowers\plans\2026-08-09-terminalvoice-history-settings-ui.md docs\superpowers\plans\2026-08-09-terminalvoice-packaging-acceptance.md
```

Expected: every listed plan file exists.

- [ ] **Step 2: Confirm no plan contains placeholder language**

Run:

```bash
$patterns = @("T" + "BD", "TO" + "DO", "implement" + " later", "fill" + " in details", "Similar" + " to Task", "Add" + " appropriate", "add" + " validation", "handle" + " edge cases")
Select-String -Path docs\superpowers\plans\2026-08-09-terminalvoice-*.md -Pattern ($patterns -join "|")
```

Expected: no matches.

- [ ] **Step 3: Confirm plan dependencies match the source spec**

Verify this source-to-plan mapping manually:

```markdown
- §3 preprocessing punctuation → foundation storage logging plan
- §4 recording trigger control → hotkey recording audio plan
- §5 cloud ASR → cloud ASR plan
- §6 preview and injection → preview injection plan
- §7 state feedback → state feedback overlay plan
- §8 tray lifecycle → tray lifecycle plan
- §9 main UI and settings → history settings UI plan
- §10 storage enhancement → foundation storage logging plan and history settings UI plan
- §11 security encryption → secure config DPAPI plan
- §12 packaging → packaging acceptance plan
- §14 acceptance → packaging acceptance plan
```

Expected: every source section maps to at least one plan.

- [ ] **Step 4: Add cross-plan links**

Update each created plan with a `Related Plans` section using these links:

```markdown
## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
```

Expected: every subsystem plan points back to the plan set and source spec.

- [ ] **Step 5: Commit only after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md docs/superpowers/plans/2026-08-09-terminalvoice-foundation-storage-logging.md docs/superpowers/plans/2026-08-09-terminalvoice-secure-config-dpapi.md docs/superpowers/plans/2026-08-09-terminalvoice-tray-lifecycle.md docs/superpowers/plans/2026-08-09-terminalvoice-state-feedback-overlay.md docs/superpowers/plans/2026-08-09-terminalvoice-hotkey-recording-audio.md docs/superpowers/plans/2026-08-09-terminalvoice-cloud-asr.md docs/superpowers/plans/2026-08-09-terminalvoice-preview-injection.md docs/superpowers/plans/2026-08-09-terminalvoice-history-settings-ui.md docs/superpowers/plans/2026-08-09-terminalvoice-packaging-acceptance.md
git commit -m "docs: add unimplemented features plan set"
```

---

## Self-Review

**Spec coverage:** This plan maps all sections in `docs/UNIMPLEMENTED_FEATURES.md`: §3, §4, §5, §6, §7, §8, §9, §10, §11, §12, and §14. §2 dependency additions are distributed into the plan that first needs each dependency.

**Placeholder scan:** This plan uses concrete file paths, concrete tests, verification commands, and explicit acceptance checks instead of vague implementation instructions.

**Type consistency:** Existing contracts remain stable: `RuntimeState`, `RuntimeEvent`, `AppRuntime::transition`, `PreviewDraft`, `ConfirmPreviewInput`, `HistoryItem`, `src/lib/types.ts`, and existing IPC names are extended but not renamed.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`.

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per plan file, review between tasks, and keep each subsystem independently testable.

**2. Inline Execution** - Execute the plan set in this session using executing-plans, with checkpoints after each subsystem plan.
