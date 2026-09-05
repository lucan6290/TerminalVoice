/// Offline ASR engine stub.
///
/// This module provides the structure for offline (on-device) speech
/// recognition. The actual inference engine is not yet implemented —
/// `transcribe` returns an error indicating future availability.
use crate::services::recorder::AudioBuffer;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelMetadata {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug)]
pub struct OfflineAsrEngine {
    metadata: ModelMetadata,
}

impl OfflineAsrEngine {
    /// Load a model from the given file path.
    ///
    /// This validates that the file exists and reads basic metadata,
    /// but does not perform any actual model parsing (not yet implemented).
    pub fn load_model(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Err(format!("模型文件不存在: {}", path.display()));
        }
        let metadata = path
            .metadata()
            .map_err(|e| format!("无法读取模型文件信息: {e}"))?;
        let name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        Ok(Self {
            metadata: ModelMetadata {
                name,
                path: path.display().to_string(),
                size_bytes: metadata.len(),
                sha256: String::new(),
            },
        })
    }

    /// Transcribe audio using the loaded model.
    ///
    /// **Not yet implemented** — returns an error indicating the engine
    /// is awaiting future development.
    pub fn transcribe(&self, _audio: &AudioBuffer) -> Result<String, String> {
        Err("离线推理引擎尚未实现，请等待后续版本".to_string())
    }

    pub fn metadata(&self) -> &ModelMetadata {
        &self.metadata
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn audio() -> AudioBuffer {
        AudioBuffer {
            samples: vec![0.0; 16_000],
            sample_rate: 16_000,
            duration: Duration::from_secs(1),
        }
    }

    #[test]
    fn load_model_fails_for_nonexistent_path() {
        let result = OfflineAsrEngine::load_model(Path::new("/nonexistent/model.bin"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("模型文件不存在"));
    }

    #[test]
    fn load_model_succeeds_for_existing_file() {
        let dir = tempfile::tempdir().expect("creates temp dir");
        let model_path = dir.path().join("whisper-tiny.bin");
        std::fs::write(&model_path, b"fake model data").expect("writes model file");
        let engine = OfflineAsrEngine::load_model(&model_path).expect("loads model");
        assert_eq!(engine.metadata().name, "whisper-tiny");
        assert_eq!(engine.metadata().size_bytes, 15);
    }

    #[test]
    fn transcribe_returns_not_implemented_error() {
        let dir = tempfile::tempdir().expect("creates temp dir");
        let model_path = dir.path().join("whisper-base.bin");
        std::fs::write(&model_path, b"fake model data").expect("writes model file");
        let engine = OfflineAsrEngine::load_model(&model_path).expect("loads model");
        let result = engine.transcribe(&audio());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("离线推理引擎尚未实现"));
    }
}
