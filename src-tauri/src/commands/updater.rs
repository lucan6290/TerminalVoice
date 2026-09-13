// Copyright (C) 2026 lucan6290
// SPDX-License-Identifier: GPL-3.0-or-later
/// 获取当前应用版本号
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
