import { invoke } from "@tauri-apps/api/core";
import type {
  AppStatus,
  AudioInputDevice,
  ConfigEntry,
  ConfirmPreviewInput,
  FilterWord,
  HistoryItem,
  HotkeyConfig,
  ModelInfo,
  PreviewDraft,
  UpdateInfo,
  VoiceSkill,
} from "./types";

const COMMANDS = {
  getAppStatus: "get_app_status",
  createMockPreview: "create_mock_preview",
  confirmPreview: "confirm_preview",
  cancelPreview: "cancel_preview",
  injectText: "inject_text",
  testAsrConnection: "test_asr_connection",
  listHistory: "list_history",
  deleteHistory: "delete_history",
  clearHistory: "clear_history",
  searchHistory: "search_history",
  reinjectHistory: "reinject_history",
  getConfig: "get_config",
  setConfig: "set_config",
  listConfig: "list_config",
  listAudioInputDevices: "list_audio_input_devices",
  listFilterWords: "list_filter_words",
  addFilterWord: "add_filter_word",
  deleteFilterWord: "delete_filter_word",
  toggleFilterWord: "toggle_filter_word",
  listModels: "list_models",
  downloadModel: "download_model",
  deleteModel: "delete_model",
  exportData: "export_data",
  importData: "import_data",
  listSkills: "list_skills",
  setSkill: "set_skill",
  getActiveSkill: "get_active_skill",
  setHotkeyConfig: "set_hotkey_config",
  getAppVersion: "get_app_version",
} as const;

export async function getAppStatus(): Promise<AppStatus> {
  return invoke<AppStatus>(COMMANDS.getAppStatus);
}

export async function createMockPreview(rawText: string): Promise<PreviewDraft> {
  return invoke<PreviewDraft>(COMMANDS.createMockPreview, { rawText });
}

export async function confirmPreview(input: ConfirmPreviewInput): Promise<void> {
  await invoke<void>(COMMANDS.confirmPreview, { input });
}

export async function cancelPreview(): Promise<void> {
  await invoke<void>(COMMANDS.cancelPreview);
}

export async function injectText(text: string): Promise<void> {
  await invoke<void>(COMMANDS.injectText, { text });
}

export async function testAsrConnection(): Promise<boolean> {
  return invoke<boolean>(COMMANDS.testAsrConnection);
}

export async function listHistory(): Promise<HistoryItem[]> {
  return invoke<HistoryItem[]>(COMMANDS.listHistory);
}

export async function deleteHistory(id: number): Promise<void> {
  await invoke<void>(COMMANDS.deleteHistory, { id });
}

export async function clearHistory(): Promise<void> {
  await invoke<void>(COMMANDS.clearHistory);
}

export async function searchHistory(query: string): Promise<HistoryItem[]> {
  return invoke<HistoryItem[]>(COMMANDS.searchHistory, { query });
}

export async function reinjectHistory(id: number): Promise<void> {
  await invoke<void>(COMMANDS.reinjectHistory, { id });
}

export async function getConfig(key: string): Promise<string | null> {
  return invoke<string | null>(COMMANDS.getConfig, { key });
}

export async function setConfig(key: string, value: string): Promise<void> {
  await invoke<void>(COMMANDS.setConfig, { key, value });
}

export async function listConfig(): Promise<ConfigEntry[]> {
  return invoke<ConfigEntry[]>(COMMANDS.listConfig);
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  return invoke<AudioInputDevice[]>(COMMANDS.listAudioInputDevices);
}

export async function listFilterWords(): Promise<FilterWord[]> {
  return invoke<FilterWord[]>(COMMANDS.listFilterWords);
}

export async function addFilterWord(word: string, replacement?: string): Promise<number> {
  return invoke<number>(COMMANDS.addFilterWord, { word, replacement });
}

export async function deleteFilterWord(id: number): Promise<void> {
  await invoke<void>(COMMANDS.deleteFilterWord, { id });
}

export async function toggleFilterWord(id: number): Promise<void> {
  await invoke<void>(COMMANDS.toggleFilterWord, { id });
}

export async function listModels(): Promise<ModelInfo[]> {
  return invoke<ModelInfo[]>(COMMANDS.listModels);
}

export async function downloadModel(modelId: string): Promise<void> {
  await invoke<void>(COMMANDS.downloadModel, { modelId });
}

export async function deleteModel(modelId: string): Promise<void> {
  await invoke<void>(COMMANDS.deleteModel, { modelId });
}

export async function exportData(): Promise<number[]> {
  return invoke<number[]>(COMMANDS.exportData);
}

export async function importData(data: number[]): Promise<void> {
  await invoke<void>(COMMANDS.importData, { data });
}

export async function listSkills(): Promise<VoiceSkill[]> {
  return invoke<VoiceSkill[]>(COMMANDS.listSkills);
}

export async function setSkill(skillId: string): Promise<void> {
  await invoke<void>(COMMANDS.setSkill, { skillId });
}

export async function getActiveSkill(): Promise<string | null> {
  return invoke<string | null>(COMMANDS.getActiveSkill);
}

export async function setHotkeyConfig(config: HotkeyConfig): Promise<void> {
  await invoke<void>(COMMANDS.setHotkeyConfig, { payload: config });
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>(COMMANDS.getAppVersion);
}
