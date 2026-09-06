//! 日志系统模块
//!
//! 使用 `tracing` + `tracing-subscriber` 实现结构化日志，输出到两个文件：
//! - `terminalvoice.log`：所有级别日志（debug/info/warn/error）
//! - `error.log`：仅 error 级别日志

use std::path::PathBuf;
use tauri::AppHandle;
use tracing_subscriber::{prelude::*, EnvFilter};

use crate::services::paths;

/// 初始化日志系统。
///
/// 在 `app.setup()` 中调用，创建两个日志文件：
/// - `<home>/.terminalvoice/logs/terminalvoice.log`（所有级别）
/// - `<home>/.terminalvoice/logs/error.log`（仅 error）
///
/// 全量日志级别通过环境变量 `RUST_LOG` 控制，默认 `info`（即 info/warn/error）。
/// 若需记录 debug 日志，设置环境变量 `RUST_LOG=debug`。
pub fn init_logging(_app: &AppHandle) -> Result<PathBuf, String> {
    let log_dir = paths::logs_dir();
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("无法创建日志目录 {}: {e}", log_dir.display()))?;

    // 全量日志文件
    let full_log_path = log_dir.join("terminalvoice.log");
    let full_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&full_log_path)
        .map_err(|e| format!("无法打开日志文件 {}: {e}", full_log_path.display()))?;

    // 仅 error 日志文件
    let error_log_path = log_dir.join("error.log");
    let error_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&error_log_path)
        .map_err(|e| format!("无法打开错误日志文件 {}: {e}", error_log_path.display()))?;

    // 全量日志的过滤器：RUST_LOG 环境变量，默认 info
    let full_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    // error 日志的过滤器：固定仅 error
    let error_filter = EnvFilter::new("error");

    let timer = tracing_subscriber::fmt::time::ChronoLocal::new(
        "%Y-%m-%d %H:%M:%S%.3f".to_string(),
    );

    // 全量日志 layer
    let full_layer = tracing_subscriber::fmt::layer()
        .with_writer(full_file)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .with_timer(timer.clone())
        .with_filter(full_filter);

    // error 日志 layer
    let error_layer = tracing_subscriber::fmt::layer()
        .with_writer(error_file)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .with_timer(timer)
        .with_filter(error_filter);

    // 组合两个 layer
    tracing_subscriber::registry()
        .with(full_layer)
        .with(error_layer)
        .try_init()
        .map_err(|e| format!("日志初始化失败: {e}"))?;

    tracing::info!("TerminalVoice 日志系统已启动");
    tracing::info!("全量日志文件: {}", full_log_path.display());
    tracing::info!("错误日志文件: {}", error_log_path.display());
    tracing::info!("数据目录: {}", paths::app_data_dir().display());

    Ok(full_log_path)
}

/// 获取全量日志文件路径（不初始化，仅返回路径）。
pub fn get_log_path(_app: &AppHandle) -> PathBuf {
    paths::logs_dir().join("terminalvoice.log")
}

/// 获取错误日志文件路径。
pub fn get_error_log_path(_app: &AppHandle) -> PathBuf {
    paths::logs_dir().join("error.log")
}
