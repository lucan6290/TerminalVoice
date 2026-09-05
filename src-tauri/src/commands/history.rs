use crate::services::db::{Database, HistoryItem};
use crate::services::injector::inject_text;
use crate::state::AppRuntime;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn list_history(db: State<'_, Mutex<Database>>) -> Result<Vec<HistoryItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_history().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_history(db: State<'_, Mutex<Database>>, id: i64) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.delete_history(id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_history(db: State<'_, Mutex<Database>>) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.clear_history().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn search_history(
    db: State<'_, Mutex<Database>>,
    query: String,
) -> Result<Vec<HistoryItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.search_history(&query)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn reinject_history(
    db: State<'_, Mutex<Database>>,
    _runtime: State<'_, Mutex<AppRuntime>>,
    app: AppHandle,
    id: i64,
) -> Result<(), String> {
    let final_text = {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.get_history_by_id(id)
            .map_err(|error| error.to_string())?
            .final_text
    };

    inject_text(&final_text).map_err(|error| format!("文本注入失败: {error}"))?;

    app.emit(
        "toast",
        serde_json::json!({
            "level": "success",
            "message": "已重新注入文本"
        }),
    )
    .map_err(|error| error.to_string())
}
