import { create } from "zustand";
import {
  listConfig,
  setConfig,
  listHistory,
  deleteHistory as ipcDeleteHistory,
  clearHistory as ipcClearHistory,
  reinjectHistory as ipcReinjectHistory,
  listFilterWords,
  addFilterWord as ipcAddFilterWord,
  deleteFilterWord as ipcDeleteFilterWord,
  toggleFilterWord as ipcToggleFilterWord,
  listModels,
  downloadModel as ipcDownloadModel,
  deleteModel as ipcDeleteModel,
} from "../lib/commands";
import type {
  AppStatus,
  ConfigEntry,
  FilterWord,
  HistoryItem,
  ModelInfo,
  PreviewDraft,
  ServiceConfig,
  TextProcessMode,
  TranslateResultPayload,
  RewriteResultPayload,
} from "../lib/types";

/** 底部功能 Tab 类型 */
export type TabKey = "skill" | "dict" | "history" | "help" | "service";

const CONFIG_KEYS = {
  dark: "ui.dark",
  soundOn: "ui.soundOn",
  muteSys: "ui.muteSys",
  autoStart: "ui.autoStart",
  pttKey: "input.pttKey",
  micDevice: "input.micDevice",
  asrProvider: "service.asrProvider",
  asrEndpoint: "service.asrEndpoint",
  asrApiKey: "service.asrApiKey",
  asrModel: "service.asrModel",
  llmEndpoint: "service.llmEndpoint",
  llmApiKey: "service.llmApiKey",
  llmModel: "service.llmModel",
  textMode: "service.textMode",
  handsFree: "service.handsFree",
} as const;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

function persist(key: string, value: string): void {
  void setConfig(key, value).catch((error) => {
    console.warn("[TerminalVoice] 保存配置失败:", key, error);
  });
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

const DEFAULT_SERVICE: ServiceConfig = {
  asrProvider: "auto",
  asrEndpoint: "https://api.openai.com/v1/audio/transcriptions",
  asrApiKey: "",
  asrModel: "whisper-1",
  llmEndpoint: "https://api.openai.com/v1/chat/completions",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
  textMode: "polish",
  handsFree: false,
};

// ==================== Panel State ====================
export interface PanelState {
  // UI state
  dark: boolean;
  activeTab: TabKey | null;
  appStatus: AppStatus;
  previewDraft: PreviewDraft | null;

  // Quick settings (home view)
  pttKey: string;
  micDevice: string;
  soundOn: boolean;
  muteSys: boolean;
  autoStart: boolean;

  // Service config
  service: ServiceConfig;

  // Data
  historyItems: HistoryItem[];
  filterWords: FilterWord[];
  models: ModelInfo[];
  downloadingModels: string[];
  serviceReady: boolean;
  quotaDisplay: string;

  // Runtime feature state
  rewriteMode: boolean;
  ttsSpeaking: boolean;
  translateResult: TranslateResultPayload | null;
  rewriteResult: RewriteResultPayload | null;
  recordingDuration: number;
  errorMessage: string | null;

  // Actions
  toggleDark: () => void;
  setActiveTab: (tab: TabKey | null) => void;
  setRuntimeStatus: (status: AppStatus) => void;
  setPreviewDraft: (draft: PreviewDraft) => void;
  clearPreviewDraft: () => void;
  hydrateFromConfig: () => Promise<void>;
  applyConfigEntry: (entry: ConfigEntry) => void;
  setSoundOn: (v: boolean) => void;
  setMuteSys: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  setPttKey: (v: string) => void;
  setMicDevice: (v: string) => void;

  // Service config actions
  setServiceConfig: (partial: Partial<ServiceConfig>) => void;

  // Data loading
  loadAll: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadFilterWords: () => Promise<void>;
  loadModels: () => Promise<void>;

  // History actions
  deleteHistory: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  reInjectHistory: (id: number) => Promise<void>;

  // Dictionary actions
  addFilterWord: (word: string, replacement: string) => Promise<void>;
  toggleFilterWord: (id: number) => Promise<void>;
  deleteFilterWord: (id: number) => Promise<void>;
  updateFilterWord: (id: number, word: string, replacement: string) => Promise<void>;

  // Model actions
  downloadModel: (id: string) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;

  // Runtime feature actions
  setRewriteMode: (v: boolean) => void;
  setTtsSpeaking: (v: boolean) => void;
  setTranslateResult: (payload: TranslateResultPayload | null) => void;
  setRewriteResult: (payload: RewriteResultPayload | null) => void;
  setRecordingDuration: (seconds: number) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  dark: true,
  activeTab: null,
  appStatus: "Idle",
  previewDraft: null,
  pttKey: "Right-Alt",
  micDevice: "自动检测",
  soundOn: true,
  muteSys: true,
  autoStart: true,

  service: DEFAULT_SERVICE,
  historyItems: [],
  filterWords: [],
  models: [],
  downloadingModels: [],
  serviceReady: false,
  quotaDisplay: "",

  rewriteMode: false,
  ttsSpeaking: false,
  translateResult: null,
  rewriteResult: null,
  recordingDuration: 0,
  errorMessage: null,

  // ---- UI actions ----
  toggleDark: () => set((state) => {
    const dark = !state.dark;
    persist(CONFIG_KEYS.dark, String(dark));
    return { dark };
  }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setRuntimeStatus: (appStatus) => set({ appStatus }),
  setPreviewDraft: (previewDraft) => set({ previewDraft, activeTab: null }),
  clearPreviewDraft: () => set({ previewDraft: null }),
  hydrateFromConfig: async () => {
    try {
      const entries = await listConfig();
      entries.forEach((entry) => usePanelStore.getState().applyConfigEntry(entry));
    } catch {
      // browser preview: Tauri not available, use defaults
    }
  },
  applyConfigEntry: (entry) => set((state) => {
    switch (entry.key) {
      case CONFIG_KEYS.dark: return { dark: parseBoolean(entry.value, state.dark) };
      case CONFIG_KEYS.soundOn: return { soundOn: parseBoolean(entry.value, state.soundOn) };
      case CONFIG_KEYS.muteSys: return { muteSys: parseBoolean(entry.value, state.muteSys) };
      case CONFIG_KEYS.autoStart: return { autoStart: parseBoolean(entry.value, state.autoStart) };
      case CONFIG_KEYS.pttKey: return { pttKey: entry.value };
      case CONFIG_KEYS.micDevice: return { micDevice: entry.value };
      case CONFIG_KEYS.asrProvider:
        if (["auto", "cloud", "offline"].includes(entry.value)) {
          return { service: { ...state.service, asrProvider: entry.value as ServiceConfig["asrProvider"] } };
        }
        return state;
      case CONFIG_KEYS.asrEndpoint: return { service: { ...state.service, asrEndpoint: entry.value } };
      case CONFIG_KEYS.asrApiKey: return { service: { ...state.service, asrApiKey: entry.value } };
      case CONFIG_KEYS.asrModel: return { service: { ...state.service, asrModel: entry.value } };
      case CONFIG_KEYS.llmEndpoint: return { service: { ...state.service, llmEndpoint: entry.value } };
      case CONFIG_KEYS.llmApiKey: return { service: { ...state.service, llmApiKey: entry.value } };
      case CONFIG_KEYS.llmModel: return { service: { ...state.service, llmModel: entry.value } };
      case CONFIG_KEYS.textMode:
        if (["off", "proofread", "polish", "structure"].includes(entry.value)) {
          return { service: { ...state.service, textMode: entry.value as TextProcessMode } };
        }
        return state;
      case CONFIG_KEYS.handsFree:
        return { service: { ...state.service, handsFree: parseBoolean(entry.value, state.service.handsFree) } };
      default: return state;
    }
  }),
  setSoundOn: (soundOn) => { persist(CONFIG_KEYS.soundOn, String(soundOn)); set({ soundOn }); },
  setMuteSys: (muteSys) => { persist(CONFIG_KEYS.muteSys, String(muteSys)); set({ muteSys }); },
  setAutoStart: (autoStart) => { persist(CONFIG_KEYS.autoStart, String(autoStart)); set({ autoStart }); },
  setPttKey: (pttKey) => { persist(CONFIG_KEYS.pttKey, pttKey); set({ pttKey }); },
  setMicDevice: (micDevice) => { persist(CONFIG_KEYS.micDevice, micDevice); set({ micDevice }); },

  // ---- Service config ----
  setServiceConfig: (partial) => {
    const mappings: [keyof ServiceConfig, string, (value: ServiceConfig[keyof ServiceConfig]) => string][] = [
      ["asrProvider", CONFIG_KEYS.asrProvider, String],
      ["asrEndpoint", CONFIG_KEYS.asrEndpoint, String],
      ["asrApiKey", CONFIG_KEYS.asrApiKey, String],
      ["asrModel", CONFIG_KEYS.asrModel, String],
      ["llmEndpoint", CONFIG_KEYS.llmEndpoint, String],
      ["llmApiKey", CONFIG_KEYS.llmApiKey, String],
      ["llmModel", CONFIG_KEYS.llmModel, String],
      ["textMode", CONFIG_KEYS.textMode, String],
      ["handsFree", CONFIG_KEYS.handsFree, String],
    ];
    for (const [field, key, serialize] of mappings) {
      const value = partial[field];
      if (value !== undefined) persist(key, serialize(value));
    }
    set((state) => {
      const service = { ...state.service, ...partial };
      const cloudReady = Boolean(service.asrEndpoint.trim() && service.asrModel.trim() && service.asrApiKey.trim());
      const offlineReady = state.models.some((m) => m.installed);
      const ready = service.asrProvider === "offline" ? offlineReady : service.asrProvider === "auto" ? cloudReady || offlineReady : cloudReady;
      return { service, serviceReady: ready };
    });
  },

  // ---- Data loading ----
  loadAll: async () => {
    const store = usePanelStore.getState();
    await Promise.allSettled([
      store.loadHistory(),
      store.loadFilterWords(),
      store.loadModels(),
      store.hydrateFromConfig(),
    ]);
  },
  loadHistory: async () => {
    if (!isTauri()) return;
    try {
      const items = await listHistory();
      set({ historyItems: items });
    } catch (error) {
      console.warn("[TerminalVoice] 加载历史失败:", error);
    }
  },
  loadFilterWords: async () => {
    if (!isTauri()) return;
    try {
      const words = await listFilterWords();
      set({ filterWords: words });
    } catch (error) {
      console.warn("[TerminalVoice] 加载过滤词失败:", error);
    }
  },
  loadModels: async () => {
    if (!isTauri()) return;
    try {
      const models = await listModels();
      set({ models });
    } catch (error) {
      console.warn("[TerminalVoice] 加载模型列表失败:", error);
    }
  },

  // ---- History ----
  deleteHistory: async (id) => {
    set((state) => ({ historyItems: state.historyItems.filter((h) => h.id !== id) }));
    if (!isTauri()) return;
    try {
      await ipcDeleteHistory(id);
    } catch (error) {
      console.warn("[TerminalVoice] 删除历史失败:", error);
      await get().loadHistory();
    }
  },
  clearHistory: async () => {
    set({ historyItems: [] });
    if (!isTauri()) return;
    try {
      await ipcClearHistory();
    } catch (error) {
      console.warn("[TerminalVoice] 清空历史失败:", error);
      await get().loadHistory();
    }
  },
  reInjectHistory: async (id) => {
    if (!isTauri()) return;
    try {
      await ipcReinjectHistory(id);
    } catch (error) {
      console.warn("[TerminalVoice] 重新上屏失败:", error);
    }
  },

  // ---- Dictionary ----
  addFilterWord: async (word, replacement) => {
    if (!isTauri()) {
      set((state) => ({
        filterWords: [...state.filterWords, { id: Date.now(), word, replacement, enabled: true }],
      }));
      return;
    }
    try {
      await ipcAddFilterWord(word, replacement || undefined);
      await get().loadFilterWords();
    } catch (error) {
      console.warn("[TerminalVoice] 添加过滤词失败:", error);
    }
  },
  toggleFilterWord: async (id) => {
    set((state) => ({
      filterWords: state.filterWords.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w),
    }));
    if (!isTauri()) return;
    try {
      await ipcToggleFilterWord(id);
    } catch (error) {
      console.warn("[TerminalVoice] 切换过滤词失败:", error);
      await get().loadFilterWords();
    }
  },
  deleteFilterWord: async (id) => {
    set((state) => ({
      filterWords: state.filterWords.filter((w) => w.id !== id),
    }));
    if (!isTauri()) return;
    try {
      await ipcDeleteFilterWord(id);
    } catch (error) {
      console.warn("[TerminalVoice] 删除过滤词失败:", error);
      await get().loadFilterWords();
    }
  },
  updateFilterWord: async (id, word, replacement) => {
    set((state) => ({
      filterWords: state.filterWords.map((w) => w.id === id ? { ...w, word, replacement } : w),
    }));
    if (!isTauri()) return;
    // Backend doesn't have an update command; delete + add
    try {
      await ipcDeleteFilterWord(id);
      await ipcAddFilterWord(word, replacement || undefined);
      await get().loadFilterWords();
    } catch (error) {
      console.warn("[TerminalVoice] 更新过滤词失败:", error);
      await get().loadFilterWords();
    }
  },

  // ---- Model ----
  downloadModel: async (id) => {
    if (!isTauri()) return;
    set((state) => ({
      downloadingModels: [...state.downloadingModels, id],
    }));
    try {
      await ipcDownloadModel(id);
      await get().loadModels();
    } catch (error) {
      console.warn("[TerminalVoice] 下载模型失败:", error);
    } finally {
      set((state) => ({
        downloadingModels: state.downloadingModels.filter((m) => m !== id),
      }));
    }
  },
  deleteModel: async (id) => {
    if (!isTauri()) return;
    try {
      await ipcDeleteModel(id);
      await get().loadModels();
    } catch (error) {
      console.warn("[TerminalVoice] 删除模型失败:", error);
    }
  },

  // ---- Runtime feature actions ----
  setRewriteMode: (rewriteMode) => set({ rewriteMode }),
  setTtsSpeaking: (ttsSpeaking) => set({ ttsSpeaking }),
  setTranslateResult: (translateResult) => set({ translateResult }),
  setRewriteResult: (rewriteResult) => set({ rewriteResult }),
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}));
