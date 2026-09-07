use crate::services::asr::{AsrProvider, AsrResult};
use crate::services::audio::encode_wav;
use crate::services::recorder::AudioBuffer;
use serde::Deserialize;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};
use tracing::{debug, error, info, warn};
use zeroize::Zeroizing;

const REQUEST_TIMEOUT_MS: i32 = 60_000;
const RETRY_DELAY: Duration = Duration::from_millis(250);
const MAX_ERROR_BODY_CHARS: usize = 512;

#[derive(Debug, Clone)]
pub struct CloudAsrConfig {
    pub endpoint: String,
    pub api_key: Zeroizing<String>,
    pub model: String,
    pub language: Option<String>,
}

pub struct CloudAsrProvider {
    config: CloudAsrConfig,
}

#[derive(Deserialize)]
struct TranscriptionResponse {
    text: String,
}

impl CloudAsrProvider {
    pub fn new(config: CloudAsrConfig) -> Result<Self, String> {
        parse_endpoint(&config.endpoint)?;
        if config.api_key.trim().is_empty() {
            error!("ASR 初始化失败: API Key 为空");
            return Err("ASR API Key 不能为空".to_string());
        }
        if config.model.trim().is_empty() {
            error!("ASR 初始化失败: Model 为空");
            return Err("ASR Model 不能为空".to_string());
        }
        info!(
            endpoint = %config.endpoint,
            model = %config.model,
            "ASR 客户端初始化成功"
        );
        Ok(Self { config })
    }

    fn send_once(&self, wav: Vec<u8>) -> Result<AsrResult, RequestError> {
        let start = Instant::now();
        debug!(
            endpoint = %self.config.endpoint,
            model = %self.config.model,
            body_len = wav.len(),
            "ASR HTTP 请求开始"
        );
        let boundary = "terminalvoice-asr-boundary";
        let body = build_multipart_body(
            boundary,
            &wav,
            &self.config.model,
            self.config.language.as_deref(),
        );
        let headers = format!(
            "Authorization: Bearer {}\r\nContent-Type: multipart/form-data; boundary={boundary}\r\n",
            self.config.api_key.as_str(),
        );
        let response = post_bytes(&self.config.endpoint, &headers, &body)?;
        let result = parse_response(response);
        let elapsed = start.elapsed();
        match &result {
            Ok(asr) => info!(
                elapsed_ms = elapsed.as_millis() as u64,
                text_len = asr.text.chars().count(),
                "ASR 请求成功"
            ),
            Err(e) => warn!(
                elapsed_ms = elapsed.as_millis() as u64,
                error = %e.message,
                retryable = e.retryable,
                "ASR 请求失败"
            ),
        }
        result
    }
}

impl AsrProvider for CloudAsrProvider {
    fn transcribe(&self, audio: &AudioBuffer) -> Result<AsrResult, String> {
        let wav = encode_wav(&audio.samples, audio.sample_rate)?;
        match self.send_once(wav.clone()) {
            Ok(result) => Ok(result),
            Err(first) if first.retryable => {
                warn!(
                    error = %first.message,
                    "ASR 首次请求失败，准备重试"
                );
                thread::sleep(RETRY_DELAY);
                match self.send_once(wav) {
                    Ok(result) => Ok(result),
                    Err(second) => {
                        error!(error = %second.message, "ASR 重试后仍失败");
                        Err(format!("云端 ASR 请求重试后仍失败: {}", second.message))
                    }
                }
            }
            Err(error) => {
                error!(error = %error.message, "ASR 请求发生不可重试错误");
                Err(error.message)
            }
        }
    }
}

fn build_multipart_body(
    boundary: &str,
    wav: &[u8],
    model: &str,
    language: Option<&str>,
) -> Vec<u8> {
    let mut body = Vec::new();
    append_text_part(&mut body, boundary, "model", model);
    if let Some(language) = language.filter(|value| !value.is_empty()) {
        append_text_part(&mut body, boundary, "language", language);
    }
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        b"Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n",
    );
    body.extend_from_slice(b"Content-Type: audio/wav\r\n\r\n");
    body.extend_from_slice(wav);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

fn append_text_part(body: &mut Vec<u8>, boundary: &str, name: &str, value: &str) {
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"{name}\"\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(value.as_bytes());
    body.extend_from_slice(b"\r\n");
}

pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub struct RequestError {
    pub message: String,
    pub retryable: bool,
}

impl RequestError {
    fn fatal(message: String) -> Self {
        Self {
            message,
            retryable: false,
        }
    }

    fn transport(message: String) -> Self {
        Self {
            message,
            retryable: true,
        }
    }
}

fn parse_response(response: HttpResponse) -> Result<AsrResult, RequestError> {
    if !(200..300).contains(&response.status) {
        let retryable = response.status >= 500 || response.status == 429;
        let body = String::from_utf8_lossy(&response.body);
        let body: String = body.chars().take(MAX_ERROR_BODY_CHARS).collect();
        let detail = if body.trim().is_empty() {
            response.status.to_string()
        } else {
            format!("{}: {body}", response.status)
        };
        return Err(RequestError {
            message: format!("云端 ASR 返回错误 {detail}"),
            retryable,
        });
    }

    let response = serde_json::from_slice::<TranscriptionResponse>(&response.body)
        .map_err(|error| RequestError::fatal(format!("云端 ASR 响应格式无效: {error}")))?;
    let text = response.text.trim().to_string();
    if text.is_empty() {
        return Err(RequestError::fatal("云端 ASR 返回了空文本".to_string()));
    }
    Ok(AsrResult {
        text,
        provider: "cloud".to_string(),
    })
}

pub(crate) struct ParsedEndpoint {
    pub(crate) secure: bool,
    pub(crate) host: String,
    pub(crate) port: u16,
    pub(crate) path: String,
}

pub(crate) fn parse_endpoint(endpoint: &str) -> Result<ParsedEndpoint, String> {
    let (secure, remainder, default_port) = if let Some(value) = endpoint.strip_prefix("https://") {
        (true, value, 443)
    } else if let Some(value) = endpoint.strip_prefix("http://") {
        (false, value, 80)
    } else {
        return Err("ASR Endpoint 必须以 http:// 或 https:// 开头".to_string());
    };
    let (authority, path) = remainder
        .split_once('/')
        .map(|(authority, path)| (authority, format!("/{path}")))
        .unwrap_or((remainder, "/".to_string()));
    if authority.is_empty() {
        return Err("ASR Endpoint 缺少主机名".to_string());
    }
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port))
            if !host.is_empty() && port.chars().all(|value| value.is_ascii_digit()) =>
        {
            let port = port
                .parse::<u16>()
                .map_err(|_| "ASR Endpoint 端口无效".to_string())?;
            (host.to_string(), port)
        }
        _ => (authority.to_string(), default_port),
    };
    Ok(ParsedEndpoint {
        secure,
        host,
        port,
        path,
    })
}

#[cfg(windows)]
pub(crate) fn post_bytes(endpoint: &str, headers: &str, body: &[u8]) -> Result<HttpResponse, RequestError> {
    post_bytes_with_label(endpoint, headers, body, "ASR")
}

#[cfg(windows)]
pub fn post_bytes_with_label(
    endpoint: &str,
    headers: &str,
    body: &[u8],
    service_label: &str,
) -> Result<HttpResponse, RequestError> {
    post_bytes_with_label_and_callback(endpoint, headers, body, service_label, |_| Ok(()))
}

#[cfg(windows)]
pub(crate) fn post_bytes_with_label_and_callback<F>(
    endpoint: &str,
    headers: &str,
    body: &[u8],
    service_label: &str,
    mut on_success_chunk: F,
) -> Result<HttpResponse, RequestError>
where
    F: FnMut(&[u8]) -> Result<(), String>,
{
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::Networking::WinHttp::{
        WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest,
        WinHttpQueryDataAvailable, WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse,
        WinHttpSendRequest, WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
        WINHTTP_FLAG_SECURE, WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
    };

    struct InternetHandle(*mut c_void);
    impl Drop for InternetHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    WinHttpCloseHandle(self.0);
                }
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn last_error(action: &str) -> RequestError {
        RequestError::transport(format!("{action}失败，Windows 错误码 {}", unsafe {
            GetLastError()
        }))
    }

    let parsed = parse_endpoint(endpoint).map_err(RequestError::fatal)?;
    let agent = wide("TerminalVoice/0.1");
    let session = InternetHandle(unsafe {
        WinHttpOpen(
            agent.as_ptr(),
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            null(),
            null(),
            0,
        )
    });
    if session.0.is_null() {
        return Err(last_error(&format!("初始化 {service_label} HTTP")));
    }
    unsafe {
        WinHttpSetTimeouts(
            session.0,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
        );
    }

    let host = wide(&parsed.host);
    let connection =
        InternetHandle(unsafe { WinHttpConnect(session.0, host.as_ptr(), parsed.port, 0) });
    if connection.0.is_null() {
        return Err(last_error(&format!("连接 {service_label} 服务")));
    }

    let verb = wide("POST");
    let path = wide(&parsed.path);
    let flags = if parsed.secure {
        WINHTTP_FLAG_SECURE
    } else {
        0
    };
    let request = InternetHandle(unsafe {
        WinHttpOpenRequest(
            connection.0,
            verb.as_ptr(),
            path.as_ptr(),
            null(),
            null(),
            null(),
            flags,
        )
    });
    if request.0.is_null() {
        return Err(last_error(&format!("创建 {service_label} 请求")));
    }

    let headers = wide(headers);
    let header_len = (headers.len() - 1)
        .try_into()
        .map_err(|_| RequestError::fatal(format!("{service_label} 请求头过长")))?;
    let body_len = body
        .len()
        .try_into()
        .map_err(|_| RequestError::fatal(format!("{service_label} 请求体过大")))?;
    let ok = unsafe {
        WinHttpSendRequest(
            request.0,
            headers.as_ptr(),
            header_len,
            body.as_ptr() as *const c_void,
            body_len,
            body_len,
            0,
        )
    };
    if ok == 0 {
        return Err(last_error(&format!("发送 {service_label} 请求")));
    }
    if unsafe { WinHttpReceiveResponse(request.0, null_mut()) } == 0 {
        return Err(last_error(&format!("接收 {service_label} 响应")));
    }

    let mut status = 0_u32;
    let mut status_size = std::mem::size_of::<u32>() as u32;
    let ok = unsafe {
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            null(),
            &mut status as *mut u32 as *mut c_void,
            &mut status_size,
            null_mut(),
        )
    };
    if ok == 0 {
        return Err(last_error(&format!("读取 {service_label} 状态码")));
    }

    let mut response_body = Vec::new();
    loop {
        let mut available = 0_u32;
        if unsafe { WinHttpQueryDataAvailable(request.0, &mut available) } == 0 {
            return Err(last_error(&format!("读取 {service_label} 响应长度")));
        }
        if available == 0 {
            break;
        }
        let offset = response_body.len();
        response_body.resize(offset + available as usize, 0);
        let mut read = 0_u32;
        if unsafe {
            WinHttpReadData(
                request.0,
                response_body[offset..].as_mut_ptr() as *mut c_void,
                available,
                &mut read,
            )
        } == 0
        {
            return Err(last_error(&format!("读取 {service_label} 响应")));
        }
        response_body.truncate(offset + read as usize);
        if (200..300).contains(&(status as u16)) && read > 0 {
            on_success_chunk(&response_body[offset..offset + read as usize])
                .map_err(RequestError::fatal)?;
        }
    }

    Ok(HttpResponse {
        status: status as u16,
        body: response_body,
    })
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn get_bytes(endpoint: &str, headers: &str) -> Result<HttpResponse, RequestError> {
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::Networking::WinHttp::{
        WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest,
        WinHttpQueryDataAvailable, WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse,
        WinHttpSendRequest, WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
        WINHTTP_FLAG_SECURE, WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
    };

    struct InternetHandle(*mut c_void);
    impl Drop for InternetHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    WinHttpCloseHandle(self.0);
                }
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn last_error(action: &str) -> RequestError {
        RequestError::transport(format!("{action}失败，Windows 错误码 {}", unsafe {
            GetLastError()
        }))
    }

    let parsed = parse_endpoint(endpoint).map_err(RequestError::fatal)?;
    let agent = wide("TerminalVoice/0.1");
    let session = InternetHandle(unsafe {
        WinHttpOpen(
            agent.as_ptr(),
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            null(),
            null(),
            0,
        )
    });
    if session.0.is_null() {
        return Err(last_error("初始化 HTTP"));
    }
    unsafe {
        WinHttpSetTimeouts(
            session.0,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
        );
    }

    let host = wide(&parsed.host);
    let connection =
        InternetHandle(unsafe { WinHttpConnect(session.0, host.as_ptr(), parsed.port, 0) });
    if connection.0.is_null() {
        return Err(last_error("连接服务"));
    }

    let verb = wide("GET");
    let path = wide(&parsed.path);
    let flags = if parsed.secure {
        WINHTTP_FLAG_SECURE
    } else {
        0
    };
    let request = InternetHandle(unsafe {
        WinHttpOpenRequest(
            connection.0,
            verb.as_ptr(),
            path.as_ptr(),
            null(),
            null(),
            null(),
            flags,
        )
    });
    if request.0.is_null() {
        return Err(last_error("创建请求"));
    }

    let headers_wide = wide(headers);
    let header_len = (headers_wide.len() - 1)
        .try_into()
        .map_err(|_| RequestError::fatal("请求头过长".to_string()))?;
    let ok = unsafe {
        WinHttpSendRequest(
            request.0,
            headers_wide.as_ptr(),
            header_len,
            null(),
            0,
            0,
            0,
        )
    };
    if ok == 0 {
        return Err(last_error("发送请求"));
    }
    if unsafe { WinHttpReceiveResponse(request.0, null_mut()) } == 0 {
        return Err(last_error("接收响应"));
    }

    let mut status = 0_u32;
    let mut status_size = std::mem::size_of::<u32>() as u32;
    let ok = unsafe {
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            null(),
            &mut status as *mut u32 as *mut c_void,
            &mut status_size,
            null_mut(),
        )
    };
    if ok == 0 {
        return Err(last_error("读取状态码"));
    }

    let mut response_body = Vec::new();
    loop {
        let mut available = 0_u32;
        if unsafe { WinHttpQueryDataAvailable(request.0, &mut available) } == 0 {
            return Err(last_error("读取响应长度"));
        }
        if available == 0 {
            break;
        }
        let offset = response_body.len();
        response_body.resize(offset + available as usize, 0);
        let mut read = 0_u32;
        if unsafe {
            WinHttpReadData(
                request.0,
                response_body[offset..].as_mut_ptr() as *mut c_void,
                available,
                &mut read,
            )
        } == 0
        {
            return Err(last_error("读取响应"));
        }
        response_body.truncate(offset + read as usize);
    }

    Ok(HttpResponse {
        status: status as u16,
        body: response_body,
    })
}

#[cfg(windows)]
pub(crate) fn download_file(
    endpoint: &str,
    headers: &str,
    output_path: &Path,
) -> Result<u64, RequestError> {
    use std::ffi::c_void;
    use std::io::Write;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::Networking::WinHttp::{
        WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest,
        WinHttpQueryDataAvailable, WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse,
        WinHttpSendRequest, WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
        WINHTTP_FLAG_SECURE, WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
    };

    struct InternetHandle(*mut c_void);
    impl Drop for InternetHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    WinHttpCloseHandle(self.0);
                }
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn last_error(action: &str) -> RequestError {
        RequestError::transport(format!("{action}失败，Windows 错误码 {}", unsafe {
            GetLastError()
        }))
    }

    let parsed = parse_endpoint(endpoint).map_err(RequestError::fatal)?;
    let agent = wide("TerminalVoice/0.1");
    let session = InternetHandle(unsafe {
        WinHttpOpen(
            agent.as_ptr(),
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            null(),
            null(),
            0,
        )
    });
    if session.0.is_null() {
        return Err(last_error("初始化 HTTP"));
    }
    unsafe {
        WinHttpSetTimeouts(
            session.0,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
            REQUEST_TIMEOUT_MS,
        );
    }

    let host = wide(&parsed.host);
    let connection =
        InternetHandle(unsafe { WinHttpConnect(session.0, host.as_ptr(), parsed.port, 0) });
    if connection.0.is_null() {
        return Err(last_error("连接服务"));
    }

    let verb = wide("GET");
    let path = wide(&parsed.path);
    let flags = if parsed.secure {
        WINHTTP_FLAG_SECURE
    } else {
        0
    };
    let request = InternetHandle(unsafe {
        WinHttpOpenRequest(
            connection.0,
            verb.as_ptr(),
            path.as_ptr(),
            null(),
            null(),
            null(),
            flags,
        )
    });
    if request.0.is_null() {
        return Err(last_error("创建请求"));
    }

    let headers_wide = wide(headers);
    let header_len = (headers_wide.len() - 1)
        .try_into()
        .map_err(|_| RequestError::fatal("请求头过长".to_string()))?;
    let ok = unsafe {
        WinHttpSendRequest(
            request.0,
            headers_wide.as_ptr(),
            header_len,
            null(),
            0,
            0,
            0,
        )
    };
    if ok == 0 {
        return Err(last_error("发送请求"));
    }
    if unsafe { WinHttpReceiveResponse(request.0, null_mut()) } == 0 {
        return Err(last_error("接收响应"));
    }

    let mut status = 0_u32;
    let mut status_size = std::mem::size_of::<u32>() as u32;
    let ok = unsafe {
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            null(),
            &mut status as *mut u32 as *mut c_void,
            &mut status_size,
            null_mut(),
        )
    };
    if ok == 0 {
        return Err(last_error("读取状态码"));
    }

    if !(200..300).contains(&(status as u16)) {
        return Err(RequestError::fatal(format!(
            "下载失败，HTTP 状态码: {status}"
        )));
    }

    let mut file = std::fs::File::create(output_path)
        .map_err(|e| RequestError::fatal(format!("无法创建文件: {e}")))?;
    let mut total_written: u64 = 0;

    loop {
        let mut available = 0_u32;
        if unsafe { WinHttpQueryDataAvailable(request.0, &mut available) } == 0 {
            return Err(last_error("读取下载响应长度"));
        }
        if available == 0 {
            break;
        }
        let mut buffer = vec![0u8; available as usize];
        let mut read = 0_u32;
        if unsafe {
            WinHttpReadData(
                request.0,
                buffer.as_mut_ptr() as *mut c_void,
                available,
                &mut read,
            )
        } == 0
        {
            return Err(last_error("读取下载响应"));
        }
        buffer.truncate(read as usize);
        file.write_all(&buffer)
            .map_err(|e| RequestError::fatal(format!("写入文件失败: {e}")))?;
        total_written += read as u64;
    }

    Ok(total_written)
}

#[cfg(not(windows))]
pub(crate) fn post_bytes(
    _endpoint: &str,
    _headers: &str,
    _body: &[u8],
) -> Result<HttpResponse, RequestError> {
    Err(RequestError::fatal(
        "云端 ASR 的 WinHTTP 客户端仅支持 Windows".to_string(),
    ))
}

#[cfg(not(windows))]
pub fn post_bytes_with_label(
    _endpoint: &str,
    _headers: &str,
    _body: &[u8],
    service_label: &str,
) -> Result<HttpResponse, RequestError> {
    Err(RequestError::fatal(format!(
        "云端 {service_label} 的 WinHTTP 客户端仅支持 Windows"
    )))
}

#[cfg(not(windows))]
pub(crate) fn post_bytes_with_label_and_callback<F>(
    _endpoint: &str,
    _headers: &str,
    _body: &[u8],
    service_label: &str,
    _on_success_chunk: F,
) -> Result<HttpResponse, RequestError>
where
    F: FnMut(&[u8]) -> Result<(), String>,
{
    Err(RequestError::fatal(format!(
        "云端 {service_label} 的 WinHTTP 客户端仅支持 Windows"
    )))
}

#[cfg(not(windows))]
pub(crate) fn get_bytes(_endpoint: &str, _headers: &str) -> Result<HttpResponse, RequestError> {
    Err(RequestError::fatal(
        "WinHTTP GET 客户端仅支持 Windows".to_string(),
    ))
}

#[cfg(not(windows))]
pub(crate) fn download_file(
    _endpoint: &str,
    _headers: &str,
    _output_path: &Path,
) -> Result<u64, RequestError> {
    Err(RequestError::fatal(
        "文件下载的 WinHTTP 客户端仅支持 Windows".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Barrier};
    use std::time::Duration;

    fn audio() -> AudioBuffer {
        AudioBuffer {
            samples: vec![0.0; 1600],
            sample_rate: 16_000,
            duration: Duration::from_millis(100),
        }
    }

    fn serve(responses: Vec<(u16, &'static str)>) -> (String, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("binds test server");
        let address = listener.local_addr().expect("has address");
        listener
            .set_nonblocking(false)
            .expect("listener blocking mode");
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_for_thread = Arc::clone(&calls);
        // Barrier ensures the test thread only returns after the server thread
        // is sitting in accept() — avoids a race where WinHttpConnect fires
        // before the server is ready (Windows error 12029).
        let ready = Arc::new(Barrier::new(2));
        let ready_for_thread = Arc::clone(&ready);
        thread::spawn(move || {
            ready_for_thread.wait();
            for response in responses {
                let (mut stream, _) = listener.accept().expect("accepts request");
                // Read headers until double CRLF
                let mut request = Vec::new();
                let mut buffer = [0_u8; 4096];
                let mut headers_done = false;
                while !headers_done {
                    let count = stream.read(&mut buffer).expect("reads request");
                    if count == 0 {
                        break;
                    }
                    request.extend_from_slice(&buffer[..count]);
                    if request.windows(4).any(|window| window == b"\r\n\r\n") {
                        headers_done = true;
                    }
                }
                // Drain the remainder of the body (multipart wav) so the
                // client does not get a connection reset while sending.
                if headers_done {
                    stream
                        .set_read_timeout(Some(Duration::from_millis(200)))
                        .ok();
                    while stream.read(&mut buffer).unwrap_or(0) > 0 {}
                }
                let request = String::from_utf8_lossy(&request);
                assert!(request.contains("Authorization: Bearer test-key"));
                assert!(request.contains("multipart/form-data"));
                calls_for_thread.fetch_add(1, Ordering::SeqCst);
                let (status, body) = response;
                let reason = if status == 200 {
                    "OK"
                } else {
                    "Service Unavailable"
                };
                let response = format!(
                    "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len(),
                );
                stream
                    .write_all(response.as_bytes())
                    .expect("writes response");
                stream.flush().ok();
                // For multi-response (retry) tests, wait for the next connection
            }
        });
        ready.wait();
        // Small extra yield to let the spawned thread enter accept() after
        // the barrier releases it.
        thread::sleep(Duration::from_millis(20));
        (format!("http://{address}/transcriptions"), calls)
    }

    fn provider(endpoint: String) -> CloudAsrProvider {
        CloudAsrProvider::new(CloudAsrConfig {
            endpoint,
            api_key: Zeroizing::new("test-key".to_string()),
            model: "whisper-1".to_string(),
            language: Some("zh".to_string()),
        })
        .expect("creates provider")
    }

    #[cfg(windows)]
    #[test]
    fn sends_openai_compatible_multipart_request() {
        let (endpoint, calls) = serve(vec![(200, "{\"text\":\"测试识别结果\"}")]);
        let result = provider(endpoint)
            .transcribe(&audio())
            .expect("transcribes");
        assert_eq!(result.text, "测试识别结果");
        assert_eq!(result.provider, "cloud");
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[cfg(windows)]
    #[test]
    fn retries_one_server_failure() {
        let (endpoint, calls) = serve(vec![(503, "busy"), (200, "{\"text\":\"ok\"}")]);
        let result = provider(endpoint).transcribe(&audio()).expect("retries");
        assert_eq!(result.text, "ok");
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn validates_endpoint_scheme() {
        assert!(parse_endpoint("ftp://example.test/asr").is_err());
        let endpoint = parse_endpoint("https://example.test/v1/asr").expect("parses");
        assert!(endpoint.secure);
        assert_eq!(endpoint.port, 443);
        assert_eq!(endpoint.path, "/v1/asr");
    }
}
