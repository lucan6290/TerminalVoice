# TerminalVoice Tray Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows tray residency, tray menu actions, pause toggling, restart, exit cleanup, and single-instance behavior.

**Architecture:** Keep tray construction in one Rust module and route all state changes through the existing `AppRuntime::transition` API. Tauri setup registers plugins and tray handlers, while menu handlers call focused helper functions for show, pause, restart, directory open, website open, and quit.

**Tech Stack:** Tauri v2 tray-icon feature, tauri-plugin-shell 2, tauri-plugin-dialog 2, tauri-plugin-single-instance 2, Rust 1.85.

---

## File Structure

- Modify: `src-tauri/Cargo.toml` to enable `tauri` feature `tray-icon` and add shell, dialog, and single-instance plugins.
- Modify: `src-tauri/tauri.conf.json` to add main window `label`, startup visibility policy, and bundle icons.
- Modify: `src-tauri/capabilities/default.json` to include shell and dialog permissions needed by menu actions.
- Create: `src-tauri/src/tray.rs` for tray icon, menu IDs, menu event handling, left-click show, pause label updates, restart, and quit.
- Modify: `src-tauri/src/lib.rs` to register plugins, call `tray::build_tray`, and handle close-to-tray behavior.
- Modify: `src-tauri/src/state.rs` only if a test exposes a missing lifecycle state transition.

## Required TDD Coverage

- `tray::tests::menu_ids_are_stable`
- `tray::tests::pause_label_matches_runtime_state`
- `tray::tests::restart_command_uses_current_exe`
- `state::tests::toggle_pause_from_preview_returns_to_idle_when_resumed`

## Manual Verification

- Start with `pnpm tauri dev` and confirm a tray icon appears.
- Left-click the tray icon and confirm the main window shows and focuses.
- Right-click the tray icon and confirm menu items are visible: 显示窗口, 暂停应用, 重启应用, 打开目录, 打开官方网站, 退出应用.
- Toggle pause and confirm the runtime status becomes `Paused`, then toggle again and confirm it becomes `Idle`.
- Close the main window and confirm the process remains alive if close behavior is minimize-to-tray.
- Click exit and confirm the process terminates.

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

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/src/tray.rs src-tauri/src/lib.rs src-tauri/src/state.rs
git commit -m "feat: 添加系统托盘与生命周期"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
