use crate::services::db::Database;
use crate::services::events;
use crate::services::paths;
use crate::services::pipeline::{PipelineControl, PipelineHandle};
use crate::services::secrets::{decode_config_value, encode_config_value};
use crate::services::skills;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuEvent, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tracing::{error, info, warn};

// ── 菜单项 ID 常量 ──────────────────────────────────────────────
mod ids {
    pub const SHOW_PANEL: &str = "show_panel";
    pub const SHOW_SETTINGS: &str = "show_settings";
    pub const SHOW_HISTORY: &str = "show_history";
    pub const PAUSE_LISTENING: &str = "pause_listening";
    pub const TOGGLE_BALL: &str = "toggle_ball";
    pub const AUTOSTART: &str = "autostart";
    pub const TOGGLE_THEME: &str = "toggle_theme";
    pub const OPEN_LOGS: &str = "open_logs";
    pub const CHECK_UPDATE: &str = "check_update";
    pub const ABOUT: &str = "about";
    pub const QUIT: &str = "quit";

    // 技能子菜单 ID 前缀
    pub const SKILL_PREFIX: &str = "skill_";
    pub const SKILL_DEFAULT: &str = "skill_default"; // 默认 AI 整理（无技能）
}

use ids::*;

/// 托盘菜单所需的各个可开关菜单项引用（便于后续更新勾选状态/文案）。
struct TrayMenuItems {
    pause_item: tauri::menu::CheckMenuItem<tauri::Wry>,
    autostart_item: tauri::menu::CheckMenuItem<tauri::Wry>,
    ball_item: tauri::menu::CheckMenuItem<tauri::Wry>,
    theme_item: tauri::menu::MenuItem<tauri::Wry>,
    skill_default_item: tauri::menu::CheckMenuItem<tauri::Wry>,
    skill_items: Vec<tauri::menu::CheckMenuItem<tauri::Wry>>,
}

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    // ── 菜单 ────────────────────────────────────────────────────
    let show_panel = MenuItemBuilder::with_id(SHOW_PANEL, "打开面板")
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;
    let show_settings = MenuItemBuilder::with_id(SHOW_SETTINGS, "打开设置…")
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;
    let show_history = MenuItemBuilder::with_id(SHOW_HISTORY, "查看历史记录…")
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;

    // 暂停监听（CheckMenuItem）
    let pause_item = tauri::menu::CheckMenuItemBuilder::with_id(PAUSE_LISTENING, "暂停语音监听")
        .checked(false)
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;

    // 技能切换子菜单
    let (skill_menu, skill_default_item, skill_items) = build_skill_submenu(app)?;

    // 悬浮球显隐（CheckMenuItem）
    let ball_visible = is_ball_visible(app);
    let ball_item = tauri::menu::CheckMenuItemBuilder::with_id(TOGGLE_BALL, "显示悬浮球")
        .checked(ball_visible)
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;

    // 开机自启（CheckMenuItem）
    let autostart_enabled = is_autostart_enabled(app);
    let autostart_item = tauri::menu::CheckMenuItemBuilder::with_id(AUTOSTART, "开机自启")
        .checked(autostart_enabled)
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;

    // 深色/浅色主题（点击切换文字）
    let is_dark = read_config_bool(app, "ui.dark", true);
    let theme_item = MenuItemBuilder::with_id(
        TOGGLE_THEME,
        if is_dark { "切换为浅色主题" } else { "切换为深色主题" },
    )
    .build(app)
    .map_err(|e| format!("创建菜单项失败: {e}"))?;

    let open_logs = MenuItemBuilder::with_id(OPEN_LOGS, "打开日志目录")
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;
    let check_update = MenuItemBuilder::with_id(CHECK_UPDATE, "检查更新…")
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;
    let about = MenuItemBuilder::with_id(ABOUT, "关于 TerminalVoice")
        .build(app)
        .map_err(|e| format!("创建菜单项失败: {e}"))?;
    let quit = PredefinedMenuItem::quit(app, Some("退出"))
        .map_err(|e| format!("创建退出菜单项失败: {e}"))?;

    let separator = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("创建分隔符失败: {e}"))?;
    let separator2 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("创建分隔符失败: {e}"))?;
    let separator3 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("创建分隔符失败: {e}"))?;

    let menu = Menu::with_items(
        app,
        &[
            &show_panel,
            &show_settings,
            &show_history,
            &separator,
            &pause_item,
            &skill_menu,
            &separator2,
            &ball_item,
            &autostart_item,
            &theme_item,
            &open_logs,
            &separator3,
            &check_update,
            &about,
            &quit,
        ],
    )
    .map_err(|e| format!("创建托盘菜单失败: {e}"))?;

    let items = TrayMenuItems {
        pause_item: pause_item.clone(),
        autostart_item: autostart_item.clone(),
        ball_item: ball_item.clone(),
        theme_item: theme_item.clone(),
        skill_default_item: skill_default_item.clone(),
        skill_items: skill_items.clone(),
    };

    // ── 图标 ────────────────────────────────────────────────────
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "默认窗口图标未加载，请检查 icons/icon.ico 是否存在".to_string())?;

    // ── 构建 TrayIcon ──────────────────────────────────────────
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("TerminalVoice")
        .menu(&menu)
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
        .on_menu_event(move |app, event| {
            handle_menu_event(app, &items, event);
        })
        .build(app)
        .map_err(|e| format!("创建托盘图标失败: {e}"))?;

    info!("系统托盘图标已创建");
    Ok(())
}

/// 构建「语音技能」子菜单，当前激活技能打勾。
fn build_skill_submenu(
    app: &AppHandle,
) -> Result<
    (
        tauri::menu::Submenu<tauri::Wry>,
        tauri::menu::CheckMenuItem<tauri::Wry>,
        Vec<tauri::menu::CheckMenuItem<tauri::Wry>>,
    ),
    String,
> {
    let active_id = read_config(app, "service.activeSkill").unwrap_or_default();
    let default_item = tauri::menu::CheckMenuItemBuilder::with_id(SKILL_DEFAULT, "AI 整理（默认）")
        .checked(active_id.trim().is_empty())
        .build(app)
        .map_err(|e| format!("创建技能菜单项失败: {e}"))?;

    let mut checks: Vec<tauri::menu::CheckMenuItem<tauri::Wry>> = Vec::new();
    for skill in skills::list_skills() {
        let item_id = format!("{}{}", SKILL_PREFIX, skill.id);
        let checked = active_id == skill.id;
        let item = tauri::menu::CheckMenuItemBuilder::with_id(&item_id, &skill.name)
            .checked(checked)
            .build(app)
            .map_err(|e| format!("创建技能菜单项失败: {e}"))?;
        checks.push(item);
    }

    let mut builder = SubmenuBuilder::new(app, "语音技能");
    builder = builder.item(&default_item);
    if !checks.is_empty() {
        builder = builder.separator();
        for c in &checks {
            builder = builder.item(c);
        }
    }
    let submenu = builder
        .build()
        .map_err(|e| format!("创建技能子菜单失败: {e}"))?;
    Ok((submenu, default_item, checks))
}

/// 托盘菜单事件分发。
fn handle_menu_event(
    app: &AppHandle,
    items: &TrayMenuItems,
    event: MenuEvent,
) {
    let id = event.id().as_ref();
    match id {
        SHOW_PANEL => show_panel_window(app),
        SHOW_SETTINGS => show_main_window(app, None),
        SHOW_HISTORY => {
            show_panel_window(app);
            let _ = app.emit("tray-navigate", serde_json::json!({ "tab": "history" }));
        }
        PAUSE_LISTENING => toggle_pause(app, items),
        TOGGLE_BALL => toggle_ball_visibility(app, items),
        AUTOSTART => toggle_autostart(app, items),
        TOGGLE_THEME => toggle_theme(app, items),
        OPEN_LOGS => open_logs_dir(app),
        CHECK_UPDATE => check_for_update(app),
        ABOUT => show_main_window(app, Some("about")),
        QUIT => {
            info!("用户通过托盘菜单退出应用");
            app.exit(0);
        }
        other => {
            if let Some(skill_id) = other.strip_prefix(SKILL_PREFIX) {
                set_active_skill(app, items, skill_id);
            } else {
                warn!("未处理的托盘菜单项: {other}");
            }
        }
    }
}

// ── 各功能实现 ────────────────────────────────────────────────

fn toggle_pause(app: &AppHandle, items: &TrayMenuItems) {
    let handle = app.state::<PipelineHandle>();
    let paused = handle.is_paused();
    let cmd = if paused {
        PipelineControl::Resume
    } else {
        PipelineControl::Pause
    };
    if let Err(e) = handle.send(cmd) {
        error!("发送管线控制指令失败: {e}");
        events::emit_toast(app, "error", format!("切换监听状态失败: {e}"));
        return;
    }
    let _ = items.pause_item.set_checked(!paused);
    let _ = items
        .pause_item
        .set_text(if paused { "暂停语音监听" } else { "恢复语音监听" });
}

fn toggle_ball_visibility(app: &AppHandle, items: &TrayMenuItems) {
    let Some(ball) = app.get_webview_window("ball") else {
        error!("找不到 ball 窗口");
        return;
    };
    let currently_visible = ball.is_visible().unwrap_or(true);
    let result = if currently_visible {
        ball.hide()
    } else {
        ball.show()
    };
    if let Err(e) = result {
        error!("切换悬浮球显隐失败: {e}");
        events::emit_toast(app, "error", format!("切换悬浮球失败: {e}"));
        return;
    }
    let _ = items.ball_item.set_checked(!currently_visible);
    write_config(app, "ui.ballVisible", if currently_visible { "false" } else { "true" });
}

fn toggle_autostart(app: &AppHandle, items: &TrayMenuItems) {
    let autostart_manager = app.autolaunch();
    let current = autostart_manager.is_enabled().unwrap_or(false);
    let result = if current {
        autostart_manager.disable()
    } else {
        autostart_manager.enable()
    };
    if let Err(e) = result {
        error!("切换开机自启失败: {e}");
        events::emit_toast(app, "error", format!("切换开机自启失败: {e}"));
        return;
    }
    let new_state = !current;
    let _ = items.autostart_item.set_checked(new_state);
    write_config(app, "ui.autoStart", if new_state { "true" } else { "false" });
    events::emit_toast(
        app,
        "info",
        if new_state {
            "已开启开机自启"
        } else {
            "已关闭开机自启"
        },
    );
}

fn toggle_theme(app: &AppHandle, items: &TrayMenuItems) {
    let current_dark = read_config_bool(app, "ui.dark", true);
    let new_dark = !current_dark;
    write_config(app, "ui.dark", if new_dark { "true" } else { "false" });
    let _ = items.theme_item.set_text(if new_dark {
        "切换为浅色主题"
    } else {
        "切换为深色主题"
    });
    // 通知前端刷新（三窗口都会收到）
    let _ = app.emit(
        "config-updated",
        serde_json::json!({ "key": "ui.dark", "value": new_dark.to_string() }),
    );
}

fn open_logs_dir(app: &AppHandle) {
    let dir = paths::logs_dir();
    if let Err(e) = std::fs::create_dir_all(&dir) {
        error!("创建日志目录失败: {e}");
        events::emit_toast(app, "error", format!("无法打开日志目录: {e}"));
        return;
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer").arg(&dir).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&dir).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&dir).spawn();
    }
    info!("已打开日志目录: {}", dir.display());
}

fn check_for_update(app: &AppHandle) {
    show_main_window(app, None);
    let _ = app.emit("tray-check-update", ());
}

fn set_active_skill(
    app: &AppHandle,
    items: &TrayMenuItems,
    skill_id: &str,
) {
    // SKILL_DEFAULT 点击 → id 为 "default"，映射为空（AI 整理）
    let (value, label) = if skill_id == "default" {
        (String::new(), "AI 整理（默认）".to_string())
    } else if let Some(skill) = skills::find_skill(skill_id) {
        (skill.id.clone(), skill.name.clone())
    } else {
        warn!("未知技能 ID: {skill_id}");
        return;
    };

    {
        let db_state = app.state::<Mutex<Database>>();
        let db = match db_state.lock() {
            Ok(guard) => guard,
            Err(e) => {
                error!("数据库锁失败: {e}");
                events::emit_toast(app, "error", format!("切换技能失败: {e}"));
                return;
            }
        };
        if let Err(e) = db.set_config("service.activeSkill", &value) {
            error!("保存技能配置失败: {e}");
            events::emit_toast(app, "error", format!("切换技能失败: {e}"));
            return;
        }
    }

    // 即时更新菜单项勾选状态
    let is_default = value.trim().is_empty();
    let _ = items.skill_default_item.set_checked(is_default);
    for c in &items.skill_items {
        let id_str = c.id().as_ref().to_string();
        let cid = id_str.strip_prefix(SKILL_PREFIX).unwrap_or("");
        let _ = c.set_checked(cid == value);
    }

    let _ = app.emit(
        "config-updated",
        serde_json::json!({ "key": "service.activeSkill", "value": value }),
    );
    events::emit_toast(app, "info", format!("已切换技能：{label}"));
}

// ── 窗口操作 ──────────────────────────────────────────────────

/// 显示并聚焦面板窗口。
fn show_panel_window(app: &AppHandle) {
    let Some(panel) = app.get_webview_window("panel") else {
        error!("找不到 panel 窗口，无法显示面板");
        return;
    };
    if let Err(e) = panel.show() {
        error!("显示 panel 窗口失败: {e}");
        return;
    }
    if let Err(e) = panel.set_focus() {
        warn!("聚焦 panel 窗口失败: {e}");
    }
}

/// 显示主窗口（设置页）。
/// `section`: 可选的要高亮的区块（如 "about"），前端根据 `tray-navigate` 事件处理。
fn show_main_window(app: &AppHandle, section: Option<&str>) {
    let Some(main) = app.get_webview_window("main") else {
        error!("找不到 main 窗口");
        return;
    };
    if let Err(e) = main.show() {
        error!("显示 main 窗口失败: {e}");
        return;
    }
    if let Err(e) = main.set_focus() {
        warn!("聚焦 main 窗口失败: {e}");
    }
    if let Some(sec) = section {
        let _ = app.emit(
            "tray-navigate",
            serde_json::json!({ "section": sec }),
        );
    }
}

// ── 辅助函数 ──────────────────────────────────────────────────

fn is_ball_visible(app: &AppHandle) -> bool {
    app.get_webview_window("ball")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(true)
}

fn is_autostart_enabled(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

fn read_config(app: &AppHandle, key: &str) -> Option<String> {
    let db_state = app.state::<Mutex<Database>>();
    let db = db_state.lock().ok()?;
    let stored = db.get_config(key).ok().flatten()?;
    decode_config_value(key, &stored).ok()
}

fn read_config_bool(app: &AppHandle, key: &str, default: bool) -> bool {
    read_config(app, key)
        .map(|v| v == "true" || v == "1")
        .unwrap_or(default)
}

fn write_config(app: &AppHandle, key: &str, raw_value: &str) {
    let stored = match encode_config_value(key, raw_value) {
        Ok(s) => s,
        Err(e) => {
            error!("编码配置失败 {key}: {e}");
            return;
        }
    };
    let db_state = app.state::<Mutex<Database>>();
    let db = match db_state.lock() {
        Ok(guard) => guard,
        Err(e) => {
            error!("数据库锁失败 {key}: {e}");
            return;
        }
    };
    if let Err(e) = db.set_config(key, &stored) {
        error!("保存配置失败 {key}: {e}");
    }
}

// 消除 MacosLauncher 未用警告（只在 macOS 上有实际用途）
#[allow(dead_code)]
fn _unused_launcher() -> MacosLauncher {
    MacosLauncher::LaunchAgent
}
