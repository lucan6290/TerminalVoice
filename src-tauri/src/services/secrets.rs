use base64::{engine::general_purpose::STANDARD, Engine as _};
use zeroize::Zeroizing;

const DPAPI_PREFIX: &str = "dpapi:";
const SECRET_CONFIG_KEYS: &[&str] = &["service.asrApiKey", "service.llmApiKey"];

pub fn is_secret_config_key(key: &str) -> bool {
    SECRET_CONFIG_KEYS.contains(&key)
}

pub fn encode_config_value(key: &str, value: &str) -> Result<String, String> {
    if !is_secret_config_key(key) || value.is_empty() {
        return Ok(value.to_string());
    }
    protect_secret(value)
}

pub fn decode_config_value(key: &str, value: &str) -> Result<String, String> {
    if !is_secret_config_key(key) || value.is_empty() {
        return Ok(value.to_string());
    }
    if !value.starts_with(DPAPI_PREFIX) {
        // 兼容早期明文配置；命令层会在读取后立即迁移为 DPAPI 密文。
        return Ok(value.to_string());
    }
    unprotect_secret(value)
}

pub fn is_encrypted_secret(value: &str) -> bool {
    value.starts_with(DPAPI_PREFIX)
}

#[cfg(windows)]
fn protect_secret(value: &str) -> Result<String, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let bytes = Zeroizing::new(value.as_bytes().to_vec());
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes
            .len()
            .try_into()
            .map_err(|_| "API Key 过长".to_string())?,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let ok = unsafe {
        CryptProtectData(
            &input,
            null(),
            null(),
            null(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!("DPAPI 加密失败，Windows 错误码 {}", unsafe {
            GetLastError()
        }));
    }

    let encoded = unsafe {
        let encrypted = std::slice::from_raw_parts(output.pbData, output.cbData as usize);
        STANDARD.encode(encrypted)
    };
    unsafe {
        let _ = LocalFree(output.pbData.cast());
    }
    Ok(format!("{DPAPI_PREFIX}{encoded}"))
}

#[cfg(windows)]
fn unprotect_secret(value: &str) -> Result<String, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let encoded = value
        .strip_prefix(DPAPI_PREFIX)
        .ok_or_else(|| "API Key 密文格式无效".to_string())?;
    let encrypted = Zeroizing::new(
        STANDARD
            .decode(encoded)
            .map_err(|_| "API Key 密文 Base64 无效".to_string())?,
    );
    let input = CRYPT_INTEGER_BLOB {
        cbData: encrypted
            .len()
            .try_into()
            .map_err(|_| "API Key 密文过长".to_string())?,
        pbData: encrypted.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &input,
            null_mut(),
            null(),
            null(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!("DPAPI 解密失败，Windows 错误码 {}", unsafe {
            GetLastError()
        }));
    }

    let plaintext = unsafe {
        let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize);
        String::from_utf8(bytes.to_vec()).map_err(|_| "API Key 明文不是有效 UTF-8".to_string())
    };
    unsafe {
        let _ = LocalFree(output.pbData.cast());
    }
    plaintext
}

#[cfg(not(windows))]
fn protect_secret(_value: &str) -> Result<String, String> {
    Err("DPAPI 仅支持 Windows".to_string())
}

#[cfg(not(windows))]
fn unprotect_secret(_value: &str) -> Result<String, String> {
    Err("DPAPI 仅支持 Windows".to_string())
}

pub fn zeroizing(value: String) -> Zeroizing<String> {
    Zeroizing::new(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifies_only_api_key_config_entries_as_secrets() {
        assert!(is_secret_config_key("service.asrApiKey"));
        assert!(is_secret_config_key("service.llmApiKey"));
        assert!(!is_secret_config_key("service.asrEndpoint"));
    }

    #[cfg(windows)]
    #[test]
    fn dpapi_round_trip_does_not_store_plaintext() {
        let plaintext = "sk-terminalvoice-test-secret";
        let encrypted = encode_config_value("service.asrApiKey", plaintext).expect("encrypts");
        assert!(is_encrypted_secret(&encrypted));
        assert!(!encrypted.contains(plaintext));
        assert_eq!(
            decode_config_value("service.asrApiKey", &encrypted).expect("decrypts"),
            plaintext
        );
    }
}
