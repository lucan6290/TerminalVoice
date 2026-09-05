use crate::commands::preview::{AppStatus, RuntimeStateChangedPayload};
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

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
