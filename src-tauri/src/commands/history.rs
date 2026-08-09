use crate::services::db::{Database, HistoryItem};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_history(db: State<'_, Mutex<Database>>) -> Result<Vec<HistoryItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_history().map_err(|error| error.to_string())
}
