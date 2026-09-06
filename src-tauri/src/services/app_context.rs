//! 获取当前前台窗口的标题与进程名（仅 Windows）。
//! 非 Windows 平台所有函数返回 None，不影响主流程。

#[cfg(target_os = "windows")]
mod imp {
    use std::io;
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    /// 获取前台窗口的标题（最多 256 个 UTF-16 字符）。
    unsafe fn get_window_title(hwnd: HWND) -> Option<String> {
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return None;
        }
        let buf_len = (len as usize).min(256) + 1;
        let mut buf: Vec<u16> = vec![0; buf_len];
        let copied = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf_len as i32);
        if copied <= 0 {
            return None;
        }
        let s = String::from_utf16_lossy(&buf[..copied as usize]);
        let s = s.trim().to_string();
        if s.is_empty() { None } else { Some(s) }
    }

    /// 通过 PID 查询进程可执行文件名（不含路径）。
    unsafe fn get_process_name(pid: u32) -> Option<String> {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf: Vec<u16> = vec![0; 512];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        windows_sys::Win32::Foundation::CloseHandle(handle);
        if ok == 0 || size == 0 {
            return None;
        }
        let path = String::from_utf16_lossy(&buf[..size as usize]);
        // 从路径中提取文件名（去掉 .exe 后缀）
        let name = std::path::Path::new(&path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() { None } else { Some(name) }
    }

    /// 获取前台窗口的可读上下文字符串，格式为 "进程名 — 窗口标题"。
    /// 任一字段缺失则返回另一字段；都缺失返回 None。
    pub fn get_foreground_app_context() -> Option<String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let title = get_window_title(hwnd);
            let proc_name = if pid != 0 {
                get_process_name(pid)
            } else {
                None
            };
            match (proc_name, title) {
                (Some(p), Some(t)) => Some(format!("{p} — {t}")),
                (Some(p), None) => Some(p),
                (None, Some(t)) => Some(t),
                (None, None) => None,
            }
        }
    }

    /// 短暂让出 CPU，给操作系统时间切换焦点（注入前使用）。
    pub fn yield_focus() {
        std::thread::sleep(std::time::Duration::from_millis(30));
    }

    /// 注入后等待目标应用接收按键并恢复焦点，用于采集前台窗口信息。
    pub fn yield_after_inject() {
        std::thread::sleep(std::time::Duration::from_millis(120));
    }

    // 避免 io 未使用警告
    #[allow(dead_code)]
    fn _unused() -> io::Result<()> {
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    pub fn get_foreground_app_context() -> Option<String> {
        None
    }
    pub fn yield_focus() {}
    pub fn yield_after_inject() {}
}

pub use imp::{get_foreground_app_context, yield_after_inject, yield_focus};
