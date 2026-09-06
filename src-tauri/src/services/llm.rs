use crate::services::asr_cloud::{
    parse_endpoint, post_bytes_with_label, post_bytes_with_label_and_callback, HttpResponse,
};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

const MAX_ERROR_BODY_CHARS: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextProcessMode {
    Off,
    Proofread,
    Polish,
    Structure,
}

impl TextProcessMode {
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("off") => Self::Off,
            Some("proofread") => Self::Proofread,
            Some("structure") => Self::Structure,
            _ => Self::Polish,
        }
    }

    fn instruction(self) -> Option<&'static str> {
        match self {
            Self::Off => None,
            Self::Proofread => Some(
                "修正错别字、同音误识别、标点和明显语病；严格保留原意、事实、语气与信息量，不扩写。",
            ),
            Self::Polish => Some(
                "在不改变原意、事实和语气的前提下，把口语整理为自然、流畅、简洁的书面表达。",
            ),
            Self::Structure => Some(
                "在不改变原意和事实的前提下，补全标点并按语义分段；有多个并列事项时整理为清晰列表。",
            ),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LlmConfig {
    pub endpoint: String,
    pub api_key: Zeroizing<String>,
    pub model: String,
}

pub struct LlmClient {
    config: LlmConfig,
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: [ChatMessage<'a>; 2],
    temperature: f32,
    stream: bool,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'static str,
    content: &'a str,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Deserialize)]
struct ChatMessageResponse {
    content: String,
}

#[derive(Deserialize)]
struct StreamResponse {
    choices: Vec<StreamChoice>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

impl LlmClient {
    pub fn new(config: LlmConfig) -> Result<Self, String> {
        parse_endpoint(&config.endpoint)
            .map_err(|error| error.replacen("ASR Endpoint", "LLM Endpoint", 1))?;
        if config.api_key.trim().is_empty() {
            return Err("LLM API Key 不能为空".to_string());
        }
        if config.model.trim().is_empty() {
            return Err("LLM Model 不能为空".to_string());
        }
        Ok(Self { config })
    }

    pub fn organize(&self, mode: TextProcessMode, input: &str) -> Result<String, String> {
        let Some(instruction) = mode.instruction() else {
            return Ok(input.to_string());
        };
        if input.trim().is_empty() {
            return Ok(String::new());
        }

        let body = build_request_body(&self.config.model, instruction, input, false)?;
        let headers = self.headers();
        let response = post_bytes_with_label(&self.config.endpoint, &headers, &body, "LLM")
            .map_err(|error| error.message)?;
        parse_chat_response(response)
    }

    /// 将文本翻译为指定目标语言
    pub fn translate(&self, text: &str, target_lang: &str) -> Result<String, String> {
        if text.trim().is_empty() {
            return Ok(String::new());
        }

        let system_prompt = format!(
            "你是一个翻译助手。将以下文本翻译为{target_lang}，只返回译文，不要解释。"
        );
        let body = serde_json::to_vec(&ChatRequest {
            model: &self.config.model,
            messages: [
                ChatMessage {
                    role: "system",
                    content: &system_prompt,
                },
                ChatMessage {
                    role: "user",
                    content: text,
                },
            ],
            temperature: 0.3,
            stream: false,
        })
        .map_err(|error| format!("构建 LLM 请求失败: {error}"))?;

        let headers = self.headers();
        let response = post_bytes_with_label(&self.config.endpoint, &headers, &body, "LLM")
            .map_err(|error| error.message)?;
        parse_chat_response(response)
    }

    /// Sends a custom prompt to the LLM for text rewriting.
    /// Unlike `organize`, this uses a rewrite-focused system prompt instead of
    /// the voice-transcription system prompt.
    pub fn rewrite(&self, prompt: &str) -> Result<String, String> {
        if prompt.trim().is_empty() {
            return Ok(String::new());
        }

        let system_prompt = "你是一个文本改写助手。根据用户的指令改写文本，只返回改写后的正文，不要解释，不要添加引号或 Markdown 代码块。";
        let body = serde_json::to_vec(&ChatRequest {
            model: &self.config.model,
            messages: [
                ChatMessage {
                    role: "system",
                    content: system_prompt,
                },
                ChatMessage {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.3,
            stream: false,
        })
        .map_err(|error| format!("构建 LLM 请求失败: {error}"))?;

        let headers = self.headers();
        let response = post_bytes_with_label(&self.config.endpoint, &headers, &body, "LLM")
            .map_err(|error| error.message)?;
        parse_chat_response(response)
    }

    pub fn organize_streaming<F>(
        &self,
        mode: TextProcessMode,
        input: &str,
        mut on_delta: F,
    ) -> Result<String, String>
    where
        F: FnMut(&str),
    {
        let Some(instruction) = mode.instruction() else {
            if !input.is_empty() {
                on_delta(input);
            }
            return Ok(input.to_string());
        };
        if input.trim().is_empty() {
            return Ok(String::new());
        }

        let body = build_request_body(&self.config.model, instruction, input, true)?;
        self.stream_request(&body, &mut on_delta)
    }

    /// 使用自定义 system prompt 进行流式 LLM 请求。
    ///
    /// 用于技能模块：传入技能的完整 system prompt，流式返回结果。
    pub fn process_with_prompt_streaming<F>(
        &self,
        system_prompt: &str,
        input: &str,
        mut on_delta: F,
    ) -> Result<String, String>
    where
        F: FnMut(&str),
    {
        if input.trim().is_empty() {
            return Ok(String::new());
        }

        let body = serde_json::to_vec(&ChatRequest {
            model: &self.config.model,
            messages: [
                ChatMessage {
                    role: "system",
                    content: system_prompt,
                },
                ChatMessage {
                    role: "user",
                    content: input,
                },
            ],
            temperature: 0.2,
            stream: true,
        })
        .map_err(|error| format!("构建 LLM 请求失败: {error}"))?;

        self.stream_request(&body, &mut on_delta)
    }

    /// 内部方法：发送流式请求并处理 SSE 响应。
    fn stream_request<F>(&self, body: &[u8], on_delta: &mut F) -> Result<String, String>
    where
        F: FnMut(&str),
    {
        let headers = self.headers();
        let mut accumulator = SseAccumulator::default();
        let response = post_bytes_with_label_and_callback(
            &self.config.endpoint,
            &headers,
            body,
            "LLM",
            |chunk| {
                accumulator.push(chunk, on_delta)
            },
        )
        .map_err(|error| error.message)?;
        ensure_success(&response)?;
        accumulator.finish(on_delta)?;
        if accumulator.output.trim().is_empty() {
            return Err("LLM 流式响应未返回文本".to_string());
        }
        Ok(accumulator.output)
    }

    fn headers(&self) -> Zeroizing<String> {
        Zeroizing::new(format!(
            "Authorization: Bearer {}\r\nContent-Type: application/json\r\nAccept: application/json\r\n",
            self.config.api_key.as_str()
        ))
    }
}

fn build_request_body(
    model: &str,
    instruction: &str,
    input: &str,
    stream: bool,
) -> Result<Vec<u8>, String> {
    let system_prompt = format!(
        "你是语音转写文字整理器。{instruction}只返回整理后的正文，不要解释，不要添加引号或 Markdown 代码块。"
    );
    serde_json::to_vec(&ChatRequest {
        model,
        messages: [
            ChatMessage {
                role: "system",
                content: &system_prompt,
            },
            ChatMessage {
                role: "user",
                content: input,
            },
        ],
        temperature: 0.2,
        stream,
    })
    .map_err(|error| format!("构建 LLM 请求失败: {error}"))
}

fn parse_chat_response(response: HttpResponse) -> Result<String, String> {
    ensure_success(&response)?;
    let response = serde_json::from_slice::<ChatResponse>(&response.body)
        .map_err(|error| format!("LLM 响应格式无效: {error}"))?;
    let text = response
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "LLM 返回了空文本".to_string())?;
    Ok(text)
}

fn ensure_success(response: &HttpResponse) -> Result<(), String> {
    if (200..300).contains(&response.status) {
        return Ok(());
    }
    let body = String::from_utf8_lossy(&response.body);
    let detail: String = body.chars().take(MAX_ERROR_BODY_CHARS).collect();
    if detail.trim().is_empty() {
        Err(format!("LLM 返回错误 {}", response.status))
    } else {
        Err(format!("LLM 返回错误 {}: {detail}", response.status))
    }
}

#[derive(Default)]
struct SseAccumulator {
    pending: Vec<u8>,
    output: String,
    done: bool,
}

impl SseAccumulator {
    fn push<F>(&mut self, chunk: &[u8], on_delta: &mut F) -> Result<(), String>
    where
        F: FnMut(&str),
    {
        self.pending.extend_from_slice(chunk);
        while let Some(newline) = self.pending.iter().position(|byte| *byte == b'\n') {
            let mut line = self.pending.drain(..=newline).collect::<Vec<_>>();
            if line.last() == Some(&b'\n') {
                line.pop();
            }
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            self.consume_line(&line, on_delta)?;
        }
        Ok(())
    }

    fn finish<F>(&mut self, on_delta: &mut F) -> Result<(), String>
    where
        F: FnMut(&str),
    {
        if !self.pending.is_empty() {
            let line = std::mem::take(&mut self.pending);
            self.consume_line(&line, on_delta)?;
        }
        Ok(())
    }

    fn consume_line<F>(&mut self, line: &[u8], on_delta: &mut F) -> Result<(), String>
    where
        F: FnMut(&str),
    {
        if self.done {
            return Ok(());
        }
        let line = std::str::from_utf8(line)
            .map_err(|error| format!("LLM 流式响应不是有效 UTF-8: {error}"))?
            .trim();
        let Some(data) = line.strip_prefix("data:") else {
            return Ok(());
        };
        let data = data.trim();
        if data == "[DONE]" {
            self.done = true;
            return Ok(());
        }
        if data.is_empty() {
            return Ok(());
        }
        let chunk = serde_json::from_str::<StreamResponse>(data)
            .map_err(|error| format!("LLM 流式响应格式无效: {error}"))?;
        for delta in chunk
            .choices
            .into_iter()
            .filter_map(|choice| choice.delta.content)
            .filter(|delta| !delta.is_empty())
        {
            on_delta(&delta);
            self.output.push_str(&delta);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};
    use std::thread;

    fn serve(response_body: &'static str, content_type: &'static str) -> (String, Arc<Mutex<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("binds test server");
        let address = listener.local_addr().expect("has address");
        let request = Arc::new(Mutex::new(String::new()));
        let request_copy = Arc::clone(&request);
        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accepts request");
            let mut bytes = Vec::new();
            let mut buffer = [0_u8; 4096];
            loop {
                let read = stream.read(&mut buffer).expect("reads request");
                if read == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..read]);
                if let Some(headers_end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..headers_end + 4]);
                    let content_length = headers
                        .lines()
                        .find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length: ").map(str::to_string))
                        .and_then(|value| value.trim().parse::<usize>().ok())
                        .unwrap_or(0);
                    if bytes.len() >= headers_end + 4 + content_length {
                        break;
                    }
                }
            }
            *request_copy.lock().expect("locks request") = String::from_utf8_lossy(&bytes).into_owned();
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
                response_body.len()
            );
            stream.write_all(response.as_bytes()).expect("writes response");
        });
        (format!("http://{address}/v1/chat/completions"), request)
    }

    fn client(endpoint: String) -> LlmClient {
        LlmClient::new(LlmConfig {
            endpoint,
            api_key: Zeroizing::new("test-key".to_string()),
            model: "test-model".to_string(),
        })
        .expect("creates client")
    }

    #[test]
    fn mode_prompts_cover_all_requested_behaviors() {
        assert!(TextProcessMode::Off.instruction().is_none());
        assert!(TextProcessMode::Proofread.instruction().expect("prompt").contains("保留原意"));
        assert!(TextProcessMode::Polish.instruction().expect("prompt").contains("流畅"));
        assert!(TextProcessMode::Structure.instruction().expect("prompt").contains("分段"));
    }

    #[cfg(windows)]
    #[test]
    fn sends_non_streaming_openai_compatible_request() {
        let (endpoint, request) = serve(
            r#"{"choices":[{"message":{"content":"整理后的文本"}}]}"#,
            "application/json",
        );
        let result = client(endpoint)
            .organize(TextProcessMode::Polish, "原始文本")
            .expect("organizes");
        assert_eq!(result, "整理后的文本");
        let request = request.lock().expect("locks request");
        assert!(request.contains("Authorization: Bearer test-key"));
        assert!(request.contains(r#""stream":false"#));
        assert!(request.contains("原始文本"));
    }

    #[cfg(windows)]
    #[test]
    fn parses_streaming_openai_compatible_response() {
        let response = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"整理\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"完成\"}}]}\n\n",
            "data: [DONE]\n\n"
        );
        let (endpoint, request) = serve(response, "text/event-stream");
        let mut deltas = Vec::new();
        let result = client(endpoint)
            .organize_streaming(TextProcessMode::Proofread, "原始文本", |delta| {
                deltas.push(delta.to_string())
            })
            .expect("streams");
        assert_eq!(result, "整理完成");
        assert_eq!(deltas, vec!["整理", "完成"]);
        assert!(request.lock().expect("locks request").contains(r#""stream":true"#));
    }

    #[test]
    fn sse_parser_handles_utf8_split_across_chunks() {
        let payload = "data: {\"choices\":[{\"delta\":{\"content\":\"中文\"}}]}\n\n".as_bytes();
        let split = payload.iter().position(|byte| *byte >= 0x80).expect("contains utf8") + 1;
        let mut parser = SseAccumulator::default();
        let mut deltas = Vec::new();
        parser.push(&payload[..split], &mut |delta| deltas.push(delta.to_string())).expect("first chunk");
        parser.push(&payload[split..], &mut |delta| deltas.push(delta.to_string())).expect("second chunk");
        parser.finish(&mut |delta| deltas.push(delta.to_string())).expect("finishes");
        assert_eq!(parser.output, "中文");
        assert_eq!(deltas, vec!["中文"]);
    }
}
