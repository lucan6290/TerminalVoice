use crate::services::db::{ConfigEntry, Database};
use crate::services::secrets::{
    decode_config_value, encode_config_value, is_encrypted_secret, is_secret_config_key,
};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use zeroize::Zeroize;

const SECRET_UPDATED_SENTINEL: &str = "__terminalvoice_secret_updated__";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigUpdatedPayload {
    pub key: String,
    pub value: String,
}

fn decode_and_migrate(db: &Database, key: &str, stored: String) -> Result<String, String> {
    let value = decode_config_value(key, &stored)?;
    if is_secret_config_key(key) && !stored.is_empty() && !is_encrypted_secret(&stored) {
        let encrypted = encode_config_value(key, &value)?;
        db.set_config(key, &encrypted)
            .map_err(|error| error.to_string())?;
    }
    Ok(value)
}

#[tauri::command]
pub fn get_config(key: String, db: State<'_, Mutex<Database>>) -> Result<Option<String>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.get_config(&key)
        .map_err(|error| error.to_string())?
        .map(|stored| decode_and_migrate(&db, &key, stored))
        .transpose()
}

#[tauri::command]
pub fn set_config(
    key: String,
    mut value: String,
    db: State<'_, Mutex<Database>>,
    app: AppHandle,
) -> Result<(), String> {
    let stored = encode_config_value(&key, &value)?;
    {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.set_config(&key, &stored)
            .map_err(|error| error.to_string())?;
    }

    let event_value = if is_secret_config_key(&key) {
        SECRET_UPDATED_SENTINEL.to_string()
    } else {
        value.clone()
    };
    if is_secret_config_key(&key) {
        value.zeroize();
    }
    app.emit(
        "config-updated",
        ConfigUpdatedPayload {
            key,
            value: event_value,
        },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_config(db: State<'_, Mutex<Database>>) -> Result<Vec<ConfigEntry>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_config()
        .map_err(|error| error.to_string())?
        .into_iter()
        .map(|entry| {
            let value = decode_and_migrate(&db, &entry.key, entry.value)?;
            Ok(ConfigEntry {
                key: entry.key,
                value,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn migrates_legacy_plaintext_secret_on_read() {
        let db = Database::in_memory().expect("creates db");
        db.set_config("service.asrApiKey", "legacy-secret")
            .expect("stores legacy value");

        let value = decode_and_migrate(&db, "service.asrApiKey", "legacy-secret".to_string())
            .expect("migrates");

        assert_eq!(value, "legacy-secret");
        let stored = db
            .get_config("service.asrApiKey")
            .expect("reads")
            .expect("exists");
        assert!(is_encrypted_secret(&stored));
        assert!(!stored.contains("legacy-secret"));
    }
}
