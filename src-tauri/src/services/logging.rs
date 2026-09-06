//! 日志系统模块
//!
//! 使用 `tracing` + `tracing-subscriber` 实现结构化日志，
//! 输出到文件（app_data_dir/logs/terminalvoice.log）和控制台。

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const LOG_DIR: &str = "logs";

/// 初始化日志系统。
///
/// 在 `app.setup()` 中调用，日志文件写入 `app_data_dir/logs/terminalvoice.log`。
/// 日志级别通过环境变量 `RUST_LOG` 控制，默认 `info`。
pub fn init_logging(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取数据目录: {e}"))?;

    let log_dir = data_dir.join(LOG_DIR);
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("无法创建日志目录: {e}"))?;

    let log_file = log_dir.join("terminalvoice.log");

    // 尝试打开/创建日志文件
    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("无法打开日志文件: {e}"))?;

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(file)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .with_timer(tracing_subscriber::fmt::time::ChronoLocal::new(
            "%Y-%m-%d %H:%M:%S%.3f".to_string(),
        ))
        .try_init()
        .map_err(|e| format!("日志初始化失败: {e}"))?;

    tracing::info!("TerminalVoice 日志系统已启动");
    tracing::info!("日志文件位置: {}", log_file.display());

    Ok(log_file)
}

/// 获取日志文件路径（不初始化，仅返回路径）。
pub fn get_log_path(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    data_dir.join(LOG_DIR).join("terminalvoice.log")
}
