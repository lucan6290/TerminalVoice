use crate::services::db::{ConfigEntry, Database};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigUpdatedPayload {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub fn get_config(key: String, db: State<'_, Mutex<Database>>) -> Result<Option<String>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.get_config(&key).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_config(
    key: String,
    value: String,
    db: State<'_, Mutex<Database>>,
    app: AppHandle,
) -> Result<(), String> {
    {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.set_config(&key, &value)
            .map_err(|error| error.to_string())?;
    }

    app.emit("config-updated", ConfigUpdatedPayload { key, value })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_config(db: State<'_, Mutex<Database>>) -> Result<Vec<ConfigEntry>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_config().map_err(|error| error.to_string())
}
