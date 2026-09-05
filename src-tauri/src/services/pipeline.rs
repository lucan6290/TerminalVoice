use crate::services::db::{Database, NewHistoryItem};
use crate::services::events::{emit_toast, transition_runtime};
use crate::services::hotkey::{spawn_listener, HotkeyEvent};
use crate::services::injector::inject_text;
use crate::services::preprocess::{process_text, PreprocessConfig, TextMode};
use crate::services::recorder::Recorder;
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use std::sync::{mpsc, Mutex};
use std::thread;
use tauri::{AppHandle, Manager};

const DEFAULT_MOCK_ASR_TEXT: &str = "这是一段测试语音输入";

pub fn start_hotkey_pipeline(app: AppHandle) -> Result<(), String> {
    let (sender, receiver) = mpsc::channel();
    spawn_listener(sender)?;
    thread::Builder::new()
        .name("terminalvoice-voice-pipeline".to_string())
        .spawn(move || run_pipeline(app, receiver))
        .map_err(|error| format!("failed to spawn voice pipeline: {error}"))?;
    Ok(())
}

fn run_pipeline(app: AppHandle, receiver: mpsc::Receiver<HotkeyEvent>) {
    let mut recorder = Recorder::new();
    while let Ok(event) = receiver.recv() {
        match event {
            HotkeyEvent::Pressed => handle_pressed(&app, &mut recorder),
            HotkeyEvent::Released => handle_released(&app, &mut recorder),
            HotkeyEvent::Cancelled => handle_cancelled(&app, &mut recorder),
            HotkeyEvent::ListenerFailed(message) => {
                emit_toast(&app, "error", format!("热键不可用: {message}"));
            }
        }
    }
}

fn handle_pressed(app: &AppHandle, recorder: &mut Recorder) {
    let runtime = app.state::<Mutex<AppRuntime>>();
    if transition_runtime(app, runtime.inner(), RuntimeEvent::HotkeyPressed).is_err() {
        return;
    }

    let device = read_config(app, "input.micDevice");
    if let Err(error) = recorder.start(device.as_deref()) {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
        emit_toast(app, "error", error);
    }
}

fn handle_released(app: &AppHandle, recorder: &mut Recorder) {
    if !recorder.is_recording() {
        return;
    }
    let runtime = app.state::<Mutex<AppRuntime>>();
    let audio = match recorder.stop() {
        Ok(audio) => audio,
        Err(error) => {
            let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
            emit_toast(app, "error", error);
            return;
        }
    };
    if !audio.is_valid() {
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

    let source_text = read_config(app, "mock_asr_text")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MOCK_ASR_TEXT.to_string());
    let processed_text = process_text(
        &source_text,
        &PreprocessConfig {
            mode: TextMode::Normal,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        },
    );

    if let Err(error) = inject_text(&processed_text) {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::RecognitionFailed);
        emit_toast(app, "error", format!("文本注入失败: {error}"));
        return;
    }

    if let Err(error) = save_history(app, &source_text, &processed_text) {
        emit_toast(
            app,
            "warn",
            format!("文字已上屏，但历史记录保存失败: {error}"),
        );
    }
    if transition_runtime(app, runtime.inner(), RuntimeEvent::RecognitionSucceeded).is_ok() {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::ConfirmedPreview);
    }
}

fn handle_cancelled(app: &AppHandle, recorder: &mut Recorder) {
    if recorder.is_recording() {
        recorder.cancel();
    }
    let runtime = app.state::<Mutex<AppRuntime>>();
    let is_recording = runtime
        .lock()
        .map(|runtime| matches!(runtime.state(), RuntimeState::Recording))
        .unwrap_or(false);
    if is_recording {
        let _ = transition_runtime(app, runtime.inner(), RuntimeEvent::Cancelled);
    }
}

fn read_config(app: &AppHandle, key: &str) -> Option<String> {
    let db = app.state::<Mutex<Database>>();
    let value = db.lock().ok()?.get_config(key).ok().flatten();
    value
}

fn save_history(app: &AppHandle, source_text: &str, final_text: &str) -> Result<(), String> {
    let db = app.state::<Mutex<Database>>();
    let db = db.lock().map_err(|error| error.to_string())?;
    db.insert_history(NewHistoryItem {
        source_text: source_text.to_string(),
        final_text: final_text.to_string(),
        text_mode: "Normal".to_string(),
        asr_provider: "mock".to_string(),
    })
    .map(|_| ())
    .map_err(|error| error.to_string())
}
