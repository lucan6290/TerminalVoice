/// Model manager for offline ASR models.
///
/// Manages model files stored in `app_data_dir/models/`. Supports listing
/// predefined models, downloading, deleting, and verifying integrity.
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MODELS_DIR: &str = "models";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub download_url: String,
    pub installed: bool,
}

pub struct ModelManager;

fn predefined_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "whisper-tiny".to_string(),
            name: "Whisper Tiny".to_string(),
            size_bytes: 75_000_000,
            sha256: "placeholder-sha256-tiny".to_string(),
            download_url: "https://huggingface.co/openai/whisper-tiny/resolve/main/model.bin"
                .to_string(),
            installed: false,
        },
        ModelInfo {
            id: "whisper-base".to_string(),
            name: "Whisper Base".to_string(),
            size_bytes: 142_000_000,
            sha256: "placeholder-sha256-base".to_string(),
            download_url: "https://huggingface.co/openai/whisper-base/resolve/main/model.bin"
                .to_string(),
            installed: false,
        },
    ]
}

fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取数据目录: {e}"))?;
    Ok(data_dir.join(MODELS_DIR))
}

impl ModelManager {
    /// Returns the predefined model list with installed status.
    pub fn list_models(app: &AppHandle) -> Vec<ModelInfo> {
        let models_dir = get_models_dir(app);
        predefined_models()
            .into_iter()
            .map(|mut m| {
                m.installed = models_dir
                    .as_ref()
                    .map(|dir| dir.join(format!("{}.bin", m.id)).exists())
                    .unwrap_or(false);
                m
            })
            .collect()
    }

    /// Downloads a model file via WinHTTP GET.
    pub fn download_model(app: &AppHandle, model_id: &str) -> Result<PathBuf, String> {
        let model = predefined_models()
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("未找到模型: {model_id}"))?;

        let models_dir = get_models_dir(app)?;
        std::fs::create_dir_all(&models_dir)
            .map_err(|e| format!("无法创建模型目录: {e}"))?;

        let model_path = models_dir.join(format!("{model_id}.bin"));

        #[cfg(windows)]
        {
            let _bytes = crate::services::asr_cloud::download_file(
                &model.download_url,
                "",
                &model_path,
            )
            .map_err(|e| format!("下载模型失败: {}", e.message))?;

            if !Self::verify_model(&model_path, &model.sha256) {
                let _ = std::fs::remove_file(&model_path);
                return Err("模型文件校验失败".to_string());
            }
        }

        #[cfg(not(windows))]
        {
            let _ = model_path;
            return Err("模型下载仅支持 Windows".to_string());
        }

        Ok(model_path)
    }

    /// Deletes a model file.
    pub fn delete_model(app: &AppHandle, model_id: &str) -> Result<(), String> {
        let models_dir = get_models_dir(app)?;
        let model_path = models_dir.join(format!("{model_id}.bin"));
        if !model_path.exists() {
            return Err(format!("模型未安装: {model_id}"));
        }
        std::fs::remove_file(&model_path)
            .map_err(|e| format!("删除模型失败: {e}"))
    }

    /// Returns the expected model file path.
    pub fn get_model_path(app: &AppHandle, model_id: &str) -> PathBuf {
        let models_dir = get_models_dir(app).unwrap_or_else(|_| PathBuf::from("."));
        models_dir.join(format!("{model_id}.bin"))
    }

    /// Verifies model integrity via file existence and size check.
    ///
    /// SHA256 verification is not yet implemented; this currently checks
    /// that the file exists and has non-zero size.
    pub fn verify_model(path: &Path, _expected_sha256: &str) -> bool {
        path.exists()
            && path
                .metadata()
                .map(|m| m.len() > 0)
                .unwrap_or(false)
    }

    /// Returns the path of the first installed model, if any.
    pub fn get_installed_model_path(app: &AppHandle) -> Option<PathBuf> {
        let models = Self::list_models(app);
        let installed = models.iter().find(|m| m.installed)?;
        Some(Self::get_model_path(app, &installed.id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn predefined_models_contains_expected_entries() {
        let models = predefined_models();
        assert!(models.len() >= 2);
        assert!(models.iter().any(|m| m.id == "whisper-tiny"));
        assert!(models.iter().any(|m| m.id == "whisper-base"));
    }

    #[test]
    fn verify_model_accepts_existing_file() {
        let dir = tempfile::tempdir().expect("creates temp dir");
        let file_path = dir.path().join("model.bin");
        std::fs::write(&file_path, b"model data").expect("writes file");
        assert!(ModelManager::verify_model(&file_path, "any-sha256"));
    }

    #[test]
    fn verify_model_rejects_nonexistent_file() {
        assert!(!ModelManager::verify_model(
            Path::new("/nonexistent/model.bin"),
            "any-sha256"
        ));
    }

    #[test]
    fn verify_model_rejects_empty_file() {
        let dir = tempfile::tempdir().expect("creates temp dir");
        let file_path = dir.path().join("empty.bin");
        std::fs::write(&file_path, b"").expect("writes empty file");
        assert!(!ModelManager::verify_model(&file_path, "any-sha256"));
    }
}
