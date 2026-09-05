# TerminalVoice Foundation Storage Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the low-risk foundation needed by later subsystems: punctuation policy compatibility, config CRUD, filter-word CRUD, history trimming, DB recovery, and redacted file logging.

**Architecture:** Keep deterministic logic in services and expose only thin Tauri command adapters. Extend existing `Database` methods without changing the existing history signatures, and keep log guards alive through managed Tauri state.

**Tech Stack:** Rust 1.85, rusqlite 0.40, chrono 0.4, tracing 0.1, tracing-subscriber 0.3, tracing-appender 0.2, Tauri v2.

---

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

## Required TDD Coverage

- `services::preprocess::tests::asr_punctuation_flag_preserves_terminal_punctuation`
- `services::preprocess::tests::asr_without_punctuation_adds_terminal_fallback`
- `services::db::tests::sets_and_reads_config_values`
- `services::db::tests::lists_adds_deletes_and_resets_filter_words`
- `services::db::tests::trim_history_keeps_newest_records`
- `services::db::tests::open_with_recovery_rebuilds_corrupt_database`
- `services::logger::tests::redacts_secret_like_text`
- `services::logger::tests::removes_old_log_files`

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

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/preprocess.rs src-tauri/src/services/db.rs src-tauri/src/services/logger.rs src-tauri/src/services/mod.rs src-tauri/src/commands/config.rs src-tauri/src/commands/filter.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add foundation storage and logging"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
