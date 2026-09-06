use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let show_panel = MenuItem::with_id(app, "show_panel", "打开面板", true, None::<&str>)
        .map_err(|e| format!("创建\"打开面板\"菜单项失败: {e}"))?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
        .map_err(|e| format!("创建\"退出\"菜单项失败: {e}"))?;

    let menu = Menu::with_items(app, &[&show_panel, &quit])
        .map_err(|e| format!("创建托盘菜单失败: {e}"))?;

    // 从默认窗口图标获取托盘图标，避免 expect panic
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "默认窗口图标未加载，请检查 icons/icon.ico 是否存在".to_string())?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("TerminalVoice")
        .menu(&menu)
        // 左键单击托盘图标 → 显示面板
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                show_panel_window(app);
            }
        })
        // 右键菜单点击
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show_panel" => show_panel_window(app),
            "quit" => {
                tracing::info!("用户通过托盘菜单退出应用");
                app.exit(0);
            }
            other => {
                tracing::warn!("未处理的托盘菜单项: {other}");
            }
        })
        .build(app)
        .map_err(|e| format!("创建托盘图标失败: {e}"))?;

    tracing::info!("系统托盘图标已创建");
    Ok(())
}

/// 显示并聚焦面板窗口
fn show_panel_window(app: &AppHandle) {
    let Some(panel) = app.get_webview_window("panel") else {
        tracing::error!("找不到 panel 窗口，无法显示面板");
        return;
    };
    if let Err(e) = panel.show() {
        tracing::error!("显示 panel 窗口失败: {e}");
        return;
    }
    if let Err(e) = panel.set_focus() {
        tracing::warn!("聚焦 panel 窗口失败: {e}");
    }
}
