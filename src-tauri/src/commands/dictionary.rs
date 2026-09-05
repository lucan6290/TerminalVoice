use crate::services::db::{Database, FilterWordItem};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_filter_words(db: State<'_, Mutex<Database>>) -> Result<Vec<FilterWordItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_filter_words().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn add_filter_word(
    db: State<'_, Mutex<Database>>,
    word: String,
    replacement: Option<String>,
) -> Result<i64, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.add_filter_word(&word, replacement.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_filter_word(db: State<'_, Mutex<Database>>, id: i64) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.delete_filter_word(id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn toggle_filter_word(db: State<'_, Mutex<Database>>, id: i64) -> Result<(), String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.toggle_filter_word(id)
        .map_err(|error| error.to_string())
}
