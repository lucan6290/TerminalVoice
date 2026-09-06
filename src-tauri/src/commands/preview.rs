use crate::services::db::{Database, HistoryItem, NewHistoryItem};
use crate::services::preprocess::{process_text, PreprocessConfig, TextMode as BackendTextMode};
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tracing::{error, info};

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum PreviewMode {
    #[default]
    Recognition,
    Rewrite,
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
    #[serde(rename = "durationMs", skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    #[serde(rename = "llmRewritten", skip_serializing_if = "Option::is_none")]
    pub llm_rewritten: Option<bool>,
    #[serde(rename = "skillId", skip_serializing_if = "Option::is_none")]
    pub skill_id: Option<String>,
    pub mode: PreviewMode,
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
    #[serde(rename = "durationMs", default)]
    pub duration_ms: Option<i64>,
    #[serde(rename = "llmRewritten", default)]
    pub llm_rewritten: Option<bool>,
    #[serde(rename = "skillId", default)]
    pub skill_id: Option<String>,
    #[serde(default)]
    pub mode: PreviewMode,
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
    info!("创建 mock 预览，原始文本长度: {} 字符", raw_text.len());
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
        duration_ms: None,
        llm_rewritten: None,
        skill_id: None,
        mode: PreviewMode::Recognition,
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
        error!("确认预览失败：预览文本为空");
        return Err("预览文本不能为空".to_string());
    }
    {
        let runtime = runtime.lock().map_err(|error| error.to_string())?;
        if !matches!(runtime.state(), RuntimeState::Preview) {
            error!("确认预览失败：当前状态 {:?} 不是 Preview", runtime.state());
            return Err(format!("当前状态 {:?} 无法确认预览", runtime.state()));
        }
    }

    // 先隐藏 panel 窗口，让出焦点给目标应用，再注入文本
    hide_panel_window(&app);
    inject_text_and_save_history(&app, &db, &input.into())?;

    {
        let mut runtime = runtime.lock().map_err(|error| error.to_string())?;
        let state = runtime
            .transition(RuntimeEvent::ConfirmedPreview)
            .map_err(|error| format!("invalid state transition: {error:?}"))?;
        emit_runtime_state(&app, &state)?;
    }
    app.emit("preview-cleared", ())
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// 从面板/球窗口隐藏 panel，确保焦点回到用户之前的目标窗口。
/// 失败不阻断主流程（注入仍会继续）。
fn hide_panel_window(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.hide();
    }
    // 额外等待，确保焦点切换完成（panel hide → Windows 切回上一个前台窗口）
    crate::services::app_context::yield_focus();
}

/// 注入+保存历史的共享逻辑，被 confirm_preview（预览确认）和 pipeline 直注（skipPreview）复用。
pub(crate) fn inject_text_and_save_history(
    app: &AppHandle,
    db: &Mutex<Database>,
    record: &InjectRecord,
) -> Result<(), String> {
    info!("开始注入文本，长度: {} 字符", record.final_text.len());

    crate::services::app_context::yield_focus();
    crate::services::injector::inject_text(&record.final_text).map_err(|error| {
        error!("文本注入失败: {error}");
        format!("文本注入失败: {error}")
    })?;

    crate::services::app_context::yield_after_inject();
    let app_context = crate::services::app_context::get_foreground_app_context();

    let history_result: Result<HistoryItem, String> = {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.insert_history(NewHistoryItem {
            source_text: record.source_text.clone(),
            final_text: record.final_text.clone(),
            text_mode: record.text_mode.as_storage_value().to_string(),
            asr_provider: record.asr_provider.clone(),
            duration_ms: record.duration_ms,
            audio_file_path: None,
            llm_rewritten: record.llm_rewritten.unwrap_or(false),
            skill_id: record.skill_id.clone(),
            app_context,
        })
        .map_err(|error| error.to_string())
    };

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

/// 注入所需数据（从 ConfirmPreviewInput 或 PreviewDraft 转换）。
pub(crate) struct InjectRecord {
    pub source_text: String,
    pub final_text: String,
    pub text_mode: TextMode,
    pub asr_provider: String,
    pub duration_ms: Option<i64>,
    pub llm_rewritten: Option<bool>,
    pub skill_id: Option<String>,
}

impl From<ConfirmPreviewInput> for InjectRecord {
    fn from(input: ConfirmPreviewInput) -> Self {
        Self {
            source_text: input.source_text,
            final_text: input.final_text,
            text_mode: input.text_mode,
            asr_provider: input.asr_provider,
            duration_ms: input.duration_ms,
            llm_rewritten: input.llm_rewritten,
            skill_id: input.skill_id,
        }
    }
}

impl From<&PreviewDraft> for InjectRecord {
    fn from(draft: &PreviewDraft) -> Self {
        Self {
            source_text: draft.source_text.clone(),
            final_text: draft.processed_text.clone(),
            text_mode: draft.text_mode.clone(),
            asr_provider: draft.asr_provider.clone(),
            duration_ms: draft.duration_ms,
            llm_rewritten: draft.llm_rewritten,
            skill_id: draft.skill_id.clone(),
        }
    }
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
    info!("inject_text 命令调用，文本长度: {} 字符", text.len());
    crate::services::injector::inject_text(&text)
}

#[tauri::command]
pub fn test_asr_connection(db: State<'_, Mutex<Database>>) -> Result<bool, String> {
    info!("测试 ASR 连接");
    let db = db.lock().map_err(|error| error.to_string())?;

    let raw_endpoint = db
        .get_config("service.asrEndpoint")
        .map_err(|error| {
            error!("获取 ASR Endpoint 配置失败: {error}");
            error.to_string()
        })?
        .ok_or_else(|| {
            error!("ASR Endpoint 未配置");
            "ASR Endpoint 未配置".to_string()
        })?;

    let full_url = db
        .get_config("service.asrFullUrl")
        .ok()
        .flatten()
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let endpoint = if full_url {
        raw_endpoint.trim().to_string()
    } else {
        crate::services::pipeline::resolve_endpoint(
            &raw_endpoint,
            crate::services::pipeline::ASR_PATH,
            crate::services::pipeline::DEFAULT_ASR_BASE,
        )
    };

    if endpoint.trim().is_empty() {
        error!("ASR Endpoint 为空");
        return Err("ASR Endpoint 未配置".to_string());
    }

    let stored_key = db
        .get_config("service.asrApiKey")
        .map_err(|error| error.to_string())?
        .unwrap_or_default();
    let api_key =
        crate::services::secrets::decode_config_value("service.asrApiKey", &stored_key)
            .map_err(|error| {
                error!("解码 ASR API Key 失败: {error}");
                error
            })?;
    if api_key.is_empty() {
        error!("ASR API Key 未配置");
        return Err("ASR API Key 未配置".to_string());
    }

    let headers = format!("Authorization: Bearer {api_key}\r\n");
    let body = Vec::new();

    match crate::services::asr_cloud::post_bytes(&endpoint, &headers, &body) {
        Ok(_) => {
            info!("ASR 连接测试成功，端点: {endpoint}");
            Ok(true)
        }
        Err(error) if error.retryable => {
            info!("ASR 连接测试失败（可重试），端点: {endpoint}，原因: {}", error.message);
            Ok(false)
        }
        Err(error) => {
            error!("ASR 连接测试失败（不可重试），端点: {endpoint}，原因: {}", error.message);
            Err(error.message)
        }
    }
}

#[tauri::command]
pub fn test_llm_connection(db: State<'_, Mutex<Database>>) -> Result<bool, String> {
    info!("测试 LLM 连接");
    let db = db.lock().map_err(|error| error.to_string())?;

    let raw_endpoint = db
        .get_config("service.llmEndpoint")
        .map_err(|error| {
            error!("获取 LLM Endpoint 配置失败: {error}");
            error.to_string()
        })?
        .ok_or_else(|| {
            error!("LLM Endpoint 未配置");
            "LLM Endpoint 未配置".to_string()
        })?;

    let full_url = db
        .get_config("service.llmFullUrl")
        .ok()
        .flatten()
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let endpoint = if full_url {
        raw_endpoint.trim().to_string()
    } else {
        crate::services::pipeline::resolve_endpoint(
            &raw_endpoint,
            crate::services::pipeline::LLM_PATH,
            crate::services::pipeline::DEFAULT_LLM_BASE,
        )
    };

    if endpoint.trim().is_empty() {
        error!("LLM Endpoint 为空");
        return Err("LLM Endpoint 未配置".to_string());
    }

    let model = db
        .get_config("service.llmModel")
        .map_err(|error| error.to_string())?
        .unwrap_or_default();
    if model.trim().is_empty() {
        error!("LLM Model 未配置");
        return Err("LLM Model 未配置".to_string());
    }

    let stored_key = db
        .get_config("service.llmApiKey")
        .map_err(|error| error.to_string())?
        .unwrap_or_default();
    let api_key =
        crate::services::secrets::decode_config_value("service.llmApiKey", &stored_key)
            .map_err(|error| {
                error!("解码 LLM API Key 失败: {error}");
                error
            })?;
    if api_key.is_empty() {
        error!("LLM API Key 未配置");
        return Err("LLM API Key 未配置".to_string());
    }

    // 构造最小 chat completions 请求（单条短消息，max_tokens=1），验证 endpoint + key + model 都正确
    #[derive(serde::Serialize)]
    struct PingMessage<'a> {
        role: &'static str,
        content: &'a str,
    }
    #[derive(serde::Serialize)]
    struct PingRequest<'a> {
        model: &'a str,
        messages: [PingMessage<'a>; 1],
        max_tokens: u32,
        temperature: f32,
    }
    let body = serde_json::to_vec(&PingRequest {
        model: model.trim(),
        messages: [PingMessage { role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0.0,
    })
    .map_err(|error| format!("构建 LLM 请求失败: {error}"))?;

    let headers = format!(
        "Authorization: Bearer {api_key}\r\nContent-Type: application/json\r\n"
    );

    match crate::services::asr_cloud::post_bytes_with_label(&endpoint, &headers, &body, "LLM") {
        Ok(_) => {
            info!("LLM 连接测试成功，端点: {endpoint}, 模型: {model}");
            Ok(true)
        }
        Err(error) if error.retryable => {
            info!("LLM 连接测试失败（可重试），端点: {endpoint}，原因: {}", error.message);
            Ok(false)
        }
        Err(error) => {
            error!("LLM 连接测试失败（不可重试），端点: {endpoint}，原因: {}", error.message);
            Err(error.message)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchedModel {
    pub id: String,
    #[serde(rename = "ownedBy", default)]
    pub owned_by: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    #[serde(default)]
    data: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
    #[serde(default)]
    owned_by: Option<String>,
}

fn fetch_models_common(
    db: &std::sync::MutexGuard<'_, Database>,
    endpoint_key: &str,
    full_url_key: &str,
    api_key_key: &str,
    service_path: &str,
    default_base: &str,
    service_label: &str,
) -> Result<Vec<FetchedModel>, String> {
    let raw_endpoint = db
        .get_config(endpoint_key)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("{service_label} API URL 未配置"))?;

    let full_url = db
        .get_config(full_url_key)
        .ok()
        .flatten()
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let models_url = crate::services::pipeline::resolve_models_endpoint(
        &raw_endpoint, full_url, default_base,
    );

    // 如果 full_url=false，也尝试推导：用户可能填了完整路径（兼容旧配置）
    let models_url = if !full_url && raw_endpoint.trim().ends_with(service_path) {
        // 旧配置填的是完整路径，截断到 base 再拼 /models
        let trimmed = raw_endpoint.trim().trim_end_matches('/');
        match trimmed.rfind('/') {
            Some(pos) if pos > 8 => format!("{}/models", &trimmed[..pos]),
            _ => models_url,
        }
    } else {
        models_url
    };

    let stored_key = db
        .get_config(api_key_key)
        .map_err(|error| error.to_string())?
        .unwrap_or_default();
    let api_key = crate::services::secrets::decode_config_value(api_key_key, &stored_key)
        .map_err(|error| format!("解码 {service_label} API Key 失败: {error}"))?;

    if api_key.is_empty() {
        return Err(format!("{service_label} API Key 未配置"));
    }

    let headers = format!("Authorization: Bearer {api_key}\r\n");

    info!("{service_label} 获取模型列表，端点: {models_url}");
    let response = crate::services::asr_cloud::get_bytes(&models_url, &headers)
        .map_err(|error| format!("获取{service_label}模型列表失败: {}", error.message))?;

    if !(200..300).contains(&response.status) {
        let body = String::from_utf8_lossy(&response.body);
        let body: String = body.chars().take(512).collect();
        let detail = if body.trim().is_empty() {
            response.status.to_string()
        } else {
            format!("{}: {body}", response.status)
        };
        return Err(format!("{service_label} 模型列表请求失败: {detail}"));
    }

    let parsed: ModelsResponse = serde_json::from_slice(&response.body)
        .map_err(|error| format!("{service_label} 模型列表响应格式无效: {error}"))?;

    let mut models: Vec<FetchedModel> = parsed
        .data
        .into_iter()
        .map(|entry| FetchedModel {
            id: entry.id,
            owned_by: entry.owned_by,
        })
        .collect();
    models.sort_by(|a, b| a.id.to_lowercase().cmp(&b.id.to_lowercase()));

    info!("{service_label} 获取到 {} 个模型", models.len());
    Ok(models)
}

#[tauri::command]
pub fn fetch_asr_models(db: State<'_, Mutex<Database>>) -> Result<Vec<FetchedModel>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    fetch_models_common(
        &db,
        "service.asrEndpoint",
        "service.asrFullUrl",
        "service.asrApiKey",
        crate::services::pipeline::ASR_PATH,
        crate::services::pipeline::DEFAULT_ASR_BASE,
        "ASR",
    )
}

#[tauri::command]
pub fn fetch_llm_models(db: State<'_, Mutex<Database>>) -> Result<Vec<FetchedModel>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    fetch_models_common(
        &db,
        "service.llmEndpoint",
        "service.llmFullUrl",
        "service.llmApiKey",
        crate::services::pipeline::LLM_PATH,
        crate::services::pipeline::DEFAULT_LLM_BASE,
        "LLM",
    )
}
