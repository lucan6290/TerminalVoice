use crate::services::asr_cloud::{CloudAsrConfig, CloudAsrProvider};
use crate::services::recorder::AudioBuffer;

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

pub struct OfflineAsrProvider;

impl AsrProvider for OfflineAsrProvider {
    fn transcribe(&self, _audio: &AudioBuffer) -> Result<AsrResult, String> {
        Err("离线语音模型尚未安装，请在服务配置中下载模型".to_string())
    }
}

pub fn transcribe(
    mode: AsrMode,
    cloud_config: Option<CloudAsrConfig>,
    audio: &AudioBuffer,
) -> Result<AsrResult, String> {
    match mode {
        AsrMode::Cloud => cloud_config
            .ok_or_else(|| "云端 ASR 配置不完整".to_string())
            .and_then(|config| CloudAsrProvider::new(config)?.transcribe(audio)),
        AsrMode::Offline => OfflineAsrProvider.transcribe(audio),
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
            OfflineAsrProvider
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
        let error = transcribe(AsrMode::Offline, None, &audio()).expect_err("missing model");
        assert!(error.contains("离线语音模型"));
    }

    #[test]
    fn parses_unknown_mode_as_auto() {
        assert_eq!(AsrMode::parse(Some("cloud")), AsrMode::Cloud);
        assert_eq!(AsrMode::parse(Some("offline")), AsrMode::Offline);
        assert_eq!(AsrMode::parse(Some("unexpected")), AsrMode::Auto);
    }
}
