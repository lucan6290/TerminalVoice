# TerminalVoice Cloud ASR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert recorded WAV audio into recognized text through a configured cloud ASR provider with timeout, one retry for transient failures, error mapping, and cleanup.

**Architecture:** Define an `AsrClient` trait for provider-specific HTTP calls and a provider-agnostic `services::asr` orchestration layer for retries and user-message mapping. The recording subsystem supplies WAV bytes, ASR success enters preprocessing and preview, and ASR failure emits a tray/UI failure event.

**Tech Stack:** reqwest 0.12, tokio 1, async-trait 0.1, thiserror 2, serde 1, Rust 1.85, Tauri v2.

---

## File Structure

- Modify: `src-tauri/Cargo.toml` to add `reqwest`, `tokio`, `async-trait`, and `thiserror`.
- Create: `src-tauri/src/services/asr_client.rs` for `AsrClient`, provider request config, and provider implementation.
- Create: `src-tauri/src/services/asr.rs` for retry policy, error mapping, and recognition orchestration.
- Create: `src-tauri/src/commands/asr.rs` for `test_asr_connection`.
- Modify: `src-tauri/src/services/mod.rs` to export `asr_client` and `asr`.
- Modify: `src-tauri/src/commands/mod.rs` to export `asr`.
- Modify: `src-tauri/src/lib.rs` to route recorded WAV bytes to ASR and preview creation.
- Modify: `src-tauri/src/commands/preview.rs` so Mock preview remains available for tests but real preview can accept ASR text.

---

## Task 1: Add ASR Dependencies to Cargo.toml

- [ ] **Step 1: Add reqwest, tokio, async-trait, and thiserror**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
async-trait = "0.1"
thiserror = "2"
```

Verify:

```bash
cd src-tauri && cargo check
```

Expected: cargo check succeeds with no new compile errors.

---

## Task 2: Create ASR Client Trait and Provider Implementation

**File:** `src-tauri/src/services/asr_client.rs`

- [ ] **Step 1: Define AsrError enum with thiserror**

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AsrError {
    #[error("network_unreachable")]
    NetworkUnreachable,
    #[error("timeout")]
    Timeout,
    #[error("auth_failed")]
    AuthFailed,
    #[error("quota_exhausted")]
    QuotaExhausted,
    #[error("server_error")]
    ServerError,
    #[error("empty_audio")]
    EmptyAudio,
    #[error("format_error")]
    FormatError,
    #[error("unknown: {0}")]
    Unknown(String),
}
```

- [ ] **Step 2: Define AsrRequestConfig struct**

```rust
pub struct AsrRequestConfig {
    pub api_key: String,
    pub endpoint: Option<String>,
    pub language: String,
    pub timeout_secs: u64,
}
```

- [ ] **Step 3: Define AsrClient trait with async_trait**

```rust
#[async_trait::async_trait]
pub trait AsrClient: Send + Sync {
    async fn transcribe(&self, audio: &[u8], config: &AsrRequestConfig) -> Result<String, AsrError>;
    fn provider_name(&self) -> &'static str;
}
```

- [ ] **Step 4: Implement a concrete provider**

Implement one cloud ASR provider (e.g. Whisper API or Alibaba Cloud NLS) that satisfies the `AsrClient` trait. The implementation sends the WAV audio bytes as an HTTP multipart or JSON request, parses the JSON response, and returns the recognized text or an `AsrError` variant mapped from the HTTP status code.

- [ ] **Step 5: Add provider module tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    // Stub client for testing
    // Verify provider_name returns expected string
    // Verify transcribe maps HTTP 401 to AuthFailed
    // Verify transcribe maps HTTP 429 to QuotaExhausted
    // Verify transcribe maps HTTP 5xx to ServerError
}
```

---

## Task 3: Create ASR Orchestration with Retry Policy and Error Mapping

**File:** `src-tauri/src/services/asr.rs`

- [ ] **Step 1: Implement retry-enabled recognize function**

```rust
use crate::services::asr_client::{AsrClient, AsrError, AsrRequestConfig};

pub async fn recognize(
    client: &dyn AsrClient,
    audio: &[u8],
    config: &AsrRequestConfig,
) -> Result<String, AsrError> {
    match client.transcribe(audio, config).await {
        Ok(text) => Ok(text),
        Err(AsrError::Timeout | AsrError::NetworkUnreachable) => {
            // One retry for transient failures only
            client.transcribe(audio, config).await
        }
        Err(other) => Err(other),
    }
}
```

- [ ] **Step 2: Implement user-facing error message mapping**

```rust
pub fn map_to_user_message(err: &AsrError) -> &'static str {
    match err {
        AsrError::NetworkUnreachable => "网络不可达，请检查网络连接",
        AsrError::Timeout => "语音识别超时，请重试",
        AsrError::AuthFailed => "API 密钥无效",
        AsrError::QuotaExhausted => "API 配额已用完",
        AsrError::ServerError => "语音识别服务异常，请稍后重试",
        AsrError::EmptyAudio => "未检测到有效语音",
        AsrError::FormatError => "音频格式错误",
        AsrError::Unknown(_) => "未知识别错误",
    }
}
```

- [ ] **Step 3: Write orchestration tests**

Requirements:
- `retries_timeout_once`: A mock client that fails with `AsrError::Timeout` on the first call and succeeds on the second call returns the successful text.
- `does_not_retry_auth_failure`: A mock client that fails with `AsrError::AuthFailed` calls `transcribe` exactly once.
- `maps_auth_failure_to_api_key_message`: `map_to_user_message(&AsrError::AuthFailed)` returns `"API 密钥无效"`.
- `maps_empty_audio_to_no_valid_speech_message`: `map_to_user_message(&AsrError::EmptyAudio)` returns `"未检测到有效语音"`.
- `recognize_returns_successful_text`: A mock client that returns `Ok("你好世界".to_string())` passes the text through.

---

## Task 4: Create ASR IPC Command for Connection Testing

**File:** `src-tauri/src/commands/asr.rs`

- [ ] **Step 1: Implement test_asr_connection command**

```rust
use tauri::State;
use std::sync::Mutex;

#[tauri::command]
pub async fn test_asr_connection(
    api_key: String,
    endpoint: Option<String>,
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("API 密钥未配置".to_string());
    }
    // Build a short test audio snippet, call recognize, return success text or mapped error
    // ...
}
```

- [ ] **Step 2: Write command tests**

Requirements:
- `test_connection_requires_configured_key`: Calling `test_asr_connection` with an empty API key string returns `Err("API 密钥未配置")`.
- Mock client verification: With a mock client injected for tests, `test_asr_connection` succeeds when the mock returns a valid text response.

---

## Task 5: Register ASR Modules and Wire Into Application

- [ ] **Step 5.1: Export modules**

Modify `src-tauri/src/services/mod.rs`:

```rust
pub mod asr;
pub mod asr_client;
pub mod db;
pub mod preprocess;
```

Modify `src-tauri/src/commands/mod.rs`:

```rust
pub mod asr;
pub mod history;
pub mod preview;
```

- [ ] **Step 5.2: Register test_asr_connection in lib.rs**

In `src-tauri/src/lib.rs`, add `commands::asr::test_asr_connection` to the `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::preview::get_app_status,
    commands::preview::create_mock_preview,
    commands::preview::confirm_preview,
    commands::history::list_history,
    commands::asr::test_asr_connection,
])
```

- [ ] **Step 5.3: Route WAV bytes to ASR in the recording flow**

In `src-tauri/src/lib.rs`, add logic so that when the recorder produces WAV bytes, the app constructs an `AsrClient` instance, calls `services::asr::recognize`, and either creates a preview (on success) or emits a failure event (on failure). The existing `create_mock_preview` command path must continue to function independently for tests.

- [ ] **Step 5.4: Add real preview path to preview.rs**

In `src-tauri/src/commands/preview.rs`, add a new function so the real ASR flow can construct a `PreviewDraft` without going through the Mock path. This function accepts recognized text, runs preprocessing, transitions the state machine, and returns the draft. The existing `create_mock_preview` command keeps its current signature unchanged for test compatibility.

---

## Required TDD Coverage

- `services::asr::tests::retries_timeout_once`
- `services::asr::tests::does_not_retry_auth_failure`
- `services::asr::tests::maps_auth_failure_to_api_key_message`
- `services::asr::tests::maps_empty_audio_to_no_valid_speech_message`
- `services::asr::tests::recognize_returns_successful_text`
- `commands::asr::tests::test_connection_requires_configured_key`

---

## Manual Verification

- [ ] Configure a valid ASR API key.
- [ ] Record a short Chinese sentence and confirm a preview appears within the expected time.
- [ ] Disable the network and confirm one retry occurs before a user-facing failure message.
- [ ] Configure an invalid key and confirm the message says API 密钥无效.
- [ ] Submit empty audio through a test path and confirm the message says 未检测到有效语音.
- [ ] Confirm temporary audio files are removed after success, failure, and cancellation.

---

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

---

## Commit Gate

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/asr_client.rs src-tauri/src/services/asr.rs src-tauri/src/services/mod.rs src-tauri/src/commands/asr.rs src-tauri/src/commands/mod.rs src-tauri/src/commands/preview.rs src-tauri/src/lib.rs
git commit -m "feat: 添加云端语音识别"
```

---

## Related Plans

- Plan set: `docs/superpowers/plans/2026-08-09-terminalvoice-unimplemented-features-plan-set.md`
- Source spec: `docs/UNIMPLEMENTED_FEATURES.md`
