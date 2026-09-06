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

> 🇨🇳 标注 = 国内可直连，无需科学上网

### 🏆 方案一：硅基流动 SiliconFlow（免费 · 国内直连 · 中文优秀 · 首推）

硅基流动（SiliconFlow）是国内 AI 推理平台，提供**两个永久免费**的 ASR 模型，完全兼容 OpenAI Whisper API 格式，国内直连延迟低，中文识别效果优秀。

| 字段 | 值 |
|:---|:---|
| API Endpoint | `https://api.siliconflow.cn/v1/audio/transcriptions` |
| Model | `FunAudioLLM/SenseVoiceSmall`（推荐，中文效果好）或 `TeleAI/TeleSpeechASR` |
| API Key | 从硅基流动控制台获取（`sk-` 开头） |

- **官网**：https://siliconflow.cn
- **注册地址**：https://cloud.siliconflow.cn/account/register（支持手机号注册）
- **API Key 获取**：https://cloud.siliconflow.cn/account/ak
- **文档**：https://docs.siliconflow.cn/cn/userguide/capabilities/audio
- **费用**：
  - `FunAudioLLM/SenseVoiceSmall` 和 `TeleAI/TeleSpeechASR` **永久免费**（有并发限制，个人使用完全够用）
  - 新用户注册赠送 2000 万 Token 免费额度
  - 付费模型如 `Qwen3-Omni-30B-A3B-Instruct` 约 ￥0.02/分钟
- **注意**：需要完成实名认证（国内手机号+身份证），Endpoint 域名是 `.cn` 不是 `.com`（`.com` 会返回 401）

**配置步骤**：
1. 打开 https://cloud.siliconflow.cn/account/register 用手机号注册
2. 完成实名认证（免费，几分钟完成）
3. 进入 https://cloud.siliconflow.cn/account/ak ，点击「新建 API 密钥」，复制密钥
4. 填入 TerminalVoice：
   - 模式选 **仅云端**
   - API Endpoint：`https://api.siliconflow.cn/v1/audio/transcriptions`
   - Model：`FunAudioLLM/SenseVoiceSmall`
   - API Key：粘贴你的密钥
5. 点击「测试 ASR 连接」验证

---

### 方案二：Groq（速度极快 · 需科学上网）

Groq 提供 Whisper large-v3 的高速推理，延迟极低。免费额度每天 2000 次调用。

| 字段 | 值 |
|:---|:---|
| API Endpoint | `https://api.groq.com/openai/v1/audio/transcriptions` |
| Model | `whisper-large-v3-turbo`（或 `whisper-large-v3`） |
| API Key | 从 Groq Console 获取（`gsk_` 开头） |

- **官网**：https://groq.com
- **API Key（免费注册）**：https://console.groq.com/keys（GitHub/Google 账号登录）
- **文档**：https://console.groq.com/docs/speech-text
- **费用**：Free Plan 每天约 2000 次调用；付费 $0.04-0.22 / 小时
- **注意**：国内访问需要科学上网

---

### 方案三：OpenAI 官方

| 字段 | 值 |
|:---|:---|
| API Endpoint | `https://api.openai.com/v1/audio/transcriptions` |
| Model | `whisper-1` |
| API Key | 从 OpenAI 平台获取 |

- **官网**：https://platform.openai.com
- **API Key 获取**：https://platform.openai.com/api-keys
- **文档**：https://platform.openai.com/docs/guides/speech-to-text
- **费用**：$0.006 / 分钟（约 ¥0.04/分钟）
- **注意**：需要可访问 OpenAI 的网络环境+国际信用卡

---

### 方案四：Deepgram（每月200分钟免费 · 海外服务）

Deepgram 提供 Nova-3 模型，每月 200 分钟免费额度。

| 字段 | 值 |
|:---|:---|
| API Endpoint | `https://api.deepgram.com/v1/listen`（非标准 Whisper 格式，需适配） |
| Model | `nova-3` |
| API Key | 从 Deepgram Console 获取 |

- **官网**：https://deepgram.com
- **免费额度**：每月 200 分钟
- **注意**：API 格式不完全兼容 OpenAI Whisper，需要后端适配（当前代码暂不支持）

---

### 方案五：本地部署 Whisper（完全免费 · 需自己搭服务）

本地运行 Whisper 服务（如 whisper.cpp server、faster-whisper-server 等），暴露 OpenAI 兼容端点即可：

| 字段 | 值（示例） |
|:---|:---|
| API Endpoint | `http://localhost:8080/v1/audio/transcriptions` |
| Model | 本地加载的模型名（如 `base`/`small`/`medium`） |
| API Key | 本地服务通常不需要，填任意非空值（如 `sk-local`） |

- **whisper.cpp server**：https://github.com/ggerganov/whisper.cpp/tree/master/examples/server（轻量，CPU 即可运行）
- **faster-whisper-server**：https://github.com/fedirz/faster-whisper-server（基于 faster-whisper，GPU 加速）
- **FunASR**（阿里达摩院，中文效果最佳）：https://github.com/modelscope/FunASR

---

### 方案六：OpenAI 兼容中转/代理服务

任何兼容 OpenAI `/v1/audio/transcriptions` 格式的中转服务均可使用，如：
- 国内的各类 API 聚合平台（支持 Whisper 接口的）
- One-API / New-API 自建中转
- 各云厂商的 OpenAI 兼容代理

填入对应服务商提供的 endpoint、model 和 key 即可。

---

## 快速推荐

| 你的情况 | 推荐方案 |
|:---|:---|
| 国内用户，想零成本直接用 | ✅ **硅基流动 SiliconFlow**（免费 + 国内直连 + 中文好） |
| 有科学上网条件，追求速度 | Groq |
| 愿意付费，追求最佳效果 | OpenAI `whisper-1` 或 gpt-4o-transcribe |
| 不想依赖网络 | 等待离线模式更新，或本地部署 whisper.cpp |

---

## 注意事项

- `language` 参数当前硬编码为中文（`zh`），识别中文无需额外设置
- API Key 使用 Windows DPAPI 加密存储在本地 SQLite 数据库中，不会明文存储
- 网络请求超时时间为 60 秒，5xx 和 429 错误会自动重试一次
- 若使用 HTTP（非 HTTPS）本地端点，请确保地址以 `http://` 开头
- 离线推理引擎（whisper.cpp ggml 模型）尚在开发中，当前版本暂不可用
