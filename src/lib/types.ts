export type AppStatus = "Idle" | "Recording" | "Recognizing" | "Preview" | "Paused";

export type TextMode = "Normal" | "Developer" | "Raw";

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
