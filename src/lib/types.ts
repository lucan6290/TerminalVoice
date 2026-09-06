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
  durationMs?: number | null;
  audioFilePath?: string | null;
  llmRewritten?: boolean | null;
  skillId?: string | null;
  appContext?: string | null;
}

export type PreviewMode = "recognition" | "rewrite";

export interface PreviewDraft {
  mode: PreviewMode;
  sourceText: string;
  processedText: string;
  textMode: TextMode;
  asrProvider: string;
  durationMs?: number | null;
  llmRewritten?: boolean | null;
  skillId?: string | null;
}

export interface ConfirmPreviewInput {
  mode: PreviewMode;
  sourceText: string;
  finalText: string;
  textMode: TextMode;
  asrProvider: string;
  durationMs?: number | null;
  llmRewritten?: boolean | null;
  skillId?: string | null;
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
  asrFullUrl: boolean;
  asrApiKey: string;
  asrModel: string;
  llmEndpoint: string;
  llmFullUrl: boolean;
  llmApiKey: string;
  llmModel: string;
  textMode: TextProcessMode;
  handsFree: boolean;
  translateTargetLang: string;
  /** 识别后是否跳过预览窗口直接上屏（true=直接上屏，false=弹预览窗口手动确认） */
  skipPreview: boolean;
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

/** 更新信息 */
export interface UpdateInfo {
  currentVersion: string;
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  hasUpdate: boolean;
}

/** 更新下载进度事件 payload */
export interface UpdateProgressPayload {
  percent: number;
}

/** 热键配置（字符串按键名，与后端 parse_hotkey 对应） */
export interface HotkeyConfig {
  pttKey: string;
  ttsKey: string;
  translateKey: string;
}

/** 默认热键配置 */
export const DEFAULT_HOTKEY_CONFIG: HotkeyConfig = {
  pttKey: "RightAlt",
  ttsKey: "1",
  translateKey: "2",
};
