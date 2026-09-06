//! 文本翻译模块
//!
//! 使用 LLM 进行文本翻译，支持指定目标语言。

use crate::services::llm::{LlmClient, LlmConfig};
use tracing::{error, info};

/// 默认目标语言
const DEFAULT_TARGET_LANG: &str = "英文";

/// 解析目标语言，空值返回默认
fn resolve_target_lang(target_lang: &str) -> &str {
    let trimmed = target_lang.trim();
    if trimmed.is_empty() {
        DEFAULT_TARGET_LANG
    } else {
        trimmed
    }
}

/// 将文本翻译为指定语言
///
/// `target_lang` 为目标语言名称（如 "英文"、"中文"、"日文"等）。
/// 如果 `target_lang` 为空，则使用默认值（英文）。
pub fn translate(text: &str, target_lang: &str, config: &LlmConfig) -> Result<String, String> {
    if text.trim().is_empty() {
        return Ok(String::new());
    }
    let lang = resolve_target_lang(target_lang);
    info!(
        target_lang = %lang,
        text_len = text.chars().count(),
        "翻译请求开始"
    );
    let client = LlmClient::new(config.clone()).map_err(|e| {
        error!(error = %e, "翻译客户端初始化失败");
        e
    })?;
    match client.translate(text, lang) {
        Ok(result) => {
            info!(
                output_len = result.chars().count(),
                "翻译完成"
            );
            Ok(result)
        }
        Err(e) => {
            error!(error = %e, "翻译请求失败");
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zeroize::Zeroizing;

    fn test_config() -> LlmConfig {
        LlmConfig {
            endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            api_key: Zeroizing::new("test-key".to_string()),
            model: "test-model".to_string(),
        }
    }

    #[test]
    fn test_translate_empty_text_returns_empty() {
        let config = test_config();
        assert_eq!(translate("", "英文", &config).unwrap(), "");
        assert_eq!(translate("   ", "中文", &config).unwrap(), "");
    }

    #[test]
    fn test_resolve_target_lang_uses_default_when_empty() {
        assert_eq!(resolve_target_lang(""), DEFAULT_TARGET_LANG);
        assert_eq!(resolve_target_lang("   "), DEFAULT_TARGET_LANG);
        assert_eq!(resolve_target_lang("中文"), "中文");
    }

    #[test]
    fn test_translate_with_empty_api_key_returns_error() {
        let config = LlmConfig {
            endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            api_key: Zeroizing::new(String::new()),
            model: "test-model".to_string(),
        };
        assert!(translate("hello", "中文", &config).is_err());
    }
}
