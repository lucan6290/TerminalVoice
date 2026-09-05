#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextMode {
    Normal,
    Developer,
    Raw,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreprocessConfig {
    pub mode: TextMode,
    pub add_punctuation: bool,
    pub filter_words: bool,
    pub single_line: bool,
    pub custom_filter_words: Vec<String>,
}

impl Default for PreprocessConfig {
    fn default() -> Self {
        Self {
            mode: TextMode::Normal,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        }
    }
}

pub const DEFAULT_FILTER_WORDS: &[&str] = &[
    "嗯",
    "啊",
    "呃",
    "哦",
    "那个",
    "这个",
    "就是",
    "然后",
    "反正",
    "就是说",
];

pub fn process_text(raw: &str, config: &PreprocessConfig) -> String {
    let mut text = raw.to_string();

    if config.mode == TextMode::Raw {
        return text;
    }

    if config.filter_words && config.mode == TextMode::Normal {
        text = remove_filter_words(&text, config);
    }

    if config.single_line {
        text = normalize_single_line(&text);
    }

    if config.add_punctuation && config.mode == TextMode::Normal {
        text = add_terminal_punctuation(&text);
    }

    text.trim().to_string()
}

pub fn process_normal_text(raw: &str) -> String {
    process_text(raw, &PreprocessConfig::default())
}

fn remove_filter_words(text: &str, config: &PreprocessConfig) -> String {
    let mut result = text.to_string();
    let mut words: Vec<String> = DEFAULT_FILTER_WORDS.iter().map(|w| w.to_string()).collect();
    words.extend(config.custom_filter_words.iter().cloned());
    words.sort_by_key(|a| std::cmp::Reverse(a.chars().count()));

    for word in words {
        result = result.replace(&word, "");
    }

    result
}

fn normalize_single_line(text: &str) -> String {
    text.replace("\r\n", " ")
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn add_terminal_punctuation(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let last = trimmed.chars().last().unwrap();
    if matches!(last, '。' | '！' | '？' | '.' | '!' | '?') {
        trimmed.to_string()
    } else {
        format!("{}。", trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_mode_filters_default_words_and_normalizes_to_single_line() {
        let config = PreprocessConfig::default();

        let result = process_text("嗯 这个  请帮我\n修改   这个函数", &config);

        assert_eq!(result, "请帮我 修改 函数。");
    }

    #[test]
    fn developer_mode_keeps_filler_words_but_normalizes_line_breaks() {
        let config = PreprocessConfig {
            mode: TextMode::Developer,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        };

        let result = process_text("然后 cargo\n test   这个命令", &config);

        assert_eq!(result, "然后 cargo test 这个命令");
    }

    #[test]
    fn raw_mode_returns_original_text_without_trimming() {
        let config = PreprocessConfig {
            mode: TextMode::Raw,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        };

        let result = process_text("  嗯 第一行\n第二行  ", &config);

        assert_eq!(result, "  嗯 第一行\n第二行  ");
    }

    #[test]
    fn custom_filter_words_are_removed_in_normal_mode() {
        let config = PreprocessConfig {
            custom_filter_words: vec!["拜托".to_string()],
            ..PreprocessConfig::default()
        };

        let result = process_text("拜托 帮我重构", &config);

        assert_eq!(result, "帮我重构。");
    }

    #[test]
    fn existing_terminal_punctuation_is_preserved() {
        let config = PreprocessConfig::default();

        let result = process_text("请解释这个错误？", &config);

        assert_eq!(result, "请解释错误？");
    }
}
