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
  created_at: string;
  source_text: string;
  final_text: string;
  text_mode: TextMode;
  asr_provider: string;
}

export interface PreviewDraft {
  sourceText: string;
  processedText: string;
  textMode: TextMode;
  asrProvider: string;
}

export interface ConfirmPreviewInput {
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
}

export interface LocalModel {
  id: string;
  name: string;
  size: string;
  language: string;
  downloaded: boolean;
  downloadProgress?: number;
}
