//! 统一数据目录管理
//!
//! 所有应用数据（数据库、日志、模型等）统一存放在用户主目录下的 `.terminalvoice/` 目录。
//! Windows: `C:\Users\<username>\.terminalvoice\`
//! macOS:   `/Users/<username>/.terminalvoice/`
//! Linux:   `/home/<username>/.terminalvoice/`

use std::path::PathBuf;

const APP_DIR_NAME: &str = ".terminalvoice";
const LOGS_DIR: &str = "logs";
const MODELS_DIR: &str = "models";

/// 获取应用数据根目录：`<user_home>/.terminalvoice/`
pub fn app_data_dir() -> PathBuf {
    dirs_next::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(APP_DIR_NAME)
}

/// 获取日志目录：`<user_home>/.terminalvoice/logs/`
pub fn logs_dir() -> PathBuf {
    app_data_dir().join(LOGS_DIR)
}

/// 获取模型目录：`<user_home>/.terminalvoice/models/`
pub fn models_dir() -> PathBuf {
    app_data_dir().join(MODELS_DIR)
}

/// 获取数据库文件路径：`<user_home>/.terminalvoice/terminalvoice.db`
pub fn db_path() -> PathBuf {
    app_data_dir().join("terminalvoice.db")
}

/// 确保数据目录及其子目录存在
pub fn ensure_dirs() -> std::io::Result<()> {
    std::fs::create_dir_all(app_data_dir())?;
    std::fs::create_dir_all(logs_dir())?;
    std::fs::create_dir_all(models_dir())?;
    Ok(())
}
