//! Windows SAPI 语音合成（TTS）模块
//!
//! 使用 Windows SAPI (System.Speech) COM 接口实现文本朗读功能。
//! 通过 SpVoice COM 对象进行异步语音合成，支持取消操作。

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

/// 全局朗读状态标志
static IS_SPEAKING: AtomicBool = AtomicBool::new(false);
/// 取消请求标志
static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);

/// SPF_ASYNC — 异步朗读
const SPF_ASYNC: u32 = 0x0001;
/// SPF_PURGEBEFORESPEAK — 朗读前清除队列
const SPF_PURGEBEFORESPEAK: u32 = 0x0002;

/// SPRS_IS_SPEAKING — 正在朗读
const SPRS_IS_SPEAKING: u32 = 2;

/// 检查当前是否正在朗读
pub fn is_speaking() -> bool {
    IS_SPEAKING.load(Ordering::SeqCst)
}

/// 朗读文本（同步阻塞，应在独立线程调用）
///
/// 如果文本为空则直接返回。朗读过程中可通过 `stop_speaking()` 取消。
pub fn speak(text: &str) -> Result<(), String> {
    if text.trim().is_empty() {
        return Ok(());
    }

    let start = Instant::now();
    info!(
        text_len = text.chars().count(),
        "TTS 开始朗读"
    );

    IS_SPEAKING.store(true, Ordering::SeqCst);
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);

    let result = speak_internal(text);

    IS_SPEAKING.store(false, Ordering::SeqCst);
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);

    let elapsed = start.elapsed();
    match &result {
        Ok(()) => info!(
            elapsed_ms = elapsed.as_millis() as u64,
            "TTS 朗读完成"
        ),
        Err(e) => error!(
            elapsed_ms = elapsed.as_millis() as u64,
            error = %e,
            "TTS 朗读失败"
        ),
    }
    result
}

/// 停止当前朗读
///
/// 设置取消标志，正在运行的 `speak()` 轮询到后会清除语音队列并退出。
pub fn stop_speaking() -> Result<(), String> {
    if !is_speaking() {
        return Ok(());
    }
    info!("TTS 停止朗读请求");
    CANCEL_REQUESTED.store(true, Ordering::SeqCst);
    Ok(())
}

#[cfg(windows)]
mod sapi {
    use std::ffi::c_void;
    use std::ptr;
    use tracing::error;
    use windows_sys::core::GUID;
    use windows_sys::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    };

    const S_OK: i32 = 0;
    const S_FALSE: i32 = 1;

    /// SAPI SpVoice CLSID: {96749377-3391-11D2-9EE3-00C04F797396}
    pub const CLSID_SPVOICE: GUID = GUID {
        data1: 0x96749377,
        data2: 0x3391,
        data3: 0x11D2,
        data4: [0x9E, 0xE3, 0x00, 0xC0, 0x4F, 0x79, 0x73, 0x96],
    };

    /// ISpVoice IID: {6C44DF74-72B9-4992-A1EC-EF996E0422D4}
    pub const IID_ISPVOICE: GUID = GUID {
        data1: 0x6C44DF74,
        data2: 0x72B9,
        data3: 0x4992,
        data4: [0xA1, 0xEC, 0xEF, 0x99, 0x6E, 0x04, 0x22, 0xD4],
    };

    /// SPVOICESTATUS 结构体
    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    pub struct SpVoiceStatus {
        pub ul_current_stream: u32,
        pub ul_last_stream_queued: u32,
        pub hr_last_result: i32,
        pub dw_running_state: u32,
        pub ul_input_word_len: u32,
        pub ul_input_sent_len: u32,
        pub l_output_word_pos: i32,
        pub l_output_sent_pos: i32,
        pub ul_input_word_pos: u32,
        pub ul_input_sent_pos: u32,
    }

    /// ISpVoice COM 接口 vtable
    ///
    /// vtable 布局：IUnknown(3) + ISpNotifySource(8) + ISpEventSource(3) + ISpVoice(20)
    /// 仅定义需要调用的方法，其余用 `usize` 占位（指针大小，与函数指针等宽）。
    #[repr(C)]
    pub struct ISpVoiceVtbl {
        // IUnknown (3 methods)
        pub query_interface: unsafe extern "system" fn(
            *mut c_void,
            *const GUID,
            *mut *mut c_void,
        ) -> i32,
        pub add_ref: unsafe extern "system" fn(*mut c_void) -> u32,
        pub release: unsafe extern "system" fn(*mut c_void) -> u32,
        // ISpNotifySource (8 methods)
        _pad_notify: [usize; 8],
        // ISpEventSource (3 methods)
        _pad_event: [usize; 3],
        // ISpVoice (20 methods)
        _set_output: usize,
        _get_output_object_token: usize,
        _get_output_object_token_id: usize,
        /// Speak — 朗读文本
        pub speak: unsafe extern "system" fn(
            *mut c_void,
            *const u16,
            u32,
            *mut u32,
        ) -> i32,
        _speak_stream: usize,
        /// GetStatus — 获取朗读状态
        pub get_status: unsafe extern "system" fn(
            *mut c_void,
            *mut SpVoiceStatus,
            *mut *mut u16,
        ) -> i32,
        _skip: usize,
        _set_priority: usize,
        _get_priority: usize,
        _set_alert_boundary: usize,
        _get_alert_boundary: usize,
        _set_rate: usize,
        _get_rate: usize,
        _set_volume: usize,
        _get_volume: usize,
        /// WaitUntilDone — 等待朗读完成
        pub wait_until_done: unsafe extern "system" fn(*mut c_void, u32) -> i32,
        _set_sync_speak_timeout: usize,
        _get_sync_speak_timeout: usize,
        /// Pause — 暂停朗读
        pub pause: unsafe extern "system" fn(*mut c_void) -> i32,
        /// Resume — 恢复朗读
        pub resume: unsafe extern "system" fn(*mut c_void) -> i32,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    pub struct ISpVoice {
        pub lpVtbl: *const ISpVoiceVtbl,
    }

    /// 初始化 COM 并创建 SpVoice 实例
    pub fn create_voice() -> Result<*mut ISpVoice, String> {
        unsafe {
            let hr = CoInitializeEx(ptr::null(), COINIT_APARTMENTTHREADED as u32);
            if hr != S_OK && hr != S_FALSE {
                let err = format!("CoInitializeEx 失败: 0x{:08X}", hr as u32);
                error!(error = %err, "TTS COM 初始化失败");
                return Err(err);
            }

            let mut p_voice: *mut c_void = ptr::null_mut();
            let hr = CoCreateInstance(
                &CLSID_SPVOICE,
                ptr::null_mut(),
                CLSCTX_ALL,
                &IID_ISPVOICE,
                &mut p_voice,
            );
            if hr != S_OK {
                let err = format!("CoCreateInstance (SpVoice) 失败: 0x{:08X}", hr as u32);
                error!(error = %err, "TTS SpVoice 创建失败");
                CoUninitialize();
                return Err(err);
            }
            Ok(p_voice as *mut ISpVoice)
        }
    }

    /// 释放 SpVoice COM 对象
    pub unsafe fn release_voice(p_voice: *mut ISpVoice) {
        let vtbl = &*(*p_voice).lpVtbl;
        (vtbl.release)(p_voice as *mut c_void);
        CoUninitialize();
    }
}

#[cfg(windows)]
fn speak_internal(text: &str) -> Result<(), String> {
    let p_voice = sapi::create_voice()?;

    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0u16)).collect();

    unsafe {
        let vtbl = &*(*p_voice).lpVtbl;

        // 异步朗读，先清除之前的队列
        let mut stream_num: u32 = 0;
        let hr = (vtbl.speak)(
            p_voice as *mut std::ffi::c_void,
            wide.as_ptr(),
            SPF_ASYNC | SPF_PURGEBEFORESPEAK,
            &mut stream_num,
        );
        if hr != 0 {
            let err = format!("SpVoice.Speak 失败: 0x{:08X}", hr as u32);
            error!(error = %err, "TTS Speak 调用失败");
            sapi::release_voice(p_voice);
            return Err(err);
        }

        // 轮询朗读状态，检查取消请求
        loop {
            if CANCEL_REQUESTED.load(Ordering::SeqCst) {
                // 清除语音队列
                let _ = (vtbl.speak)(
                    p_voice as *mut std::ffi::c_void,
                    std::ptr::null(),
                    SPF_PURGEBEFORESPEAK,
                    &mut stream_num,
                );
                info!("TTS 朗读已被取消");
                break;
            }

            let mut status = sapi::SpVoiceStatus::default();
            let hr = (vtbl.get_status)(
                p_voice as *mut std::ffi::c_void,
                &mut status,
                std::ptr::null_mut(),
            );
            if hr != 0 {
                warn!("TTS 获取朗读状态失败，退出轮询");
                break;
            }

            if status.dw_running_state != SPRS_IS_SPEAKING {
                break;
            }

            std::thread::sleep(Duration::from_millis(50));
        }

        sapi::release_voice(p_voice);
    }

    Ok(())
}

#[cfg(not(windows))]
fn speak_internal(_text: &str) -> Result<(), String> {
    Err("TTS 仅支持 Windows 平台".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_speaking_initially_false() {
        IS_SPEAKING.store(false, Ordering::SeqCst);
        assert!(!is_speaking());
    }

    #[test]
    fn test_speak_empty_text_returns_ok() {
        IS_SPEAKING.store(false, Ordering::SeqCst);
        assert!(speak("").is_ok());
        // 空文本不应设置朗读状态
        assert!(!is_speaking());
    }

    #[test]
    fn test_stop_speaking_when_not_speaking_returns_ok() {
        IS_SPEAKING.store(false, Ordering::SeqCst);
        assert!(stop_speaking().is_ok());
    }
}
