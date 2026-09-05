import { invoke } from "@tauri-apps/api/core";
import type { AppStatus, ConfigEntry, ConfirmPreviewInput, HistoryItem, PreviewDraft } from "./types";

const COMMANDS = {
  getAppStatus: "get_app_status",
  createMockPreview: "create_mock_preview",
  confirmPreview: "confirm_preview",
  listHistory: "list_history",
  getConfig: "get_config",
  setConfig: "set_config",
  listConfig: "list_config",
} as const;

export async function getAppStatus(): Promise<AppStatus> { return invoke<AppStatus>(COMMANDS.getAppStatus); }
export async function createMockPreview(rawText: string): Promise<PreviewDraft> { return invoke<PreviewDraft>(COMMANDS.createMockPreview, { rawText }); }
export async function confirmPreview(input: ConfirmPreviewInput): Promise<HistoryItem> { return invoke<HistoryItem>(COMMANDS.confirmPreview, { input }); }
export async function listHistory(): Promise<HistoryItem[]> { return invoke<HistoryItem[]>(COMMANDS.listHistory); }
export async function getConfig(key: string): Promise<string | null> { return invoke<string | null>(COMMANDS.getConfig, { key }); }
export async function setConfig(key: string, value: string): Promise<void> { await invoke<void>(COMMANDS.setConfig, { key, value }); }
export async function listConfig(): Promise<ConfigEntry[]> { return invoke<ConfigEntry[]>(COMMANDS.listConfig); }
