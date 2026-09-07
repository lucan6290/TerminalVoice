use crate::services::asr_cloud::post_bytes_with_label;
use crate::services::db::FeedbackQueueItem;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

const DEFAULT_GITHUB_API_BASE: &str = "https://api.github.com";
const DEFAULT_GITHUB_OWNER: &str = "lucan6290";
const DEFAULT_GITHUB_REPO: &str = "TerminalVoice";
const DEFAULT_GITHUB_LABELS: &str = "user-feedback";
const DEFAULT_EMAIL_ENDPOINT: &str = "";
const DEFAULT_EMAIL_RECIPIENT: &str = "";
const MAX_ERROR_BODY_CHARS: usize = 512;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FeedbackType {
    Bug,
    Feature,
    Experience,
    Other,
}

impl FeedbackType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bug => "bug",
            Self::Feature => "feature",
            Self::Experience => "experience",
            Self::Other => "other",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Bug => "Bug",
            Self::Feature => "Feature",
            Self::Experience => "Experience",
            Self::Other => "Other",
        }
    }

    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "bug" => Some(Self::Bug),
            "feature" => Some(Self::Feature),
            "experience" => Some(Self::Experience),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackInput {
    pub title: String,
    pub description: String,
    pub feedback_type: FeedbackType,
    pub contact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackSubmitResult {
    pub submitted: bool,
    pub queued: bool,
    pub queue_id: Option<i64>,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct FeedbackConfig {
    pub github_enabled: bool,
    pub github_api_base: String,
    pub github_owner: String,
    pub github_repo: String,
    pub github_token: Zeroizing<String>,
    pub github_labels: Vec<String>,
    pub email_enabled: bool,
    pub email_endpoint: String,
    pub email_recipient: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FeedbackSendError {
    Retryable(String),
    Fatal(String),
}

impl FeedbackSendError {
    pub fn message(&self) -> &str {
        match self {
            Self::Retryable(message) | Self::Fatal(message) => message,
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::Retryable(_))
    }
}

#[derive(Serialize)]
struct GithubIssueRequest<'a> {
    title: &'a str,
    body: &'a str,
    labels: &'a [String],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EmailFeedbackRequest<'a> {
    recipient: &'a str,
    subject: &'a str,
    title: &'a str,
    description: &'a str,
    feedback_type: &'a str,
    contact: &'a str,
    body: &'a str,
}

pub fn default_config_value(key: &str) -> Option<&'static str> {
    match key {
        "feedback.githubEnabled" => Some("true"),
        "feedback.githubApiBase" => Some(DEFAULT_GITHUB_API_BASE),
        "feedback.githubOwner" => Some(DEFAULT_GITHUB_OWNER),
        "feedback.githubRepo" => Some(DEFAULT_GITHUB_REPO),
        "feedback.githubToken" => Some(""),
        "feedback.githubLabels" => Some(DEFAULT_GITHUB_LABELS),
        "feedback.emailEnabled" => Some("false"),
        "feedback.emailEndpoint" => Some(DEFAULT_EMAIL_ENDPOINT),
        "feedback.emailRecipient" => Some(DEFAULT_EMAIL_RECIPIENT),
        _ => None,
    }
}

pub fn validate_feedback(input: &FeedbackInput) -> Result<FeedbackInput, String> {
    let title = normalize_text(&input.title);
    let description = normalize_text(&input.description);
    let contact = normalize_text(&input.contact);

    if title.chars().count() < 3 {
        return Err("反馈标题至少需要 3 个字符".to_string());
    }
    if title.chars().count() > 120 {
        return Err("反馈标题不能超过 120 个字符".to_string());
    }
    if description.chars().count() < 10 {
        return Err("详细描述至少需要 10 个字符".to_string());
    }
    if description.chars().count() > 5000 {
        return Err("详细描述不能超过 5000 个字符".to_string());
    }
    if contact.chars().count() > 200 {
        return Err("联系方式不能超过 200 个字符".to_string());
    }
    if !contact.is_empty() && contains_control_chars(&contact) {
        return Err("联系方式包含非法控制字符".to_string());
    }
    if looks_like_automation_payload(&title) || looks_like_automation_payload(&description) {
        return Err("反馈内容包含不允许的自动化提交内容".to_string());
    }

    Ok(FeedbackInput {
        title,
        description,
        feedback_type: input.feedback_type,
        contact,
    })
}

pub fn send_feedback(input: &FeedbackInput, config: &FeedbackConfig) -> Result<(), FeedbackSendError> {
    if !config.github_enabled && !config.email_enabled {
        return Err(FeedbackSendError::Fatal(
            "反馈通道未启用，请配置 GitHub 或邮件通道".to_string(),
        ));
    }

    let mut errors = Vec::new();
    let mut retryable = false;

    if config.github_enabled {
        match send_github_issue(input, config) {
            Ok(()) => {}
            Err(error) => {
                retryable |= error.is_retryable();
                errors.push(format!("GitHub: {}", error.message()));
            }
        }
    }

    if config.email_enabled {
        match send_email_feedback(input, config) {
            Ok(()) => {}
            Err(error) => {
                retryable |= error.is_retryable();
                errors.push(format!("邮件: {}", error.message()));
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else if retryable {
        Err(FeedbackSendError::Retryable(errors.join("；")))
    } else {
        Err(FeedbackSendError::Fatal(errors.join("；")))
    }
}

pub fn queue_item_to_input(item: &FeedbackQueueItem) -> Option<FeedbackInput> {
    Some(FeedbackInput {
        title: item.title.clone(),
        description: item.description.clone(),
        feedback_type: FeedbackType::from_storage(&item.feedback_type)?,
        contact: item.contact.clone(),
    })
}

fn send_github_issue(input: &FeedbackInput, config: &FeedbackConfig) -> Result<(), FeedbackSendError> {
    if config.github_owner.trim().is_empty() || config.github_repo.trim().is_empty() {
        return Err(FeedbackSendError::Fatal(
            "GitHub 仓库 owner/repo 未配置".to_string(),
        ));
    }
    if config.github_token.trim().is_empty() {
        return Err(FeedbackSendError::Fatal(
            "GitHub Token 未配置".to_string(),
        ));
    }

    let endpoint = format!(
        "{}/repos/{}/{}/issues",
        config.github_api_base.trim_end_matches('/'),
        percent_encode_path(&config.github_owner),
        percent_encode_path(&config.github_repo),
    );
    let body = build_feedback_body(input);
    let request = serde_json::to_vec(&GithubIssueRequest {
        title: &input.title,
        body: &body,
        labels: &config.github_labels,
    })
    .map_err(|error| FeedbackSendError::Fatal(format!("构造 GitHub 请求失败: {error}")))?;
    let headers = format!(
        "Content-Type: application/json\r\nAccept: application/vnd.github+json\r\nAuthorization: Bearer {}\r\nUser-Agent: TerminalVoice\r\nX-GitHub-Api-Version: 2022-11-28\r\n",
        config.github_token.trim(),
    );
    let response = post_bytes_with_label(&endpoint, &headers, &request, "GitHub")
        .map_err(|error| FeedbackSendError::Retryable(error.message))?;

    ensure_http_success(response.status, &response.body, "GitHub")
}

fn send_email_feedback(input: &FeedbackInput, config: &FeedbackConfig) -> Result<(), FeedbackSendError> {
    if config.email_endpoint.trim().is_empty() || config.email_recipient.trim().is_empty() {
        return Err(FeedbackSendError::Fatal(
            "邮件通道 endpoint/recipient 未配置".to_string(),
        ));
    }

    let body = build_feedback_body(input);
    let subject = format!("[TerminalVoice][{}] {}", input.feedback_type.label(), input.title);
    let request = serde_json::to_vec(&EmailFeedbackRequest {
        recipient: &config.email_recipient,
        subject: &subject,
        title: &input.title,
        description: &input.description,
        feedback_type: input.feedback_type.as_str(),
        contact: &input.contact,
        body: &body,
    })
    .map_err(|error| FeedbackSendError::Fatal(format!("构造邮件请求失败: {error}")))?;
    let headers = "Content-Type: application/json\r\nUser-Agent: TerminalVoice\r\n";
    let response = post_bytes_with_label(&config.email_endpoint, headers, &request, "Email")
        .map_err(|error| FeedbackSendError::Retryable(error.message))?;

    ensure_http_success(response.status, &response.body, "邮件")
}

fn ensure_http_success(status: u16, body: &[u8], label: &str) -> Result<(), FeedbackSendError> {
    if (200..300).contains(&status) {
        return Ok(());
    }

    let retryable = status == 408 || status == 429 || status >= 500;
    let detail = error_body(status, body);
    let message = format!("{label} 返回错误 {detail}");
    if retryable {
        Err(FeedbackSendError::Retryable(message))
    } else {
        Err(FeedbackSendError::Fatal(message))
    }
}

fn build_feedback_body(input: &FeedbackInput) -> String {
    let contact = if input.contact.trim().is_empty() {
        "未提供".to_string()
    } else {
        input.contact.clone()
    };
    format!(
        "## 类型\n{}\n\n## 联系方式\n{}\n\n## 详细描述\n{}\n\n---\n由 TerminalVoice 桌面端反馈表单提交。",
        input.feedback_type.label(),
        contact,
        input.description,
    )
}

fn normalize_text(value: &str) -> String {
    value
        .replace('\0', "")
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn contains_control_chars(value: &str) -> bool {
    value
        .chars()
        .any(|ch| ch.is_control() && ch != '\n' && ch != '\t')
}

fn looks_like_automation_payload(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("<script") || lower.contains("javascript:") || lower.contains("data:text/html")
}

fn error_body(status: u16, body: &[u8]) -> String {
    let body = String::from_utf8_lossy(body);
    let body: String = body.chars().take(MAX_ERROR_BODY_CHARS).collect();
    if body.trim().is_empty() {
        status.to_string()
    } else {
        format!("{status}: {body}")
    }
}

fn percent_encode_path(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_and_normalizes_feedback() {
        let input = FeedbackInput {
            title: "  一个问题  ".to_string(),
            description: "详细描述内容足够长\r\n第二行  ".to_string(),
            feedback_type: FeedbackType::Bug,
            contact: " user@example.com ".to_string(),
        };

        let normalized = validate_feedback(&input).expect("valid input");

        assert_eq!(normalized.title, "一个问题");
        assert_eq!(normalized.description, "详细描述内容足够长\n第二行");
        assert_eq!(normalized.contact, "user@example.com");
    }

    #[test]
    fn rejects_unsafe_feedback_content() {
        let input = FeedbackInput {
            title: "bad".to_string(),
            description: "<script>alert(1)</script>".to_string(),
            feedback_type: FeedbackType::Bug,
            contact: "".to_string(),
        };

        assert!(validate_feedback(&input).is_err());
    }

    #[test]
    fn maps_storage_feedback_type() {
        assert_eq!(FeedbackType::from_storage("bug"), Some(FeedbackType::Bug));
        assert_eq!(FeedbackType::from_storage("invalid"), None);
    }

    #[test]
    fn encodes_repository_path_segments() {
        assert_eq!(percent_encode_path("owner/name"), "owner%2Fname");
        assert_eq!(percent_encode_path("TerminalVoice"), "TerminalVoice");
    }
}
