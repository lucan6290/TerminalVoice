use crate::services::{backup, paths};
use tauri::AppHandle;

#[tauri::command]
pub fn export_data(_app: AppHandle) -> Result<Vec<u8>, String> {
    let db_path = paths::db_path();
    backup::export_database(&db_path)
}

#[tauri::command]
pub fn import_data(_app: AppHandle, data: Vec<u8>) -> Result<(), String> {
    let db_path = paths::db_path();
    backup::import_database(&db_path, &data)
}
