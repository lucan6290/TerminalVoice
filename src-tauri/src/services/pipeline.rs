use crate::commands::preview::{emit_preview_ready, PreviewDraft, TextMode as PreviewTextMode};
use crate::services::asr::{transcribe, AsrMode};
use crate::services::asr_cloud::CloudAsrConfig;
use crate::services::db::Database;
use crate::services::events::{
    emit_llm_streaming_delta, emit_recording_cancelled, emit_recording_started,
    emit_recording_stopped, emit_recording_tick, emit_rewrite_result, emit_rewrite_started,
    emit_toast, emit_translate_result, emit_tts_started, emit_tts_stopped, transition_runtime,
};
use crate::services::hotkey::{
    format_hotkey, parse_hotkey, HotkeyConfig, HotkeyEdgeState, HotkeyEvent,
};
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
    mpsc, Arc, Mutex, RwLock,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tracing::{debug, error, info, warn};
use zeroize::Zeroizing;

/// 外部控制管线的指令（从托盘等渠道发送）。
#[derive(Debug)]
pub enum PipelineControl {
    /// 暂停监听：阻止所有热键触发，并取消正在进行的录音
    Pause,
    /// 恢复监听
    Resume,
    /// 重新加载热键配置（从 DB 读取 input.pttKey/input.ttsKey/input.translateKey）
    ReloadHotkeys,
}

/// 管线句柄：提供给外部（如托盘菜单/设置界面）发送控制指令，并查询当前暂停状态。
pub struct PipelineHandle {
    control_tx: mpsc::Sender<PipelineControl>,
    paused: Arc<AtomicBool>,
}

impl PipelineHandle {
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn send(&self, cmd: PipelineControl) -> Result<(), String> {
        self.control_tx
            .send(cmd)
            .map_err(|e| format!("管线控制通道已关闭: {e}"))
    }
}

pub const DEFAULT_ASR_BASE: &str = "https://api.openai.com/v1";
const DEFAULT_ASR_MODEL: &str = "whisper-1";
pub const DEFAULT_LLM_BASE: &str = "https://api.openai.com/v1";
const DEFAULT_LLM_MODEL: &str = "gpt-4o-mini";

pub const ASR_PATH: &str = "/audio/transcriptions";
pub const LLM_PATH: &str = "/chat/completions";

/// 解析端点地址（供 commands 层测试连接等场景复用）。
/// - `full_url = true`：直接使用用户填写的完整 URL。
/// - `full_url = false`（默认）：用户填写的是基础地址，自动拼接 API 路径；
///   若已包含目标路径后缀（兼容旧配置），则不重复拼接。
pub fn resolve_endpoint(base: &str, path: &str, default_base: &str) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return format!("{}{}", default_base.trim_end_matches('/'), path);
    }
    if trimmed.ends_with(path) {
        return trimmed.to_string();
    }
    format!("{trimmed}{path}")
}

/// 解析 /models 端点地址。
/// - `full_url = true`：用户填写的是完整请求 URL（如 .../chat/completions 或 .../audio/transcriptions），
///   尝试推导对应的 models URL（截断到最后一个 '/' 之前，拼 "/models"）。
/// - `full_url = false`：用户填写的是基础地址，自动拼接 /models；
///   若已包含 /models 后缀则不重复拼接。
pub fn resolve_models_endpoint(base: &str, full_url: bool, default_base: &str) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return format!("{}/models", default_base.trim_end_matches('/'));
    }
    if full_url {
        // 用户填的是完整请求 URL（如 .../chat/completions），推导到 base + /models
        match trimmed.rfind('/') {
            Some(pos) if pos > 8 => {
                // pos > 8 确保不是 https:// 的斜杠
                let candidate = format!("{}/models", &trimmed[..pos]);
                return candidate;
            }
            _ => return format!("{trimmed}/models"),
        }
    }
    if trimmed.ends_with("/models") {
        return trimmed.to_string();
    }
    format!("{trimmed}/models")
}

/// 读取布尔配置项（"true"/"1" 为真）。
fn read_bool_config(app: &AppHandle, key: &str) -> bool {
    read_config(app, key)
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

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

/// 管线内部事件（热键事件 + 控制指令）。
enum PipelineEvent {
    Hotkey(HotkeyEvent),
    Control(PipelineControl),
}

pub fn start_hotkey_pipeline(app: AppHandle) -> Result<PipelineHandle, String> {
    // 初始热键配置：从 DB 读取；若未配置使用默认值
    let initial_config = load_hotkey_config(&app);
    let config_arc = Arc::new(RwLock::new(initial_config.clone()));
    info!(?initial_config, "初始热键配置");

    let (hotkey_tx, hotkey_rx) = mpsc::channel();
    let (control_tx, control_rx) = mpsc::channel::<PipelineControl>();
    let paused = Arc::new(AtomicBool::new(false));

    // 启动热键监听（回调内持有 config_arc，可通过 reload 热更新）
    spawn_listener_with_config(config_arc.clone(), hotkey_tx.clone())?;

    // 合并热键事件与控制指令到统一事件流
    let event_rx: mpsc::Receiver<PipelineEvent> = {
        let (tx, rx) = mpsc::channel();
        spawn_forwarder(hotkey_rx, tx.clone(), PipelineEvent::Hotkey);
        spawn_forwarder(control_rx, tx, PipelineEvent::Control);
        rx
    };

    let pipeline_paused = paused.clone();
    let app_clone = app.clone();
    let config_for_pipeline = config_arc.clone();
    thread::Builder::new()
        .name("terminalvoice-voice-pipeline".to_string())
        .spawn(move || {
            info!("语音管线线程已启动");
            run_pipeline(app_clone, event_rx, pipeline_paused, config_for_pipeline);
            info!("语音管线线程已退出");
        })
        .map_err(|error| format!("failed to spawn voice pipeline: {error}"))?;
    info!("热键监听 + 语音管线已启动");
    Ok(PipelineHandle { control_tx, paused })
}

/// 从 DB 读取热键配置（容错：任何键缺失/非法都回退到默认）。
pub fn load_hotkey_config(app: &AppHandle) -> HotkeyConfig {
    let mut cfg = HotkeyConfig::default();
    if let Some(v) = read_config_raw(app, "input.pttKey") {
        if let Some(k) = parse_hotkey(&v) {
            cfg.ptt = k;
        }
    }
    if let Some(v) = read_config_raw(app, "input.ttsKey") {
        if let Some(k) = parse_hotkey(&v) {
            cfg.tts = k;
        }
    }
    if let Some(v) = read_config_raw(app, "input.translateKey") {
        if let Some(k) = parse_hotkey(&v) {
            cfg.translate = k;
        }
    }
    cfg
}

/// 启动热键监听线程。回调内通过 Arc<RwLock<HotkeyConfig>> 读取最新配置，
/// 因此无需停止/重建线程即可动态切换按键。
fn spawn_listener_with_config(
    config: Arc<RwLock<HotkeyConfig>>,
    sender: mpsc::Sender<HotkeyEvent>,
) -> Result<JoinHandle<()>, String> {
    let handle = thread::Builder::new()
        .name("terminalvoice-hotkey".to_string())
        .spawn(move || {
            info!("全局热键监听线程已启动（支持运行时重载配置）");
            let failure_sender = sender.clone();
            // edge state 本身不存储 config——每次回调时从 Arc 中读取最新 config 并构造一个临时 state。
            // 但 state 有 pressed/shift_held/alt_held 等可变状态，所以用 Mutex 包裹 edge。
            let edge: Mutex<HotkeyEdgeState> = {
                let cfg = config.read().map(|g| g.clone()).unwrap_or_default();
                Mutex::new(HotkeyEdgeState::new(cfg))
            };
            let callback = move |event: rdev::Event| {
                // 每次回调都检查配置是否更新；如果配置的 key 集合变化了，则重建 edge state 但保留按下状态？
                // 为简单起见，配置变化后让 edge 使用新配置，但按下态保持稳定需要特别处理。
                // 这里选择：每次按键事件都使用最新配置，HotkeyEdgeState 在构造后 config 字段不变，
                // 所以当配置变化时我们重建 edge（丢弃按下态——用户改配置时不会在按着键，所以没问题）。
                // 使用一个简单策略：edge 内部持有 config 引用，我们每次回调都 clone 最新 config 给它。
                // 但 HotkeyEdgeState 目前在 new 时把 config 放入 struct，我们改为每次事件前检查：
                // ——为了减少改动，下面每次回调都直接拿锁、用当前 edge 处理。
                // 当 config 变化（通过 generation 计数检测）时再重建 edge。
                // 更简单的方案：给 edge 增加 replace_config 方法。
                // 这里我们采用最简单的做法：回调内使用一个最新 config 的 shadow edge state（通过 Mutex 保护）。

                if let Ok(mut e) = edge.lock() {
                    // 将 edge 的 config 更新为最新值
                    if let Ok(cfg) = config.read() {
                        e.replace_config(cfg.clone());
                    }
                    if let Some(mapped) = e.handle(&event.event_type) {
                        match &mapped {
                            HotkeyEvent::Pressed => info!("热键按下：开始语音输入"),
                            HotkeyEvent::Released => info!("热键释放：结束语音输入"),
                            HotkeyEvent::Cancelled => info!("热键取消：Esc 按下"),
                            HotkeyEvent::RewritePressed => debug!("热键按下（润色模式）"),
                            HotkeyEvent::RewriteReleased => debug!("热键释放（润色模式）"),
                            HotkeyEvent::TtsToggle => info!("热键：朗读切换"),
                            HotkeyEvent::Translate => info!("热键：翻译"),
                            HotkeyEvent::ListenerFailed(_) => {}
                        }
                        let _ = sender.send(mapped);
                    }
                }
            };
            if let Err(error) = rdev::listen(callback) {
                let message = format!("{error:?}");
                error!("全局热键监听失败: {}", message);
                let _ = failure_sender.send(HotkeyEvent::ListenerFailed(message));
            }
        })
        .map_err(|error| {
            error!("无法启动全局热键监听线程: {}", error);
            format!("failed to spawn hotkey listener: {error}")
        })?;
    Ok(handle)
}

/// 启动一个转发线程，把源 channel 的消息包装后送入目标 channel。
fn spawn_forwarder<T: Send + 'static>(
    src: mpsc::Receiver<T>,
    dst: mpsc::Sender<PipelineEvent>,
    wrap: impl Fn(T) -> PipelineEvent + Send + 'static,
) {
    thread::Builder::new()
        .name("terminalvoice-pipe-forwarder".to_string())
        .spawn(move || {
            while let Ok(msg) = src.recv() {
                if dst.send(wrap(msg)).is_err() {
                    break;
                }
            }
        })
        .ok();
}

fn run_pipeline(
    app: AppHandle,
    receiver: mpsc::Receiver<PipelineEvent>,
    paused: Arc<AtomicBool>,
    config: Arc<RwLock<HotkeyConfig>>,
) {
    let mut recorder = Recorder::new();
    let mut ticker: Option<RecordingTicker> = None;
    let mut rewrite_selected_text: Option<String> = None;
    let mut interpreting = false;
    while let Ok(event) = receiver.recv() {
        match event {
            PipelineEvent::Control(ctrl) => match ctrl {
                PipelineControl::Pause => {
                    if paused.load(Ordering::SeqCst) {
                        continue;
                    }
                    info!("语音管线已暂停（托盘菜单）");
                    paused.store(true, Ordering::SeqCst);
                    if recorder.is_recording() {
                        if let Some(mut t) = ticker.take() {
                            t.stop();
                        }
                        recorder.cancel();
                        interpreting = false;
                        rewrite_selected_text = None;
                        let _ = emit_recording_cancelled(&app);
                    }
                    let runtime = app.state::<Mutex<AppRuntime>>();
                    let _ = transition_runtime(&app, runtime.inner(), RuntimeEvent::TogglePause);
                    emit_toast(&app, "info", "语音监听已暂停");
                }
                PipelineControl::Resume => {
                    if !paused.load(Ordering::SeqCst) {
                        continue;
                    }
                    info!("语音管线已恢复（托盘菜单）");
                    paused.store(false, Ordering::SeqCst);
                    let runtime = app.state::<Mutex<AppRuntime>>();
                    let _ = transition_runtime(&app, runtime.inner(), RuntimeEvent::TogglePause);
                    emit_toast(&app, "info", "语音监听已恢复");
                }
                PipelineControl::ReloadHotkeys => {
                    let new_cfg = load_hotkey_config(&app);
                    let ptt_name = format_hotkey(new_cfg.ptt);
                    let tts_name = format_hotkey(new_cfg.tts);
                    let tr_name = format_hotkey(new_cfg.translate);
                    if let Ok(mut cfg) = config.write() {
                        *cfg = new_cfg.clone();
                    }
                    info!(?new_cfg, "热键配置已重新加载");
                    emit_toast(
                        &app,
                        "info",
                        format!(
                            "热键已更新：说话={}，朗读=Alt+{}，翻译=Alt+{}",
                            ptt_name, tts_name, tr_name
                        ),
                    );
                }
            },
            PipelineEvent::Hotkey(hotkey) => {
                if paused.load(Ordering::SeqCst) && !matches!(hotkey, HotkeyEvent::Cancelled) {
                    debug!(event = ?hotkey, "管线已暂停，忽略热键");
                    continue;
                }
                debug!(event = ?hotkey, "收到热键事件");
                match hotkey {
                    HotkeyEvent::Pressed => handle_pressed(&app, &mut recorder, &mut ticker),
                    HotkeyEvent::Released => handle_released(&app, &mut recorder, &mut ticker),
                    HotkeyEvent::Cancelled => {
                        if interpreting {
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
                    HotkeyEvent::RewritePressed => handle_rewrite_pressed(
                        &app,
                        &mut recorder,
                        &mut ticker,
                        &mut rewrite_selected_text,
                    ),
                    HotkeyEvent::RewriteReleased => handle_rewrite_released(
                        &app,
                        &mut recorder,
                        &mut ticker,
                        &mut rewrite_selected_text,
                    ),
                    HotkeyEvent::TtsToggle => handle_tts_toggle(&app),
                    HotkeyEvent::Translate => {
                        handle_translate(&app, &mut recorder, &mut ticker, &mut interpreting)
                    }
                    HotkeyEvent::ListenerFailed(message) => {
                        error!(message = %message, "热键监听器失败");
                        emit_toast(&app, "error", format!("热键不可用: {message}"));
                    }
                }
            }
        }
    }
}

fn handle_pressed(app: &AppHandle, recorder: &mut Recorder, ticker: &mut Option<RecordingTicker>) {
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
}

fn handle_released(app: &AppHandle, recorder: &mut Recorder, ticker: &mut Option<RecordingTicker>) {
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
    let active_skill = read_config(app, "service.activeSkill")
        .filter(|v| !v.trim().is_empty())
        .and_then(|id| skills::find_skill(&id));

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

fn handle_translate(
    app: &AppHandle,
    recorder: &mut Recorder,
    ticker: &mut Option<RecordingTicker>,
    interpreting: &mut bool,
) {
    if *interpreting {
        *interpreting = false;
        stop_interpretation(app, recorder, ticker);
        return;
    }

    let selected_text = rewrite::capture_selected_text();
    if !selected_text.trim().is_empty() {
        info!(text_len = selected_text.trim().len(), "翻译选中文本");
        translate_selected_text(app, &selected_text);
        return;
    }

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

    let _ = emit_translate_result(app, &source_text, &translated_text);

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

/// 直接读取 DB 原始字符串（不解密、不解码）；热键不是 secret 键，所以直接返回 get_config 结果。
fn read_config_raw(app: &AppHandle, key: &str) -> Option<String> {
    let db_state = app.state::<Mutex<Database>>();
    let db = match db_state.lock() {
        Ok(guard) => guard,
        Err(_) => return None,
    };
    db.get_config(key).ok().flatten()
}

fn read_config(app: &AppHandle, key: &str) -> Option<String> {
    let stored = read_config_raw(app, key)?;
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
    let full_url = read_bool_config(app, "service.asrFullUrl");
    let raw_endpoint = read_config(app, "service.asrEndpoint")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_ASR_BASE.to_string());
    let endpoint = if full_url {
        raw_endpoint.trim().to_string()
    } else {
        resolve_endpoint(&raw_endpoint, ASR_PATH, DEFAULT_ASR_BASE)
    };
    Some(CloudAsrConfig {
        endpoint,
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
    let full_url = read_bool_config(app, "service.llmFullUrl");
    let raw_endpoint = read_config(app, "service.llmEndpoint")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_LLM_BASE.to_string());
    let endpoint = if full_url {
        raw_endpoint.trim().to_string()
    } else {
        resolve_endpoint(&raw_endpoint, LLM_PATH, DEFAULT_LLM_BASE)
    };
    Some(LlmConfig {
        endpoint,
        api_key: Zeroizing::new(api_key),
        model: read_config(app, "service.llmModel")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_LLM_MODEL.to_string()),
    })
}
