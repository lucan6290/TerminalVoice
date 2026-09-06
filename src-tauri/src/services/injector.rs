use crate::services::clipboard;
use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use tracing::{error, info, warn};

/// 首选 Enigo 快速文本输入；失败时使用剪贴板 + Ctrl+V。
pub fn inject_text(text: &str) -> Result<(), String> {
    if text.is_empty() {
        return Ok(());
    }
    info!("开始文本注入，文本长度: {} 字符", text.len());
    let mut enigo = Enigo::new(&Settings::default()).map_err(|error| {
        error!("无法初始化文本注入器: {error}");
        format!("无法初始化文本注入器: {error}")
    })?;
    match enigo.text(text) {
        Ok(()) => {
            info!("enigo 文本注入成功，文本长度: {} 字符", text.len());
            Ok(())
        }
        Err(primary) => {
            warn!("enigo 注入失败，尝试剪贴板回退: {primary}");
            let mut cb = Clipboard::new().map_err(|error| {
                error!("文本注入失败且无法访问剪贴板: {error}; 原因: {primary}");
                format!("文本注入失败且无法访问剪贴板: {error}; 原因: {primary}")
            })?;
            let backup = clipboard::backup_clipboard();
            cb.set_text(text).map_err(|error| {
                error!("文本注入失败且无法写入剪贴板: {error}; 原因: {primary}");
                format!("文本注入失败且无法写入剪贴板: {error}; 原因: {primary}")
            })?;
            enigo
                .key(Key::Control, Direction::Press)
                .map_err(|error| {
                    error!("剪贴板回退：按下 Ctrl 失败: {error}");
                    error.to_string()
                })?;
            enigo
                .key(Key::Unicode('v'), Direction::Click)
                .map_err(|error| {
                    error!("剪贴板回退：发送 V 键失败: {error}");
                    error.to_string()
                })?;
            enigo
                .key(Key::Control, Direction::Release)
                .map_err(|error| {
                    error!("剪贴板回退：释放 Ctrl 失败: {error}");
                    error.to_string()
                })?;
            clipboard::restore_clipboard(backup);
            info!("剪贴板回退注入成功，文本长度: {} 字符", text.len());
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
