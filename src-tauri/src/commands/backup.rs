use crate::services::backup;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn export_data(app: AppHandle) -> Result<Vec<u8>, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    let db_path = data_dir.join("terminalvoice.db");
    backup::export_database(&db_path)
}

#[tauri::command]
pub fn import_data(app: AppHandle, data: Vec<u8>) -> Result<(), String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    let db_path = data_dir.join("terminalvoice.db");
    backup::import_database(&db_path, &data)
}
