use crate::services::recorder::list_input_devices;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AudioInputDevice {
    pub name: String,
}

#[tauri::command]
pub fn list_audio_input_devices() -> Result<Vec<AudioInputDevice>, String> {
    list_input_devices().map(|devices| {
        devices
            .into_iter()
            .map(|name| AudioInputDevice { name })
            .collect()
    })
}
