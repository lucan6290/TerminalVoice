//! 技能相关 IPC 命令

use crate::services::db::Database;
use crate::services::skills::{list_skills as fetch_all_skills, VoiceSkill};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// 列出所有可用的语音技能。
#[tauri::command]
pub fn list_skills() -> Vec<VoiceSkill> {
    fetch_all_skills()
}

/// 设置当前激活的技能。
/// 传入 `skill_id` 存入配置，传空字符串清除技能。
#[tauri::command]
pub fn set_skill(app: AppHandle, skill_id: String) -> Result<(), String> {
    let db = app.state::<Mutex<Database>>();
    let db = db.lock().map_err(|e| format!("数据库锁失败: {e}"))?;
    let value = if skill_id.is_empty() {
        String::new()
    } else {
        // 验证 skill_id 是否有效
        if crate::services::skills::find_skill(&skill_id).is_none() {
            return Err(format!("未知的技能 ID: {skill_id}"));
        }
        skill_id
    };
    db.set_config("service.activeSkill", &value)
        .map_err(|e| format!("保存技能配置失败: {e}"))
}

/// 获取当前激活的技能 ID。
#[tauri::command]
pub fn get_active_skill(app: AppHandle) -> Result<Option<String>, String> {
    let db = app.state::<Mutex<Database>>();
    let db = db.lock().map_err(|e| format!("数据库锁失败: {e}"))?;
    let value = db
        .get_config("service.activeSkill")
        .map_err(|e| format!("读取技能配置失败: {e}"))?;
    Ok(value.filter(|v| !v.trim().is_empty()))
}
