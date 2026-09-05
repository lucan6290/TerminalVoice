# TerminalVoice Secure Config DPAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store ASR API keys encrypted with Windows DPAPI and ensure keys are only decrypted in memory for ASR requests.

**Architecture:** Keep Windows-specific cryptography isolated in `services::crypto`, call it from config commands and ASR setup paths, and never log decrypted values. Store ciphertext as base64 in the existing SQLite `config` table.

**Tech Stack:** Rust 1.85, windows-sys 0.61, base64 0.22, rusqlite 0.40, Tauri v2.

---

## File Structure

- Modify: `src-tauri/Cargo.toml` to add `windows-sys` with `Win32_Security_Cryptography` and `base64`.
- Create: `src-tauri/src/services/crypto.rs` for `encrypt`, `decrypt`, `encode_ciphertext`, and `decode_ciphertext`.
- Modify: `src-tauri/src/services/mod.rs` to export `crypto`.
- Modify: `src-tauri/src/commands/config.rs` so `asr_api_key` is encrypted on write and never returned by generic config reads.
- Modify: `src-tauri/src/services/logger.rs` so API-key-like strings are redacted before logging.

## Required TDD Coverage

- `services::crypto::tests::round_trips_unicode_secret`
- `services::crypto::tests::ciphertext_does_not_equal_plaintext`
- `commands::config::tests::stores_api_key_as_ciphertext`
- `commands::config::tests::generic_config_read_masks_api_key`
- `services::logger::tests::redacts_api_key_in_log_message`

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

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/crypto.rs src-tauri/src/services/mod.rs src-tauri/src/commands/config.rs src-tauri/src/services/logger.rs
git commit -m "feat: encrypt asr configuration"
```

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
