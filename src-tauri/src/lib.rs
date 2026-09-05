pub mod commands;
pub mod services;
pub mod state;
pub mod tray;

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
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TerminalVoice");
}
