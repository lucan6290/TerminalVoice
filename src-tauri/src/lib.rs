pub mod commands;
pub mod services;
pub mod state;
pub mod tray;

use services::db::Database;
use services::logging;
use services::paths;
use state::AppRuntime;
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // 第二实例启动时，显示面板窗口并聚焦
            let _ = app.get_webview_window("panel").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // 初始化日志系统（tracing + 文件日志）
            let log_path = logging::init_logging(app.handle())
                .map_err(|e| format!("日志初始化失败: {e}"))?;
            tracing::info!("日志文件: {}", log_path.display());

            // 隐藏辅助窗口的任务栏图标（ball / panel 不应出现在任务栏）
            for label in &["ball", "panel"] {
                match app.get_webview_window(label) {
                    Some(win) => {
                        if let Err(e) = win.set_skip_taskbar(true) {
                            tracing::warn!("隐藏 {label} 窗口任务栏图标失败: {e}");
                        }
                    }
                    None => tracing::error!("找不到窗口 '{label}'，无法设置任务栏隐藏"),
                }
            }
            // main 窗口初始隐藏
            match app.get_webview_window("main") {
                Some(win) => {
                    if let Err(e) = win.hide() {
                        tracing::warn!("隐藏 main 窗口失败: {e}");
                    }
                }
                None => tracing::error!("找不到 main 窗口"),
            }

            // 记录应用图标加载状态
            match app.default_window_icon() {
                Some(icon) => tracing::info!(
                    "应用图标已加载 ({}x{} bytes)",
                    icon.width(),
                    icon.height()
                ),
                None => tracing::error!(
                    "应用图标未加载！请检查 src-tauri/icons/icon.ico 是否存在"
                ),
            }

            // 确保数据目录存在
            paths::ensure_dirs()
                .map_err(|error| format!("failed to create data dir: {error}"))?;
            let db_path = paths::db_path();
            tracing::info!("数据库路径: {}", db_path.display());
            let db = Database::open(&db_path)
                .map_err(|error| format!("failed to open database: {error}"))?;

            app.manage(Mutex::new(db));
            app.manage(Mutex::new(AppRuntime::default()));
            services::pipeline::start_hotkey_pipeline(app.handle().clone())?;
            tray::setup_tray(app.handle()).map_err(|e| format!("failed to setup tray: {e}"))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::preview::get_app_status,
            commands::config::get_config,
            commands::config::set_config,
            commands::config::list_config,
            commands::preview::create_mock_preview,
            commands::preview::confirm_preview,
            commands::preview::cancel_preview,
            commands::preview::inject_text,
            commands::preview::test_asr_connection,
            commands::history::list_history,
            commands::history::delete_history,
            commands::history::clear_history,
            commands::history::search_history,
            commands::history::reinject_history,
            commands::dictionary::list_filter_words,
            commands::dictionary::add_filter_word,
            commands::dictionary::delete_filter_word,
            commands::dictionary::toggle_filter_word,
            commands::audio::list_audio_input_devices,
            commands::backup::export_data,
            commands::backup::import_data,
            commands::model::list_models,
            commands::model::download_model,
            commands::model::delete_model,
            commands::skills::list_skills,
            commands::skills::set_skill,
            commands::skills::get_active_skill,
            commands::updater::get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TerminalVoice");
}
