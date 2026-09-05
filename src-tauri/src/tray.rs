use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let show_panel = MenuItem::with_id(app, "show_panel", "打开面板", true, None::<&str>)
        .map_err(|e| format!("failed to create menu item: {e}"))?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
        .map_err(|e| format!("failed to create menu item: {e}"))?;

    let menu = Menu::with_items(app, &[&show_panel, &quit])
        .map_err(|e| format!("failed to create menu: {e}"))?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("default icon"))
        .tooltip("TerminalVoice")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show_panel" => {
                if let Some(panel) = app.get_webview_window("panel") {
                    let _ = panel.show();
                    let _ = panel.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)
        .map_err(|e| format!("failed to create tray icon: {e}"))?;

    Ok(())
}
