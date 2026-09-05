use crate::commands::preview::{AppStatus, RuntimeStateChangedPayload};
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub const EVENT_RECORDING_STARTED: &str = "recording-started";
pub const EVENT_RECORDING_STOPPED: &str = "recording-stopped";
pub const EVENT_RECORDING_CANCELLED: &str = "recording-cancelled";
pub const EVENT_RECORDING_TICK: &str = "recording-tick";

pub const EVENT_REWRITE_STARTED: &str = "rewrite-started";
pub const EVENT_REWRITE_RESULT: &str = "rewrite-result";

pub const EVENT_TTS_STARTED: &str = "tts-started";
pub const EVENT_TTS_STOPPED: &str = "tts-stopped";

pub const EVENT_TRANSLATE_RESULT: &str = "translate-result";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToastPayload {
    pub level: &'static str,
    pub message: String,
}

pub fn emit_runtime_state(app: &AppHandle, state: RuntimeState) -> Result<(), String> {
    app.emit(
        "runtime-state-changed",
        RuntimeStateChangedPayload {
            state: AppStatus::from(&state),
        },
    )
    .map_err(|error| error.to_string())
}

pub fn transition_runtime(
    app: &AppHandle,
    runtime: &Mutex<AppRuntime>,
    event: RuntimeEvent,
) -> Result<RuntimeState, String> {
    let state = {
        let mut runtime = runtime.lock().map_err(|error| error.to_string())?;
        runtime
            .transition(event)
            .map_err(|error| format!("invalid state transition: {error:?}"))?
    };
    emit_runtime_state(app, state)?;
    Ok(state)
}

pub fn emit_toast(app: &AppHandle, level: &'static str, message: impl Into<String>) {
    let _ = app.emit(
        "toast",
        ToastPayload {
            level,
            message: message.into(),
        },
    );
}

pub fn emit_recording_started(app: &AppHandle) -> Result<(), String> {
    app.emit(EVENT_RECORDING_STARTED, ())
        .map_err(|error| error.to_string())
}

pub fn emit_recording_stopped(app: &AppHandle) -> Result<(), String> {
    app.emit(EVENT_RECORDING_STOPPED, ())
        .map_err(|error| error.to_string())
}

pub fn emit_recording_cancelled(app: &AppHandle) -> Result<(), String> {
    app.emit(EVENT_RECORDING_CANCELLED, ())
        .map_err(|error| error.to_string())
}

pub fn emit_recording_tick(app: &AppHandle, duration: u64) -> Result<(), String> {
    app.emit(
        EVENT_RECORDING_TICK,
        serde_json::json!({ "duration": duration }),
    )
    .map_err(|error| error.to_string())
}

pub fn emit_rewrite_started(app: &AppHandle) -> Result<(), String> {
    app.emit(EVENT_REWRITE_STARTED, ())
        .map_err(|error| error.to_string())
}

pub fn emit_rewrite_result(
    app: &AppHandle,
    original_text: &str,
    rewritten_text: &str,
) -> Result<(), String> {
    app.emit(
        EVENT_REWRITE_RESULT,
        serde_json::json!({
            "originalText": original_text,
            "rewrittenText": rewritten_text
        }),
    )
    .map_err(|error| error.to_string())
}

pub fn emit_tts_started(app: &AppHandle) -> Result<(), String> {
    app.emit(EVENT_TTS_STARTED, ())
        .map_err(|error| error.to_string())
}

pub fn emit_tts_stopped(app: &AppHandle) -> Result<(), String> {
    app.emit(EVENT_TTS_STOPPED, ())
        .map_err(|error| error.to_string())
}

pub fn emit_translate_result(
    app: &AppHandle,
    original_text: &str,
    translated_text: &str,
) -> Result<(), String> {
    app.emit(
        EVENT_TRANSLATE_RESULT,
        serde_json::json!({
            "originalText": original_text,
            "translatedText": translated_text
        }),
    )
    .map_err(|error| error.to_string())
}
