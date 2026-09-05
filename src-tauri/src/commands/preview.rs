use crate::services::db::{Database, HistoryItem, NewHistoryItem};
use crate::services::preprocess::{process_text, PreprocessConfig, TextMode as BackendTextMode};
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AppStatus {
    Idle,
    Recording,
    Recognizing,
    Preview,
    Paused,
}

impl From<&RuntimeState> for AppStatus {
    fn from(value: &RuntimeState) -> Self {
        match value {
            RuntimeState::Idle => Self::Idle,
            RuntimeState::Recording => Self::Recording,
            RuntimeState::Recognizing => Self::Recognizing,
            RuntimeState::Preview => Self::Preview,
            RuntimeState::Paused => Self::Paused,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeStateChangedPayload {
    pub state: AppStatus,
}

fn emit_runtime_state(app: &AppHandle, state: &RuntimeState) -> Result<(), String> {
    app.emit(
        "runtime-state-changed",
        RuntimeStateChangedPayload {
            state: AppStatus::from(state),
        },
    )
    .map_err(|error| error.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TextMode {
    Normal,
    Developer,
    Raw,
}

impl TextMode {
    fn as_storage_value(&self) -> &'static str {
        match self {
            Self::Normal => "Normal",
            Self::Developer => "Developer",
            Self::Raw => "Raw",
        }
    }

    fn to_backend_mode(&self) -> BackendTextMode {
        match self {
            Self::Normal => BackendTextMode::Normal,
            Self::Developer => BackendTextMode::Developer,
            Self::Raw => BackendTextMode::Raw,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PreviewDraft {
    #[serde(rename = "sourceText")]
    pub source_text: String,
    #[serde(rename = "processedText")]
    pub processed_text: String,
    #[serde(rename = "textMode")]
    pub text_mode: TextMode,
    #[serde(rename = "asrProvider")]
    pub asr_provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfirmPreviewInput {
    #[serde(rename = "sourceText")]
    pub source_text: String,
    #[serde(rename = "finalText")]
    pub final_text: String,
    #[serde(rename = "textMode")]
    pub text_mode: TextMode,
    #[serde(rename = "asrProvider")]
    pub asr_provider: String,
}

#[tauri::command]
pub fn get_app_status(runtime: State<'_, Mutex<AppRuntime>>) -> Result<AppStatus, String> {
    let runtime = runtime.lock().map_err(|error| error.to_string())?;
    Ok(AppStatus::from(runtime.state()))
}

#[tauri::command]
pub fn create_mock_preview(
    raw_text: String,
    runtime: State<'_, Mutex<AppRuntime>>,
    app: AppHandle,
) -> Result<PreviewDraft, String> {
    let mut runtime = runtime.lock().map_err(|error| error.to_string())?;

    if !matches!(runtime.state(), RuntimeState::Idle) {
        return Err(format!(
            "cannot start mock preview from state {:?}",
            runtime.state()
        ));
    }

    let state = runtime
        .transition(RuntimeEvent::HotkeyPressed)
        .map_err(|error| format!("invalid state transition: {error:?}"))?;
    emit_runtime_state(&app, &state)?;

    let state = runtime
        .transition(RuntimeEvent::HotkeyReleasedWithValidAudio)
        .map_err(|error| format!("invalid state transition: {error:?}"))?;
    emit_runtime_state(&app, &state)?;

    let text_mode = TextMode::Normal;
    let config = PreprocessConfig {
        mode: text_mode.to_backend_mode(),
        add_punctuation: true,
        filter_words: true,
        single_line: true,
        custom_filter_words: Vec::new(),
    };
    let processed_text = process_text(&raw_text, &config);

    let state = runtime
        .transition(RuntimeEvent::RecognitionSucceeded)
        .map_err(|error| format!("invalid state transition: {error:?}"))?;
    emit_runtime_state(&app, &state)?;

    Ok(PreviewDraft {
        source_text: raw_text,
        processed_text,
        text_mode,
        asr_provider: "mock".to_string(),
    })
}

#[tauri::command]
pub fn confirm_preview(
    input: ConfirmPreviewInput,
    db: State<'_, Mutex<Database>>,
    runtime: State<'_, Mutex<AppRuntime>>,
    app: AppHandle,
) -> Result<HistoryItem, String> {
    {
        let mut runtime = runtime.lock().map_err(|error| error.to_string())?;
        let state = runtime
            .transition(RuntimeEvent::ConfirmedPreview)
            .map_err(|error| format!("invalid state transition: {error:?}"))?;
        emit_runtime_state(&app, &state)?;
    }

    let db_lock = db.lock().map_err(|error| error.to_string())?;
    db_lock
        .insert_history(NewHistoryItem {
            source_text: input.source_text,
            final_text: input.final_text,
            text_mode: input.text_mode.as_storage_value().to_string(),
            asr_provider: input.asr_provider,
        })
        .map_err(|error| error.to_string())
}
