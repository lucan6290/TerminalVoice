use crate::services::model_manager::{ModelInfo, ModelManager};
use tauri::AppHandle;

#[tauri::command]
pub fn list_models(app: AppHandle) -> Result<Vec<ModelInfo>, String> {
    Ok(ModelManager::list_models(&app))
}

#[tauri::command]
pub fn download_model(app: AppHandle, model_id: String) -> Result<(), String> {
    ModelManager::download_model(&app, &model_id).map(|_| ())
}

#[tauri::command]
pub fn delete_model(app: AppHandle, model_id: String) -> Result<(), String> {
    ModelManager::delete_model(&app, &model_id)
}
