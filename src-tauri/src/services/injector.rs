use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

/// 首选 Enigo 快速文本输入；失败时使用剪贴板 + Ctrl+V。
pub fn inject_text(text: &str) -> Result<(), String> {
    if text.is_empty() {
        return Ok(());
    }
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|error| format!("无法初始化文本注入器: {error}"))?;
    match enigo.text(text) {
        Ok(()) => Ok(()),
        Err(primary) => {
            let mut clipboard = Clipboard::new().map_err(|error| {
                format!("文本注入失败且无法访问剪贴板: {error}; 原因: {primary}")
            })?;
            clipboard.set_text(text).map_err(|error| {
                format!("文本注入失败且无法写入剪贴板: {error}; 原因: {primary}")
            })?;
            enigo
                .key(Key::Control, Direction::Press)
                .map_err(|error| error.to_string())?;
            enigo
                .key(Key::Unicode('v'), Direction::Click)
                .map_err(|error| error.to_string())?;
            enigo
                .key(Key::Control, Direction::Release)
                .map_err(|error| error.to_string())?;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_text_is_a_noop() {
        assert!(inject_text("").is_ok());
    }
}
