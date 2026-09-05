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

pub(crate) fn emit_preview_ready(app: &AppHandle, draft: &PreviewDraft) -> Result<(), String> {
    app.emit("preview-ready", draft)
        .map_err(|error| error.to_string())
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

    let draft = PreviewDraft {
        source_text: raw_text,
        processed_text,
        text_mode,
        asr_provider: "mock".to_string(),
    };
    emit_preview_ready(&app, &draft)?;
    Ok(draft)
}

#[tauri::command]
pub fn confirm_preview(
    input: ConfirmPreviewInput,
    db: State<'_, Mutex<Database>>,
    runtime: State<'_, Mutex<AppRuntime>>,
    app: AppHandle,
) -> Result<(), String> {
    if input.final_text.trim().is_empty() {
        return Err("预览文本不能为空".to_string());
    }
    {
        let runtime = runtime.lock().map_err(|error| error.to_string())?;
        if !matches!(runtime.state(), RuntimeState::Preview) {
            return Err(format!("当前状态 {:?} 无法确认预览", runtime.state()));
        }
    }

    crate::services::injector::inject_text(&input.final_text)
        .map_err(|error| format!("文本注入失败: {error}"))?;

    let history_result: Result<HistoryItem, String> = {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.insert_history(NewHistoryItem {
            source_text: input.source_text,
            final_text: input.final_text,
            text_mode: input.text_mode.as_storage_value().to_string(),
            asr_provider: input.asr_provider,
        })
        .map_err(|error| error.to_string())
    };

    {
        let mut runtime = runtime.lock().map_err(|error| error.to_string())?;
        let state = runtime
            .transition(RuntimeEvent::ConfirmedPreview)
            .map_err(|error| format!("invalid state transition: {error:?}"))?;
        emit_runtime_state(&app, &state)?;
    }
    app.emit("preview-cleared", ())
        .map_err(|error| error.to_string())?;

    if let Err(error) = history_result {
        let _ = app.emit(
            "toast",
            serde_json::json!({
                "level": "warn",
                "message": format!("文字已上屏，但历史记录保存失败: {error}")
            }),
        );
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_preview(
    runtime: State<'_, Mutex<AppRuntime>>,
    app: AppHandle,
) -> Result<(), String> {
    {
        let mut runtime = runtime.lock().map_err(|error| error.to_string())?;
        let state = runtime
            .transition(RuntimeEvent::Cancelled)
            .map_err(|error| format!("invalid state transition: {error:?}"))?;
        emit_runtime_state(&app, &state)?;
    }
    app.emit("preview-cleared", ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn inject_text(text: String) -> Result<(), String> {
    crate::services::injector::inject_text(&text)
}

#[tauri::command]
pub fn test_asr_connection(db: State<'_, Mutex<Database>>) -> Result<bool, String> {
    let db = db.lock().map_err(|error| error.to_string())?;

    let endpoint = db
        .get_config("service.asrEndpoint")
        .map_err(|error| error.to_string())?
        .ok_or("ASR Endpoint 未配置")?;
    if endpoint.is_empty() {
        return Err("ASR Endpoint 未配置".to_string());
    }

    let stored_key = db
        .get_config("service.asrApiKey")
        .map_err(|error| error.to_string())?
        .unwrap_or_default();
    let api_key =
        crate::services::secrets::decode_config_value("service.asrApiKey", &stored_key)?;
    if api_key.is_empty() {
        return Err("ASR API Key 未配置".to_string());
    }

    let headers = format!("Authorization: Bearer {api_key}\r\n");
    let body = Vec::new();

    match crate::services::asr_cloud::post_bytes(&endpoint, &headers, &body) {
        Ok(_) => Ok(true),
        Err(error) if error.retryable => Ok(false),
        Err(error) => Err(error.message),
    }
}
