use crate::services::db::{Database, FeedbackQueueItem, NewFeedbackQueueItem};
use crate::services::feedback::{
    default_config_value, queue_item_to_input, send_feedback, validate_feedback, FeedbackConfig,
    FeedbackInput, FeedbackSendError, FeedbackSubmitResult,
};
use crate::services::paths;
use crate::services::secrets::decode_config_value;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::State;
use zeroize::Zeroizing;

const FEEDBACK_QUEUE_FLUSH_INTERVAL: Duration = Duration::from_secs(120);

#[tauri::command]
pub fn submit_feedback(
    input: FeedbackInput,
    db: State<'_, Mutex<Database>>,
) -> Result<FeedbackSubmitResult, String> {
    let input = validate_feedback(&input)?;
    let db = db.lock().map_err(|error| error.to_string())?;
    let config = load_feedback_config(&db)?;

    match send_feedback(&input, &config) {
        Ok(()) => Ok(FeedbackSubmitResult {
            submitted: true,
            queued: false,
            queue_id: None,
            message: "反馈已提交".to_string(),
        }),
        Err(error) if error.is_retryable() => {
            let queued = db
                .enqueue_feedback(NewFeedbackQueueItem {
                    title: input.title,
                    description: input.description,
                    feedback_type: input.feedback_type.as_str().to_string(),
                    contact: input.contact,
                    last_error: Some(error.message().to_string()),
                })
                .map_err(|db_error| db_error.to_string())?;
            Ok(FeedbackSubmitResult {
                submitted: false,
                queued: true,
                queue_id: Some(queued.id),
                message: "网络暂不可用，反馈已缓存，将在网络恢复后自动重试".to_string(),
            })
        }
        Err(error) => Err(error.message().to_string()),
    }
}

#[tauri::command]
pub fn flush_feedback_queue(db: State<'_, Mutex<Database>>) -> Result<usize, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    flush_feedback_queue_inner(&db)
}

#[tauri::command]
pub fn list_feedback_queue(
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<FeedbackQueueItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_feedback_queue()
        .map_err(|error| error.to_string())
}

pub fn flush_feedback_queue_inner(db: &Database) -> Result<usize, String> {
    let config = load_feedback_config(db)?;
    let queue = db
        .list_feedback_queue()
        .map_err(|error| error.to_string())?;
    let mut submitted = 0;

    for item in queue {
        let Some(input) = queue_item_to_input(&item) else {
            db.mark_feedback_attempt(item.id, "反馈类型无效")
                .map_err(|error| error.to_string())?;
            continue;
        };

        match send_feedback(&input, &config) {
            Ok(()) => {
                db.delete_feedback_queue_item(item.id)
                    .map_err(|error| error.to_string())?;
                submitted += 1;
            }
            Err(FeedbackSendError::Retryable(message)) => {
                db.mark_feedback_attempt(item.id, &message)
                    .map_err(|error| error.to_string())?;
            }
            Err(FeedbackSendError::Fatal(message)) => {
                db.mark_feedback_attempt(item.id, &message)
                    .map_err(|error| error.to_string())?;
            }
        }
    }

    Ok(submitted)
}

pub fn start_feedback_queue_worker() {
    let _ = thread::Builder::new()
        .name("feedback-queue-worker".to_string())
        .spawn(|| loop {
            thread::sleep(FEEDBACK_QUEUE_FLUSH_INTERVAL);

            match Database::open(&paths::db_path()) {
                Ok(db) => match flush_feedback_queue_inner(&db) {
                    Ok(count) if count > 0 => tracing::info!("已自动提交 {count} 条离线反馈"),
                    Ok(_) => {}
                    Err(error) => tracing::debug!("离线反馈后台重试失败: {error}"),
                },
                Err(error) => tracing::warn!("离线反馈后台重试无法打开数据库: {error}"),
            }
        });
}

fn load_feedback_config(db: &Database) -> Result<FeedbackConfig, String> {
    Ok(FeedbackConfig {
        github_enabled: get_config_or_default(db, "feedback.githubEnabled")? != "false",
        github_api_base: get_config_or_default(db, "feedback.githubApiBase")?,
        github_owner: get_config_or_default(db, "feedback.githubOwner")?,
        github_repo: get_config_or_default(db, "feedback.githubRepo")?,
        github_token: Zeroizing::new(get_config_or_default(db, "feedback.githubToken")?),
        github_labels: get_config_or_default(db, "feedback.githubLabels")?
            .split(',')
            .map(str::trim)
            .filter(|label| !label.is_empty())
            .map(ToString::to_string)
            .collect(),
        email_enabled: get_config_or_default(db, "feedback.emailEnabled")? == "true",
        email_endpoint: get_config_or_default(db, "feedback.emailEndpoint")?,
        email_recipient: get_config_or_default(db, "feedback.emailRecipient")?,
    })
}

fn get_config_or_default(db: &Database, key: &str) -> Result<String, String> {
    match db.get_config(key).map_err(|error| error.to_string())? {
        Some(value) => decode_config_value(key, &value),
        None => Ok(default_config_value(key).unwrap_or_default().to_string()),
    }
}
