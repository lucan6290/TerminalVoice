# TerminalVoice Packaging Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Windows NSIS installer and execute the PRD Section 14 acceptance checklist against the implemented app.

**Architecture:** Keep packaging configuration in Tauri config and generated icon assets, avoid adding auto-update for V1.1, and treat acceptance as a repeatable checklist with evidence links to test output and manual results.

**Tech Stack:** Tauri v2 bundler, NSIS, pnpm, Rust 1.85, Windows 10/11.

---

## File Structure

- Modify: `src-tauri/tauri.conf.json` to set `bundle.active`, `bundle.targets`, icon paths, NSIS current-user install mode, and Simplified Chinese language.
- Create: `src-tauri/icons/icon.ico` generated from the approved source icon.
- Create: `src-tauri/icons/32x32.png` generated from the approved source icon.
- Create: `src-tauri/icons/128x128.png` generated from the approved source icon.
- Create: `docs/acceptance/2026-08-09-prd-section-14-checklist.md` to track the 43 PRD acceptance items.

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

## Manual Verification

- Install the NSIS package as a current user.
- Launch TerminalVoice from the Start menu or installed executable.
- Confirm data persists across restart.
- Confirm uninstall removes application files.
- Confirm user data retention or deletion behavior matches the final installer policy.
- Complete every item in `docs/acceptance/2026-08-09-prd-section-14-checklist.md`.

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/tauri.conf.json src-tauri/icons/icon.ico src-tauri/icons/32x32.png src-tauri/icons/128x128.png docs/acceptance/2026-08-09-prd-section-14-checklist.md
git commit -m "feat: add windows nsis packaging and acceptance checklist"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
