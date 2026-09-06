use crate::services::db::Database;
use crate::services::hotkey::parse_hotkey;
use crate::services::pipeline::{PipelineControl, PipelineHandle};
use crate::services::secrets::encode_config_value;
use serde::Deserialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfigPayload {
    pub ptt_key: String,
    pub tts_key: String,
    pub translate_key: String,
}

/// 一次性保存三个热键配置（input.pttKey / input.ttsKey / input.translateKey），
/// 然后向管线发 ReloadHotkeys 信号让其立即生效。
#[tauri::command]
pub fn set_hotkey_config(
    payload: HotkeyConfigPayload,
    db: State<'_, Mutex<Database>>,
    app: AppHandle,
) -> Result<(), String> {
    // 校验三个按键名都合法
    for (name, raw) in [
        ("input.pttKey", &payload.ptt_key),
        ("input.ttsKey", &payload.tts_key),
        ("input.translateKey", &payload.translate_key),
    ] {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(format!("{name} 不能为空"));
        }
        if parse_hotkey(trimmed).is_none() {
            return Err(format!("无法识别的按键：{trimmed}"));
        }
    }

    {
        let db = db.lock().map_err(|e| e.to_string())?;
        for (key, value) in [
            ("input.pttKey", payload.ptt_key.trim().to_string()),
            ("input.ttsKey", payload.tts_key.trim().to_string()),
            (
                "input.translateKey",
                payload.translate_key.trim().to_string(),
            ),
        ] {
            let stored = encode_config_value(key, &value)?;
            db.set_config(key, &stored).map_err(|e| e.to_string())?;
        }
    }

    if let Some(handle) = app.try_state::<PipelineHandle>() {
        if let Err(e) = handle.send(PipelineControl::ReloadHotkeys) {
            tracing::warn!("发送 ReloadHotkeys 失败：{e}");
        }
    }
    Ok(())
}
