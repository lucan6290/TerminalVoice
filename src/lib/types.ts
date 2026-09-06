export type AppStatus = "Idle" | "Recording" | "Recognizing" | "Preview" | "Paused";

export interface ConfigEntry {
  key: string;
  value: string;
}

export interface AudioInputDevice {
  name: string;
}

export type TextMode = "Normal" | "Developer" | "Raw";

export type TextProcessMode = "off" | "proofread" | "polish" | "structure";

export interface HistoryItem {
  id: number;
  createdAt: string;
  sourceText: string;
  finalText: string;
  textMode: TextMode;
  asrProvider: string;
}

export type PreviewMode = "recognition" | "rewrite";

export interface PreviewDraft {
  mode?: PreviewMode;
  sourceText: string;
  processedText: string;
  textMode: TextMode;
  asrProvider: string;
}

export interface ConfirmPreviewInput {
  mode?: PreviewMode;
  sourceText: string;
  finalText: string;
  textMode: TextMode;
  asrProvider: string;
}

export interface FilterWord {
  id: number;
  word: string;
  replacement: string;
  enabled: boolean;
  isDefault?: boolean;
  createdAt?: string;
}

export type ASRProvider = "cloud" | "offline" | "auto";

export interface ServiceConfig {
  asrProvider: ASRProvider;
  asrEndpoint: string;
  asrApiKey: string;
  asrModel: string;
  llmEndpoint: string;
  llmApiKey: string;
  llmModel: string;
  textMode: TextProcessMode;
  handsFree: boolean;
  translateTargetLang: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  sizeBytes: number;
  sha256: string;
  downloadUrl: string;
  installed: boolean;
}

/** 翻译结果事件 payload */
export interface TranslateResultPayload {
  originalText: string;
  translatedText: string;
}

/** 改写结果事件 payload */
export interface RewriteResultPayload {
  originalText: string;
  rewrittenText: string;
}

/** 录音计时事件 payload */
export interface RecordingTickPayload {
  duration: number;
}

/** Toast 通知事件 payload */
export interface ToastPayload {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

/** 语音技能 */
export interface VoiceSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

/** LLM 流式输出事件 payload */
export interface LlmStreamingDeltaPayload {
  delta: string;
  accumulated: string;
}
