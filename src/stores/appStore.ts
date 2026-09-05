import { create } from "zustand";
import { listConfig, setConfig } from "../lib/commands";
import type {
  AppStatus,
  ConfigEntry,
  FilterWord,
  HistoryItem,
  LocalModel,
  ServiceConfig,
  TextProcessMode,
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

// ==================== Mock 数据 ====================
const MOCK_HISTORY: HistoryItem[] = [
  {
    id: 1,
    created_at: "2026-09-05 14:32",
    source_text: "明天下午三点开个会讨论一下项目进度",
    final_text: "明天下午3点开个会，讨论项目进度。",
    text_mode: "Normal",
    asr_provider: "云端ASR",
  },
  {
    id: 2,
    created_at: "2026-09-05 14:28",
    source_text: "帮我把这段文字改成更正式的语气",
    final_text: "请将此段文字调整为更为正式的表述风格。",
    text_mode: "Normal",
    asr_provider: "云端ASR",
  },
  {
    id: 3,
    created_at: "2026-09-05 11:05",
    source_text: "const result = await fetch(url); const data = await result.json();",
    final_text: "const result = await fetch(url);\nconst data = await result.json();",
    text_mode: "Developer",
    asr_provider: "云端ASR",
  },
  {
    id: 4,
    created_at: "2026-09-04 18:47",
    source_text: "那个文件放在d盘projects目录下面",
    final_text: "那个文件放在D盘Projects目录下面。",
    text_mode: "Normal",
    asr_provider: "离线Whisper",
  },
  {
    id: 5,
    created_at: "2026-09-04 09:15",
    source_text: "今天的天气怎么样",
    final_text: "今天的天气怎么样？",
    text_mode: "Normal",
    asr_provider: "云端ASR",
  },
];

const MOCK_FILTER_WORDS: FilterWord[] = [
  { id: 1, word: "嗯", replacement: "", enabled: true },
  { id: 2, word: "那个", replacement: "", enabled: true },
  { id: 3, word: "就是说", replacement: "", enabled: true },
  { id: 4, word: "然后", replacement: "", enabled: false },
  { id: 5, word: "啊", replacement: "", enabled: true },
];

const MOCK_LOCAL_MODELS: LocalModel[] = [
  { id: "sensevoice-small", name: "SenseVoice Small", size: "220 MB", language: "中文/英文/日文/韩文", downloaded: true },
  { id: "whisper-base", name: "Whisper Base", size: "140 MB", language: "多语言", downloaded: false },
  { id: "whisper-small", name: "Whisper Small", size: "460 MB", language: "多语言", downloaded: false },
  { id: "paraformer-zh", name: "Paraformer 中文", size: "210 MB", language: "中文", downloaded: false },
];

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
  recording: boolean;

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
  localModels: LocalModel[];
  serviceReady: boolean;
  quotaDisplay: string;

  // Actions
  toggleDark: () => void;
  setActiveTab: (tab: TabKey | null) => void;
  toggleRecording: () => void;
  setRuntimeStatus: (status: AppStatus) => void;
  hydrateFromConfig: () => Promise<void>;
  applyConfigEntry: (entry: ConfigEntry) => void;
  setSoundOn: (v: boolean) => void;
  setMuteSys: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  setPttKey: (v: string) => void;
  setMicDevice: (v: string) => void;

  // Service config actions
  setServiceConfig: (partial: Partial<ServiceConfig>) => void;

  // History actions
  deleteHistory: (id: number) => void;
  clearHistory: () => void;
  reInjectHistory: (id: number) => void;

  // Dictionary actions
  addFilterWord: (word: string, replacement: string) => void;
  toggleFilterWord: (id: number) => void;
  deleteFilterWord: (id: number) => void;
  updateFilterWord: (id: number, word: string, replacement: string) => void;

  // Model actions
  downloadModel: (id: string) => void;
  deleteModel: (id: string) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  dark: true,
  activeTab: null,
  appStatus: "Idle",
  recording: false,
  pttKey: "Right-Alt",
  micDevice: "自动检测（麦克风 USB_MIC）",
  soundOn: true,
  muteSys: true,
  autoStart: true,

  service: DEFAULT_SERVICE,
  historyItems: MOCK_HISTORY,
  filterWords: MOCK_FILTER_WORDS,
  localModels: MOCK_LOCAL_MODELS,
  serviceReady: true,
  quotaDisplay: "780 分 39 秒",

  // ---- UI actions ----
  toggleDark: () => set((state) => {
    const dark = !state.dark;
    persist(CONFIG_KEYS.dark, String(dark));
    return { dark };
  }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleRecording: () => set((state) => ({ recording: !state.recording })),
  setRuntimeStatus: (appStatus) => set({ appStatus, recording: appStatus === "Recording" }),
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
      default: return state;
    }
  }),
  setSoundOn: (soundOn) => { persist(CONFIG_KEYS.soundOn, String(soundOn)); set({ soundOn }); },
  setMuteSys: (muteSys) => { persist(CONFIG_KEYS.muteSys, String(muteSys)); set({ muteSys }); },
  setAutoStart: (autoStart) => { persist(CONFIG_KEYS.autoStart, String(autoStart)); set({ autoStart }); },
  setPttKey: (pttKey) => { persist(CONFIG_KEYS.pttKey, pttKey); set({ pttKey }); },
  setMicDevice: (micDevice) => { persist(CONFIG_KEYS.micDevice, micDevice); set({ micDevice }); },

  // ---- Service config ----
  setServiceConfig: (partial) => set((state) => ({ service: { ...state.service, ...partial } })),

  // ---- History ----
  deleteHistory: (id) => set((state) => ({ historyItems: state.historyItems.filter((h) => h.id !== id) })),
  clearHistory: () => set({ historyItems: [] }),
  reInjectHistory: (id) => {
    const item = get().historyItems.find((h) => h.id === id);
    if (item) {
      // Mock: copy to clipboard would happen here in real impl
      console.log("[reInject]", item.final_text);
    }
  },

  // ---- Dictionary ----
  addFilterWord: (word, replacement) => set((state) => ({
    filterWords: [...state.filterWords, { id: Date.now(), word, replacement, enabled: true }],
  })),
  toggleFilterWord: (id) => set((state) => ({
    filterWords: state.filterWords.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w),
  })),
  deleteFilterWord: (id) => set((state) => ({
    filterWords: state.filterWords.filter((w) => w.id !== id),
  })),
  updateFilterWord: (id, word, replacement) => set((state) => ({
    filterWords: state.filterWords.map((w) => w.id === id ? { ...w, word, replacement } : w),
  })),

  // ---- Model download (mock: simulate progress) ----
  downloadModel: (id) => {
    set((state) => ({
      localModels: state.localModels.map((m) => m.id === id ? { ...m, downloadProgress: 0 } : m),
    }));
    const tick = () => {
      const curr = get().localModels.find((m) => m.id === id);
      if (!curr || curr.downloaded) return;
      const p = (curr.downloadProgress ?? 0) + 10;
      if (p >= 100) {
        set((state) => ({
          localModels: state.localModels.map((m) => m.id === id ? { ...m, downloaded: true, downloadProgress: undefined } : m),
        }));
      } else {
        set((state) => ({
          localModels: state.localModels.map((m) => m.id === id ? { ...m, downloadProgress: p } : m),
        }));
        setTimeout(tick, 200);
      }
    };
    setTimeout(tick, 200);
  },
  deleteModel: (id) => set((state) => ({
    localModels: state.localModels.map((m) => m.id === id ? { ...m, downloaded: false, downloadProgress: undefined } : m),
  })),
}));
