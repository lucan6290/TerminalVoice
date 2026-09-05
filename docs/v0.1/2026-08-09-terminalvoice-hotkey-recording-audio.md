# TerminalVoice Hotkey Recording Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement global F8 press/release recording, ESC cancellation, minimum and maximum duration enforcement, microphone device listing, and WAV encoding.

**Architecture:** Keep global shortcut registration in `services::hotkey`, cpal stream ownership in `services::recorder`, audio encoding in `services::audio`, and IPC test utilities in `commands::audio`. Recording lifecycle writes only through the existing runtime state machine and hands WAV bytes to later ASR work.

**Tech Stack:** tauri-plugin-global-shortcut 2, cpal 0.18, hound 3.5, tokio 1, Rust 1.85, Tauri v2.

---

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

## Required TDD Coverage

- `services::audio::tests::encodes_valid_wav_header`
- `services::audio::tests::clamps_float_samples_to_i16_range`
- `services::recorder::tests::rejects_release_under_minimum_duration`
- `services::recorder::tests::accepts_release_at_minimum_duration`
- `services::hotkey::tests::paused_runtime_ignores_hotkey_pressed`
- `commands::audio::tests::test_recording_rejects_zero_seconds`

## Manual Verification

- Start `pnpm tauri dev`.
- Press and hold F8 for more than 0.5 seconds and confirm status becomes `Recording`.
- Release F8 and confirm status becomes `Recognizing` or the mock downstream handoff state configured by this plan.
- Tap F8 for less than 0.5 seconds and confirm it returns to `Idle` without a preview.
- Press ESC during recording and confirm status returns to `Idle`.
- Record for the configured maximum duration and confirm recording stops automatically.
- Open settings or command test path and confirm microphone devices are listed.

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

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/capabilities/default.json src-tauri/src/services/hotkey.rs src-tauri/src/services/recorder.rs src-tauri/src/services/audio.rs src-tauri/src/commands/audio.rs src-tauri/src/services/mod.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: 实现F8热键录音、ESC取消与WAV编码"
```

---

## Implementation Checklist

- [ ] **Step 1: Add dependencies and permissions**

  Add `tauri-plugin-global-shortcut`, `cpal`, `hound`, and `tokio` to `src-tauri/Cargo.toml`. Add global-shortcut permissions to `src-tauri/capabilities/default.json`.

- [ ] **Step 2: Implement `services::audio` (TDD)**

  Write `services::audio::tests::encodes_valid_wav_header` first. Implement float-sample normalization and 16-bit PCM WAV encoding in `src-tauri/src/services/audio.rs`. Write `services::audio::tests::clamps_float_samples_to_i16_range` and make it pass. Export from `services/mod.rs`.

- [ ] **Step 3: Implement `services::hotkey` (TDD)**

  Write `services::hotkey::tests::paused_runtime_ignores_hotkey_pressed` first. Implement F8 and ESC registration via tauri-plugin-global-shortcut in `src-tauri/src/services/hotkey.rs`. Export from `services/mod.rs`.

- [ ] **Step 4: Implement `services::recorder` (TDD)**

  Write `services::recorder::tests::rejects_release_under_minimum_duration` and `services::recorder::tests::accepts_release_at_minimum_duration` first. Implement cpal device discovery, stream start, stream stop, duration tracking, and error callback handling in `src-tauri/src/services/recorder.rs`. Export from `services/mod.rs`.

- [ ] **Step 5: Implement `commands::audio` (TDD)**

  Write `commands::audio::tests::test_recording_rejects_zero_seconds` first. Implement `list_audio_devices` and `test_recording` IPC commands in `src-tauri/src/commands/audio.rs`. Export from `commands/mod.rs`.

- [ ] **Step 6: Wire everything in `lib.rs`**

  Register the global-shortcut plugin, manage recorder state in Tauri managed state, wire hotkey callbacks to the runtime state machine, and register all new commands in `src-tauri/src/lib.rs`.

- [ ] **Step 7: Run focused tests**

  ```bash
  cd src-tauri && cargo test services::audio services::recorder services::hotkey commands::audio -- --nocapture
  ```

  Confirm all focused recording tests pass.

- [ ] **Step 8: Run full test suite**

  ```bash
  cd src-tauri && cargo test
  ```

  Confirm no existing tests are broken.

- [ ] **Step 9: Manual verification**

  Run `pnpm tauri dev` and execute each checklist item in the Manual Verification section above on Windows with a microphone.

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
