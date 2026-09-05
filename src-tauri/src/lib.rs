pub mod commands;
pub mod services;
pub mod state;

use services::db::Database;
use state::AppRuntime;
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("failed to resolve app data dir: {error}"))?;
            std::fs::create_dir_all(&data_dir)
                .map_err(|error| format!("failed to create app data dir: {error}"))?;
            let db_path = data_dir.join("terminalvoice.db");
            let db = Database::open(&db_path)
                .map_err(|error| format!("failed to open database: {error}"))?;

            app.manage(Mutex::new(db));
            app.manage(Mutex::new(AppRuntime::default()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::preview::get_app_status,
            commands::config::get_config,
            commands::config::set_config,
            commands::config::list_config,
            commands::preview::create_mock_preview,
            commands::preview::confirm_preview,
            commands::history::list_history,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TerminalVoice");
}
