# TerminalVoice 语音识别（ASR）配置指南

## 配置入口

面板窗口 → 底部「...」更多按钮 → **服务配置** → 语音识别(ASR)部分。

---

## 三种模式说明

| 模式 | 说明 | 当前状态 |
|:---|:---|:---|
| **智能切换** | 优先云端，失败自动降级离线 | 离线引擎尚未实现，降级不会生效 |
| **仅云端** | 始终使用云端 ASR，精度高 | ✅ 可用，推荐 |
| **仅离线** | 使用本地模型，无需网络 | 🔴 未实现（推理引擎尚未接入） |

> ⚠️ **离线模式当前不可用**，请选择 **仅云端** 模式。离线模型管理页面虽然可以下载 whisper-tiny/whisper-base 模型，但推理引擎尚未接入。

---

## 云端 ASR 配置说明

云端 ASR 使用 **OpenAI Whisper API 兼容协议**（HTTP POST multipart/form-data + Bearer Token 认证），需配置三个字段：

| 字段 | 说明 |
|:---|:---|
| **API Endpoint** | 识别接口地址，必须指向 `/audio/transcriptions` 端点 |
| **Model** | 模型名称，各服务商不同 |
| **API Key** | 你的密钥，本地使用 Windows DPAPI 加密存储 |

请求格式：
- `file`：WAV 音频（16kHz 采样率）
- `model`：模型名称
- `language`：硬编码为 `zh`（中文）
- 响应格式：JSON `{"text": "识别结果"}`

---

## 支持的服务商配置

### 方案一：OpenAI 官方（默认）

| 字段 | 值 |
|:---|:---|
| API Endpoint | `https://api.openai.com/v1/audio/transcriptions` |
| Model | `whisper-1` |
| API Key | 从 OpenAI 平台获取 |

- **官网**：https://platform.openai.com
- **API Key 获取**：https://platform.openai.com/api-keys
- **文档**：https://platform.openai.com/docs/guides/speech-to-text
- **费用**：$0.006 / 分钟
- **注意**：需要可访问 OpenAI 的网络环境

---

### 方案二：Groq（速度极快，推荐）

Groq 提供 Whisper large-v3 的高速推理，延迟极低，免费额度充足。

| 字段 | 值 |
|:---|:---|
| API Endpoint | `https://api.groq.com/openai/v1/audio/transcriptions` |
| Model | `whisper-large-v3-turbo`（或 `whisper-large-v3`） |
| API Key | 从 Groq Console 获取（`gsk_` 开头） |

- **官网**：https://groq.com
- **API Key（免费注册）**：https://console.groq.com/keys
- **文档**：https://console.groq.com/docs/speech-text
- **费用**：免费额度约每天 14,400 秒；付费 $0.04-0.22 / 小时

---

### 方案三：本地部署 Whisper（完全免费）

本地运行 Whisper 服务（如 whisper.cpp server、faster-whisper-server 等），暴露 OpenAI 兼容端点即可：

| 字段 | 值（示例） |
|:---|:---|
| API Endpoint | `http://localhost:8080/v1/audio/transcriptions` |
| Model | 本地加载的模型名（如 `base`/`small`/`medium`） |
| API Key | 本地服务通常不需要，填任意非空值（如 `sk-local`） |

- **whisper.cpp server**：https://github.com/ggerganov/whisper.cpp/tree/master/examples/server
- **faster-whisper-server**：参见 GitHub 上的开源实现（如 `faster-whisper-server`、`whisperX` 等）

---

### 方案四：OpenAI 兼容中转/代理服务

任何兼容 OpenAI `/v1/audio/transcriptions` 格式的中转服务均可使用，如 One-API、New-API、各类 API 聚合平台等，填入对应服务商提供的 endpoint、model 和 key 即可。

---

## 详细配置步骤（以 Groq 为例）

1. 打开 https://console.groq.com/keys ，使用 GitHub 或 Google 账号登录
2. 点击 **Create API Key**，复制生成的密钥（以 `gsk_` 开头，请注意保存，只显示一次）
3. 回到 TerminalVoice 服务配置页面：
   - 模式选择 **仅云端**
   - API Endpoint 填入：`https://api.groq.com/openai/v1/audio/transcriptions`
   - Model 填入：`whisper-large-v3-turbo`
   - API Key 粘贴刚才复制的 Groq Key
4. 点击页面下方的「测试 ASR 连接」按钮
5. 提示连接成功后，即可按住 **Right Alt** 开始语音输入

---

## 注意事项

- `language` 参数当前硬编码为中文（`zh`），识别中文无需额外设置
- API Key 使用 Windows DPAPI 加密存储在本地 SQLite 数据库中，不会明文存储
- 网络请求超时时间为 60 秒，5xx 和 429 错误会自动重试一次
- 若使用 HTTP（非 HTTPS）本地端点，请确保地址以 `http://` 开头
- 离线推理引擎（whisper.cpp ggml 模型）尚在开发中，当前版本暂不可用
