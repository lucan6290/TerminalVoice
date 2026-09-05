# TerminalVoice Preview Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the target window, show/edit recognized text, confirm with Enter, allow Ctrl+Enter newline, inject text into the target input, and preserve fallback text in the clipboard on failure.

**Architecture:** Keep Windows target capture and injection in `services::injector`, expose IPC through `commands::inject`, and keep React preview behavior independently testable. Confirmation writes history first, then injection attempts to paste via clipboard and keyboard automation, with Unicode typing as fallback where supported.

**Tech Stack:** enigo 0.6, arboard 3, windows-sys 0.61, tauri-plugin-clipboard-manager 2, React 19, Vitest 3, Testing Library 16, Tauri v2.

---

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

## Required TDD Coverage

- `services::injector::tests::maps_missing_target_to_no_target_error`
- `services::injector::tests::clipboard_fallback_keeps_text_available`
- `commands::inject::tests::inject_text_rejects_empty_text`
- `commands::preview::tests::confirm_preview_saves_history_before_injection`
- `src/components/PreviewPopup.test.tsx` confirms Enter submits.
- `src/components/PreviewPopup.test.tsx` confirms Ctrl+Enter does not submit.
- `src/components/PreviewPopup.test.tsx` confirms copy button calls clipboard wrapper.

## Manual Verification

- Open Notepad, place the cursor in an empty document, record text, confirm preview, and verify text appears at the cursor.
- Select existing Notepad text, confirm preview, and verify selected text is replaced.
- Open VS Code editor, confirm preview, and verify text appears in the active editor.
- Close the target window before confirming and verify text remains in the clipboard with a user-facing failure message.
- Press Enter in preview and verify it confirms.
- Press Ctrl+Enter in preview and verify it inserts a newline.
- Press ESC in preview and verify it cancels without history or injection.

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

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/capabilities/default.json src-tauri/src/services/injector.rs src-tauri/src/commands/inject.rs src-tauri/src/services/mod.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/commands/preview.rs src/components/PreviewPopup.tsx src/components/PreviewPopup.test.tsx src/lib/types.ts src/lib/commands.ts
git commit -m "feat: 实现预览上屏与文本注入"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
