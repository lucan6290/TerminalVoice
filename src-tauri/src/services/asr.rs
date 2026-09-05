use crate::services::asr_cloud::{CloudAsrConfig, CloudAsrProvider};
use crate::services::asr_offline::OfflineAsrEngine;
use crate::services::model_manager::ModelManager;
use crate::services::recorder::AudioBuffer;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AsrResult {
    pub text: String,
    pub provider: String,
}

pub trait AsrProvider {
    fn transcribe(&self, audio: &AudioBuffer) -> Result<AsrResult, String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AsrMode {
    Auto,
    Cloud,
    Offline,
}

impl AsrMode {
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("cloud") => Self::Cloud,
            Some("offline") => Self::Offline,
            _ => Self::Auto,
        }
    }
}

pub struct OfflineAsrProvider {
    model_path: Option<PathBuf>,
}

impl OfflineAsrProvider {
    pub fn new() -> Self {
        Self { model_path: None }
    }

    pub fn with_model(path: PathBuf) -> Self {
        Self {
            model_path: Some(path),
        }
    }
}

impl Default for OfflineAsrProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl AsrProvider for OfflineAsrProvider {
    fn transcribe(&self, audio: &AudioBuffer) -> Result<AsrResult, String> {
        let path = match &self.model_path {
            Some(p) => p,
            None => {
                return Err("离线语音模型尚未安装，请在服务配置中下载模型".to_string());
            }
        };
        let engine = OfflineAsrEngine::load_model(path)?;
        let text = engine.transcribe(audio)?;
        Ok(AsrResult {
            text,
            provider: "offline".to_string(),
        })
    }
}

pub fn transcribe(
    mode: AsrMode,
    cloud_config: Option<CloudAsrConfig>,
    audio: &AudioBuffer,
    app: &AppHandle,
) -> Result<AsrResult, String> {
    match mode {
        AsrMode::Cloud => cloud_config
            .ok_or_else(|| "云端 ASR 配置不完整".to_string())
            .and_then(|config| CloudAsrProvider::new(config)?.transcribe(audio)),
        AsrMode::Offline => {
            let provider = match ModelManager::get_installed_model_path(app) {
                Some(path) => OfflineAsrProvider::with_model(path),
                None => OfflineAsrProvider::new(),
            };
            provider.transcribe(audio)
        }
        AsrMode::Auto => {
            let cloud_error = match cloud_config {
                Some(config) => match CloudAsrProvider::new(config) {
                    Ok(provider) => match provider.transcribe(audio) {
                        Ok(result) => return Ok(result),
                        Err(error) => error,
                    },
                    Err(error) => error,
                },
                None => "云端 ASR 配置不完整".to_string(),
            };
            let provider = match ModelManager::get_installed_model_path(app) {
                Some(path) => OfflineAsrProvider::with_model(path),
                None => OfflineAsrProvider::new(),
            };
            provider
                .transcribe(audio)
                .map_err(|offline_error| {
                    format!("云端识别失败: {cloud_error}；离线降级失败: {offline_error}")
                })
        }
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
    fn offline_provider_reports_missing_model() {
        let provider = OfflineAsrProvider::new();
        let error = provider.transcribe(&audio()).expect_err("missing model");
        assert!(error.contains("离线语音模型"));
    }

    #[test]
    fn offline_provider_with_model_attempts_transcription() {
        let dir = tempfile::tempdir().expect("creates temp dir");
        let model_path = dir.path().join("whisper-tiny.bin");
        std::fs::write(&model_path, b"fake model data").expect("writes model file");
        let provider = OfflineAsrProvider::with_model(model_path);
        let error = provider.transcribe(&audio()).expect_err("not implemented");
        assert!(error.contains("离线推理引擎尚未实现"));
    }

    #[test]
    fn parses_unknown_mode_as_auto() {
        assert_eq!(AsrMode::parse(Some("cloud")), AsrMode::Cloud);
        assert_eq!(AsrMode::parse(Some("offline")), AsrMode::Offline);
        assert_eq!(AsrMode::parse(Some("unexpected")), AsrMode::Auto);
    }
}
