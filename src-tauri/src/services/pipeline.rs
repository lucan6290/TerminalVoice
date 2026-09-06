use crate::commands::preview::{emit_preview_ready, PreviewDraft, TextMode as PreviewTextMode};
use crate::services::asr::{transcribe, AsrMode};
use crate::services::asr_cloud::CloudAsrConfig;
use crate::services::db::Database;
use crate::services::events::{
    emit_llm_streaming_delta, emit_recording_cancelled, emit_recording_started,
    emit_recording_stopped, emit_recording_tick, emit_rewrite_result, emit_rewrite_started,
    emit_toast, emit_translate_result, emit_tts_started, emit_tts_stopped, transition_runtime,
};
use crate::services::hotkey::{spawn_listener, HotkeyEvent};
use crate::services::llm::{LlmClient, LlmConfig, TextProcessMode};
use crate::services::preprocess::{process_text, PreprocessConfig, TextMode};
use crate::services::recorder::Recorder;
use crate::services::rewrite;
use crate::services::secrets::decode_config_value;
use crate::services::skills;
use crate::services::translate;
use crate::services::tts;
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tracing::{debug, error, info, warn};
use zeroize::Zeroizing;

const DEFAULT_ASR_ENDPOINT: &str = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_ASR_MODEL: &str = "whisper-1";
const DEFAULT_LLM_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";
const DEFAULT_LLM_MODEL: &str = "gpt-4o-mini";

struct RecordingTicker {
    cancel: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl RecordingTicker {
    fn start(app: AppHandle) -> Self {
        let cancel = Arc::new(AtomicBool::new(false));
        let cancel_clone = Arc::clone(&cancel);
        let handle = thread::Builder::new()
            .name("terminalvoice-recording-tick".to_string())
            .spawn(move || {
                let mut duration: u64 = 0;
                while !cancel_clone.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_secs(1));
                    if cancel_clone.load(Ordering::SeqCst) {
                        break;
                    }
                    duration += 1;
                    let _ = emit_recording_tick(&app, duration);
                }
            })
            .ok();
        Self { cancel, handle }
    }

    fn stop(&mut self) {
        self.cancel.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for RecordingTicker {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn start_hotkey_pipeline(app: AppHandle) -> Result<(), String> {
    let (sender, receiver) = mpsc::channel();
    spawn_listener(sender)?;
    thread::Builder::new()
        .name("terminalvoice-voice-pipeline".to_string())
        .spawn(move || {
            info!("语音管线线程已启动");
            run_pipeline(app, receiver);
            info!("语音管线线程已退出");
        })
        .map_err(|error| format!("failed to spawn voice pipeline: {error}"))?;
    info!("热键监听 + 语音管线已启动");
    Ok(())
}

fn run_pipeline(app: AppHandle, receiver: mpsc::Receiver<HotkeyEvent>) {
    let mut recorder = Recorder::new();
    let mut ticker: Option<RecordingTicker> = None;
    let mut rewrite_selected_text: Option<String> = None;
    let mut interpreting = false;
    while let Ok(event) = receiver.recv() {
        debug!(event = ?event, "收到热键事件");
        match event {
            HotkeyEvent::Pressed => handle_pressed(&app, &mut recorder, &mut ticker),
            HotkeyEvent::Released => handle_released(&app, &mut recorder, &mut ticker),
            HotkeyEvent::Cancelled => {
                if interpreting {
                    // 取消口译模式录音
                    if let Some(mut t) = ticker.take() {
                        t.stop();
                    }
                    if recorder.is_recording() {
                        recorder.cancel();
                    }
                    let _ = emit_recording_cancelled(&app);
                    interpreting = false;
                    info!("口译模式已取消");
                } else {
                    handle_cancelled(&app, &mut recorder, &mut ticker);
                }
            }
            HotkeyEvent::RewritePressed => {
                handle_rewrite_pressed(&app, &mut recorder, &mut ticker, &mut rewrite_selected_text)
            }
            HotkeyEvent::RewriteReleased => handle_rewrite_released(
                &app,
                &mut recorder,
                &mut ticker,
                &mut rewrite_selected_text,
            ),
            HotkeyEvent::TtsToggle => handle_tts_toggle(&app),
            HotkeyEvent::Translate => handle_translate(&app, &mut recorder, &mut ticker, &mut interpreting),
            HotkeyEvent::ListenerFailed(message) => {
                error!(message = %message, "热键监听器失败");
                emit_toast(&app, "error", format!("热键不可用: {message}"));
            }
        }
    }
}

fn handle_pressed(app: &AppHandle, recorder: &mut Recorder, ticker: &mut Option<RecordingTicker>) {
    // Hands-free (toggle) mode: if currently recording, stop and transcribe
    if is_hands_free(app) && recorder.is_recording() {
        stop_recording_and_transcribe(app, recorder, ticker);
        return;
    }

    let runtime = app.state::<Mutex<AppRuntime>>();
    if transition_runtime(app, runtime.inner(), RuntimeEvent::HotkeyPressed).is_err() {
        return;
    }

    let device = read_config(app, "input.micDevice");
    info!(device = ?device.as_deref(), "开始录音 (按键说话模式)");
    if let Err(error) = recorder.start(device.as_deref()) {
        error!(error = %error, "录音启动失败");
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
        emit_toast(app, "error", error);
        return;
    }
    info!("录音已开始");
    let _ = emit_recording_started(app);
    *ticker = Some(RecordingTicker::start(app.clone()));

    // TODO: VAD integration — in hands-free mode, spawn a VAD monitor thread that
    // reads real-time audio frames via `VoiceActivityDetector::process_frame` and
    // calls `stop_recording_and_transcribe` when `VadState::SilenceTimeout` is
    // detected, enabling automatic stop-after-silence without a second key press.
}

fn handle_released(app: &AppHandle, recorder: &mut Recorder, ticker: &mut Option<RecordingTicker>) {
    // In hands-free (toggle) mode, release events are ignored — recording
    // is stopped by pressing the hotkey again, not by releasing it.
    if is_hands_free(app) {
        return;
    }
    stop_recording_and_transcribe(app, recorder, ticker);
}

fn stop_recording_and_transcribe(
    app: &AppHandle,
    recorder: &mut Recorder,
    ticker: &mut Option<RecordingTicker>,
) {
    if !recorder.is_recording() {
        return;
    }
    if let Some(mut t) = ticker.take() {
        t.stop();
    }
    info!("停止录音，等待 ASR 识别...");
    let _ = emit_recording_stopped(app);

    let runtime = app.state::<Mutex<AppRuntime>>();
    let audio = match recorder.stop() {
        Ok(audio) => {
            info!(
                samples = audio.samples.len(),
                duration_ms = audio.duration.as_millis(),
                sample_rate = audio.sample_rate,
                "录音停止，音频有效"
            );
            audio
        }
        Err(error) => {
            error!(error = %error, "录音停止失败");
            let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
            emit_toast(app, "error", error);
            return;
        }
    };
    if !audio.is_valid() {
        warn!("录音时长过短，已取消");
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::HotkeyReleasedTooShort);
        return;
    }
    if transition_runtime(
        app,
        runtime.inner(),
        RuntimeEvent::HotkeyReleasedWithValidAudio,
    )
    .is_err()
    {
        return;
    }

    let mode_value = read_config(app, "service.asrProvider");
    let mode = AsrMode::parse(mode_value.as_deref());
    info!(mode = ?mode, "开始语音识别");
    let cloud_config = cloud_asr_config(app);
    let result = match transcribe(mode, cloud_config, &audio, app) {
        Ok(result) => {
            info!(provider = %result.provider, text_len = result.text.len(), "语音识别完成");
            debug!(text = %result.text, "ASR 原文");
            result
        }
        Err(error) => {
            error!(error = %error, "语音识别失败");
            let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::RecognitionFailed);
            emit_toast(app, "error", format!("语音识别失败: {error}"));
            return;
        }
    };
    let source_text = result.text;
    let rule_processed_text = process_text(
        &source_text,
        &PreprocessConfig {
            mode: TextMode::Normal,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        },
    );
    let processed_text = apply_llm(app, &rule_processed_text);

    if transition_runtime(app, runtime.inner(), RuntimeEvent::RecognitionSucceeded).is_err() {
        return;
    }
    let draft = PreviewDraft {
        source_text,
        processed_text,
        text_mode: PreviewTextMode::Normal,
        asr_provider: result.provider,
    };
    if let Err(error) = emit_preview_ready(app, &draft) {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
        emit_toast(app, "error", format!("无法显示预览: {error}"));
    }
}

fn apply_llm(app: &AppHandle, input: &str) -> String {
    // 检查是否有激活的语音技能
    let active_skill = read_config(app, "service.activeSkill")
        .filter(|v| !v.trim().is_empty())
        .and_then(|id| skills::find_skill(&id));

    // 如果有激活的技能，使用技能的 system prompt
    if let Some(skill) = &active_skill {
        info!(skill_id = %skill.id, "使用语音技能");
        let result = cloud_llm_config(app)
            .ok_or_else(|| "LLM 配置不完整".to_string())
            .and_then(LlmClient::new)
            .and_then(|client| {
                let app_clone = app.clone();
                let mut accumulated = String::new();
                client.process_with_prompt_streaming(&skill.prompt, input, |delta| {
                    accumulated.push_str(delta);
                    let _ = emit_llm_streaming_delta(&app_clone, delta, &accumulated);
                })
            });
        return match result {
            Ok(text) => text,
            Err(error) => {
                warn!(error = %error, "技能处理不可用");
                emit_toast(app, "warn", format!("技能处理不可用，已使用原始文本: {error}"));
                input.to_string()
            }
        };
    }

    // 正常路径：使用 organize_streaming
    let mode_value = read_config(app, "service.textMode");
    let mode = TextProcessMode::parse(mode_value.as_deref());
    if mode == TextProcessMode::Off {
        return input.to_string();
    }

    let result = cloud_llm_config(app)
        .ok_or_else(|| "LLM 配置不完整".to_string())
        .and_then(LlmClient::new)
        .and_then(|client| {
            let app_clone = app.clone();
            let mut accumulated = String::new();
            client.organize_streaming(mode, input, |delta| {
                accumulated.push_str(delta);
                let _ = emit_llm_streaming_delta(&app_clone, delta, &accumulated);
            })
        });
    match result {
        Ok(text) => text,
        Err(error) => {
            warn!(error = %error, "AI 整理不可用");
            emit_toast(
                app,
                "warn",
                format!("AI 整理不可用，已使用规则处理文本: {error}"),
            );
            input.to_string()
        }
    }
}

fn handle_rewrite_pressed(
    app: &AppHandle,
    recorder: &mut Recorder,
    ticker: &mut Option<RecordingTicker>,
    rewrite_selected_text: &mut Option<String>,
) {
    let selected = rewrite::capture_selected_text();
    *rewrite_selected_text = if selected.is_empty() {
        debug!("改写模式未捕获选中文本");
        None
    } else {
        info!(text_len = selected.len(), "改写模式捕获选中文本");
        Some(selected)
    };

    let runtime = app.state::<Mutex<AppRuntime>>();
    if transition_runtime(app, runtime.inner(), RuntimeEvent::HotkeyPressed).is_err() {
        return;
    }
    if let Ok(mut rt) = runtime.lock() {
        rt.set_rewrite_mode(true);
    }

    let device = read_config(app, "input.micDevice");
    info!("改写模式开始录音");
    if let Err(error) = recorder.start(device.as_deref()) {
        error!(error = %error, "改写模式录音启动失败");
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
        emit_toast(app, "error", error);
        if let Ok(mut rt) = runtime.lock() {
            rt.set_rewrite_mode(false);
        }
        *rewrite_selected_text = None;
        return;
    }
    let _ = emit_recording_started(app);
    let _ = emit_rewrite_started(app);
    *ticker = Some(RecordingTicker::start(app.clone()));
}

fn handle_rewrite_released(
    app: &AppHandle,
    recorder: &mut Recorder,
    ticker: &mut Option<RecordingTicker>,
    rewrite_selected_text: &mut Option<String>,
) {
    if !recorder.is_recording() {
        return;
    }
    if let Some(mut t) = ticker.take() {
        t.stop();
    }
    let _ = emit_recording_stopped(app);

    let runtime = app.state::<Mutex<AppRuntime>>();
    let audio = match recorder.stop() {
        Ok(audio) => audio,
        Err(error) => {
            let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
            emit_toast(app, "error", error);
            reset_rewrite_mode(runtime.inner());
            *rewrite_selected_text = None;
            return;
        }
    };
    if !audio.is_valid() {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::HotkeyReleasedTooShort);
        reset_rewrite_mode(runtime.inner());
        *rewrite_selected_text = None;
        return;
    }
    if transition_runtime(app, runtime.inner(), RuntimeEvent::HotkeyReleasedWithValidAudio).is_err() {
        return;
    }

    let mode_value = read_config(app, "service.asrProvider");
    let mode = AsrMode::parse(mode_value.as_deref());
    let cloud_config = cloud_asr_config(app);
    let result = match transcribe(mode, cloud_config, &audio, app) {
        Ok(result) => result,
        Err(error) => {
            let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::RecognitionFailed);
            emit_toast(app, "error", format!("语音识别失败: {error}"));
            reset_rewrite_mode(runtime.inner());
            *rewrite_selected_text = None;
            return;
        }
    };

    let voice_instruction = result.text;
    let selected_text = rewrite_selected_text.take().unwrap_or_default();

    let (source_text, processed_text) = if selected_text.is_empty() {
        let rule_processed = process_text(
            &voice_instruction,
            &PreprocessConfig {
                mode: TextMode::Normal,
                add_punctuation: true,
                filter_words: true,
                single_line: true,
                custom_filter_words: Vec::new(),
            },
        );
        let processed = apply_llm(app, &rule_processed);
        (voice_instruction, processed)
    } else {
        let rewritten = apply_rewrite_llm(app, &selected_text, &voice_instruction);
        let _ = emit_rewrite_result(app, &selected_text, &rewritten);
        (selected_text.clone(), rewritten)
    };

    if transition_runtime(app, runtime.inner(), RuntimeEvent::RecognitionSucceeded).is_err() {
        return;
    }
    reset_rewrite_mode(runtime.inner());

    let draft = PreviewDraft {
        source_text,
        processed_text,
        text_mode: PreviewTextMode::Normal,
        asr_provider: result.provider,
    };
    if let Err(error) = emit_preview_ready(app, &draft) {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
        emit_toast(app, "error", format!("无法显示预览: {error}"));
    }
}

fn apply_rewrite_llm(app: &AppHandle, selected_text: &str, voice_instruction: &str) -> String {
    let prompt = rewrite::build_rewrite_prompt(selected_text, voice_instruction);
    let result = cloud_llm_config(app)
        .ok_or_else(|| "LLM 配置不完整".to_string())
        .and_then(LlmClient::new)
        .and_then(|client| client.rewrite(&prompt));
    match result {
        Ok(text) => text,
        Err(error) => {
            emit_toast(app, "warn", format!("AI 改写不可用，使用原始文本: {error}"));
            selected_text.to_string()
        }
    }
}

fn reset_rewrite_mode(runtime: &Mutex<AppRuntime>) {
    if let Ok(mut rt) = runtime.lock() {
        rt.set_rewrite_mode(false);
    }
}

/// Alt+1: TTS 朗读切换。正在朗读时停止；未朗读时捕获选中文本并开始朗读。
fn handle_tts_toggle(app: &AppHandle) {
    if tts::is_speaking() {
        info!("停止 TTS 朗读");
        let _ = tts::stop_speaking();
        let _ = emit_tts_stopped(app);
        return;
    }

    let selected_text = rewrite::capture_selected_text();
    if selected_text.trim().is_empty() {
        debug!("未选中文本，跳过朗读");
        emit_toast(app, "info", "未选中文本，无法朗读");
        return;
    }

    info!(text_len = selected_text.trim().len(), "开始 TTS 朗读");
    let _ = emit_tts_started(app);
    let app_clone = app.clone();
    thread::Builder::new()
        .name("terminalvoice-tts".to_string())
        .spawn(move || {
            if let Err(error) = tts::speak(&selected_text) {
                error!(error = %error, "TTS 朗读失败");
                emit_toast(&app_clone, "error", format!("朗读失败: {error}"));
            } else {
                info!("TTS 朗读完成");
            }
            let _ = emit_tts_stopped(&app_clone);
        })
        .ok();
}

/// Alt+2: 翻译/口译模式。
///
/// - 有选中文本时：翻译选中文本并推送结果。
/// - 无选中文本时：进入口译模式（录音→ASR→翻译→TTS）。
///   首次 Alt+2 开始录音，再次 Alt+2 停止录音并执行翻译+TTS。
fn handle_translate(
    app: &AppHandle,
    recorder: &mut Recorder,
    ticker: &mut Option<RecordingTicker>,
    interpreting: &mut bool,
) {
    // 如果正在口译，停止录音并执行翻译+TTS
    if *interpreting {
        *interpreting = false;
        stop_interpretation(app, recorder, ticker);
        return;
    }

    // 检查是否有选中文本
    let selected_text = rewrite::capture_selected_text();
    if !selected_text.trim().is_empty() {
        // 正常翻译模式
        info!(text_len = selected_text.trim().len(), "翻译选中文本");
        translate_selected_text(app, &selected_text);
        return;
    }

    // 无选中文本 → 进入口译模式，开始录音
    *interpreting = true;
    info!("进入口译模式，开始录音");

    let device = read_config(app, "input.micDevice");
    if let Err(error) = recorder.start(device.as_deref()) {
        error!(error = %error, "口译模式录音启动失败");
        *interpreting = false;
        emit_toast(app, "error", error);
        return;
    }
    let _ = emit_recording_started(app);
    *ticker = Some(RecordingTicker::start(app.clone()));
}

/// 口译模式：停止录音 → ASR → 翻译 → TTS
fn stop_interpretation(
    app: &AppHandle,
    recorder: &mut Recorder,
    ticker: &mut Option<RecordingTicker>,
) {
    if !recorder.is_recording() {
        return;
    }
    if let Some(mut t) = ticker.take() {
        t.stop();
    }
    let _ = emit_recording_stopped(app);

    let audio = match recorder.stop() {
        Ok(audio) => audio,
        Err(error) => {
            emit_toast(app, "error", error);
            return;
        }
    };
    if !audio.is_valid() {
        emit_toast(app, "info", "录音时间太短，已取消");
        return;
    }

    // ASR 识别
    let mode_value = read_config(app, "service.asrProvider");
    let mode = AsrMode::parse(mode_value.as_deref());
    let cloud_config = cloud_asr_config(app);
    let result = match transcribe(mode, cloud_config, &audio, app) {
        Ok(result) => result,
        Err(error) => {
            emit_toast(app, "error", format!("语音识别失败: {error}"));
            return;
        }
    };

    let source_text = result.text;
    if source_text.trim().is_empty() {
        emit_toast(app, "info", "未识别到语音内容");
        return;
    }

    info!(text = %source_text, "口译 ASR 结果");

    // 翻译
    let config = match cloud_llm_config(app) {
        Some(config) => config,
        None => {
            emit_toast(app, "error", "LLM 配置不完整，无法翻译");
            return;
        }
    };

    let target_lang = read_config(app, "service.translateTargetLang")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "英文".to_string());

    let translated_text = match translate::translate(&source_text, &target_lang, &config) {
        Ok(text) => text,
        Err(error) => {
            emit_toast(app, "error", format!("翻译失败: {error}"));
            return;
        }
    };

    info!(translated = %translated_text, "口译翻译结果");

    // 推送翻译结果
    let _ = emit_translate_result(app, &source_text, &translated_text);

    // TTS 朗读译文
    let _ = emit_tts_started(app);
    let app_clone = app.clone();
    thread::Builder::new()
        .name("terminalvoice-interpret-tts".to_string())
        .spawn(move || {
            if let Err(error) = tts::speak(&translated_text) {
                emit_toast(&app_clone, "error", format!("朗读失败: {error}"));
            }
            let _ = emit_tts_stopped(&app_clone);
        })
        .ok();
}

/// 翻译选中文本（正常翻译模式）
fn translate_selected_text(app: &AppHandle, selected_text: &str) {
    let config = match cloud_llm_config(app) {
        Some(config) => config,
        None => {
            emit_toast(app, "error", "LLM 配置不完整，无法翻译");
            return;
        }
    };

    let target_lang = read_config(app, "service.translateTargetLang")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "英文".to_string());

    match translate::translate(selected_text, &target_lang, &config) {
        Ok(translated_text) => {
            let _ = emit_translate_result(app, selected_text, &translated_text);
        }
        Err(error) => {
            emit_toast(app, "error", format!("翻译失败: {error}"));
        }
    }
}

fn handle_cancelled(app: &AppHandle, recorder: &mut Recorder, ticker: &mut Option<RecordingTicker>) {
    info!("录音已取消");
    if let Some(mut t) = ticker.take() {
        t.stop();
    }
    if recorder.is_recording() {
        recorder.cancel();
    }
    let runtime = app.state::<Mutex<AppRuntime>>();
    let is_recording = runtime
        .lock()
        .map(|runtime| matches!(runtime.state(), RuntimeState::Recording))
        .unwrap_or(false);
    if is_recording {
        let _ = emit_recording_cancelled(app);
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
    }
}

fn read_config(app: &AppHandle, key: &str) -> Option<String> {
    let db = app.state::<Mutex<Database>>();
    let stored = db.lock().ok()?.get_config(key).ok().flatten()?;
    decode_config_value(key, &stored).ok()
}

fn is_hands_free(app: &AppHandle) -> bool {
    read_config(app, "input.handsFree")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

fn cloud_asr_config(app: &AppHandle) -> Option<CloudAsrConfig> {
    let api_key = read_config(app, "service.asrApiKey")?;
    if api_key.trim().is_empty() {
        return None;
    }
    Some(CloudAsrConfig {
        endpoint: read_config(app, "service.asrEndpoint")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_ASR_ENDPOINT.to_string()),
        api_key: Zeroizing::new(api_key),
        model: read_config(app, "service.asrModel")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_ASR_MODEL.to_string()),
        language: Some("zh".to_string()),
    })
}

fn cloud_llm_config(app: &AppHandle) -> Option<LlmConfig> {
    let api_key = read_config(app, "service.llmApiKey")?;
    if api_key.trim().is_empty() {
        return None;
    }
    Some(LlmConfig {
        endpoint: read_config(app, "service.llmEndpoint")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_LLM_ENDPOINT.to_string()),
        api_key: Zeroizing::new(api_key),
        model: read_config(app, "service.llmModel")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_LLM_MODEL.to_string()),
    })
}
