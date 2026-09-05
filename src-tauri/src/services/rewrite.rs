use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

/// Captures the currently selected text by simulating Ctrl+C and reading the clipboard.
/// Returns the captured text, or empty string if nothing is selected.
///
/// The flow:
/// 1. Backup current clipboard content
/// 2. Simulate Ctrl+C to copy selected text to clipboard
/// 3. Wait briefly for clipboard to update
/// 4. Read clipboard content
/// 5. Restore original clipboard content
pub fn capture_selected_text() -> String {
    let backup = super::clipboard::backup_clipboard();

    if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
        let _ = enigo.key(Key::Control, Direction::Press);
        let _ = enigo.key(Key::Unicode('c'), Direction::Click);
        let _ = enigo.key(Key::Control, Direction::Release);
    }

    std::thread::sleep(std::time::Duration::from_millis(100));

    let captured = Clipboard::new()
        .ok()
        .and_then(|mut cb| cb.get_text().ok())
        .unwrap_or_default();

    super::clipboard::restore_clipboard(backup);

    captured
}

/// Builds the LLM prompt for rewriting text based on voice instruction.
/// Returns the prompt string to send to the LLM.
pub fn build_rewrite_prompt(selected_text: &str, voice_instruction: &str) -> String {
    format!(
        "请根据以下语音指令改写选中的文本。\n\n选中文本：\n{selected_text}\n\n语音指令：\n{voice_instruction}\n\n请直接输出改写后的文本，不要添加任何解释或额外标记。"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_rewrite_prompt_contains_both_texts() {
        let prompt = build_rewrite_prompt("你好世界", "改成英文");
        assert!(prompt.contains("你好世界"));
        assert!(prompt.contains("改成英文"));
        assert!(prompt.contains("改写"));
    }

    #[test]
    fn build_rewrite_prompt_with_empty_instruction() {
        let prompt = build_rewrite_prompt("测试文本", "");
        assert!(prompt.contains("测试文本"));
    }
}
