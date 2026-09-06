use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const OFFICIAL_SITE: &str = "https://terminalvoice.app";

/// 更新信息（演示数据，实际项目应从远端 JSON 获取）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub current_version: String,
    pub version: String,
    pub release_notes: String,
    pub download_url: String,
    pub has_update: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgressPayload {
    pub percent: u8,
}

/// 检查更新（演示版本始终返回 v2.0.2 可用）
#[tauri::command]
pub fn check_update() -> Result<UpdateInfo, String> {
    Ok(UpdateInfo {
        current_version: CURRENT_VERSION.to_string(),
        version: "2.0.2".to_string(),
        release_notes: concat!(
            "## 修复 (Fix)\n",
            "- 修复数字小键盘的加、减、乘、除及小数点按键无法正确注册为全局快捷键的问题\n",
            "- 修复首次使用欢迎引导中的提示弹层位置配置无效、可能显示异常的问题\n",
            "- 修复 Linux ARM64 等交叉编译产物可能混入宿主机架构系统代理模块的问题，并增加原生模块架构校验\n",
            "- 修复 Linux 无法注册托盘图标的问题"
        )
        .to_string(),
        download_url: OFFICIAL_SITE.to_string(),
        has_update: true,
    })
}

#[tauri::command]
pub fn get_app_version() -> String {
    CURRENT_VERSION.to_string()
}

/// 开始下载更新（模拟进度，每 150ms 推进 5%）
#[tauri::command]
pub fn start_update_download(app: AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        for percent in (5..=100).step_by(5) {
            std::thread::sleep(Duration::from_millis(150));
            let _ = app.emit(
                "update-download-progress",
                UpdateProgressPayload { percent: percent as u8 },
            );
        }
        let _ = app.emit("update-downloaded", ());
    });
    Ok(())
}
