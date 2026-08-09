import { invoke } from "@tauri-apps/api/core";
import type { AppStatus, ConfirmPreviewInput, HistoryItem, PreviewDraft } from "./types";

const COMMANDS = {
  getAppStatus: "get_app_status",
  createMockPreview: "create_mock_preview",
  confirmPreview: "confirm_preview",
  listHistory: "list_history",
} as const;

export async function getAppStatus(): Promise<AppStatus> {
  return invoke<AppStatus>(COMMANDS.getAppStatus);
}

export async function createMockPreview(rawText: string): Promise<PreviewDraft> {
  return invoke<PreviewDraft>(COMMANDS.createMockPreview, { rawText });
}

export async function confirmPreview(input: ConfirmPreviewInput): Promise<HistoryItem> {
  return invoke<HistoryItem>(COMMANDS.confirmPreview, { input });
}

export async function listHistory(): Promise<HistoryItem[]> {
  return invoke<HistoryItem[]>(COMMANDS.listHistory);
}
