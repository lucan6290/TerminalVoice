# TerminalVoice History Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete history management and settings UI: details, copy, reinject, delete, clear, search, ASR settings, recording settings, text settings, hotkey settings, and general settings.

**Architecture:** Keep persistence in `Database`, expose each operation through narrow IPC commands, and let React pages call wrappers from `src/lib/commands.ts`. UI state stays local unless it represents cross-page app runtime state, in which case it uses the Zustand store from the feedback plan.

**Tech Stack:** React 19, TypeScript 5.7, Vitest 3, Testing Library 16, Zustand 5, Tauri v2, rusqlite 0.40, tauri-plugin-autostart 2, tauri-plugin-clipboard-manager 2.

---

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

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/capabilities/default.json src-tauri/src/services/db.rs src-tauri/src/commands/history.rs src-tauri/src/commands/config.rs src-tauri/src/commands/filter.rs src-tauri/src/lib.rs src/lib/types.ts src/lib/commands.ts src/pages/History.tsx src/pages/Settings.tsx src/components/Layout.tsx
git commit -m "feat: complete history management and settings UI"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
