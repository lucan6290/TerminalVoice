use arboard::Clipboard;

/// Backs up the current clipboard text content.
/// Returns Some(text) if clipboard had text, None otherwise.
pub fn backup_clipboard() -> Option<String> {
    match Clipboard::new() {
        Ok(mut cb) => cb.get_text().ok(),
        Err(_) => None,
    }
}

/// Restores clipboard text content after a delay.
/// If content is None, does nothing.
pub fn restore_clipboard(content: Option<String>) {
    if let Some(text) = content {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Ok(mut cb) = Clipboard::new() {
                let _ = cb.set_text(text);
            }
        });
    }
}
