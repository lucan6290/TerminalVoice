import { beforeEach, describe, expect, it, vi } from "vitest";
import { listConfig, setConfig } from "../lib/commands";
import { usePanelStore } from "./appStore";

vi.mock("../lib/commands", () => ({
  listConfig: vi.fn(),
  setConfig: vi.fn().mockResolvedValue(undefined),
  listHistory: vi.fn().mockResolvedValue([]),
  deleteHistory: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined),
  reinjectHistory: vi.fn().mockResolvedValue(undefined),
  searchHistory: vi.fn().mockResolvedValue([]),
  listFilterWords: vi.fn().mockResolvedValue([]),
  addFilterWord: vi.fn().mockResolvedValue(undefined),
  deleteFilterWord: vi.fn().mockResolvedValue(undefined),
  toggleFilterWord: vi.fn().mockResolvedValue(undefined),
  listModels: vi.fn().mockResolvedValue([]),
  downloadModel: vi.fn().mockResolvedValue(undefined),
  deleteModel: vi.fn().mockResolvedValue(undefined),
  getAppStatus: vi.fn().mockResolvedValue("Idle"),
  confirmPreview: vi.fn().mockResolvedValue(undefined),
  cancelPreview: vi.fn().mockResolvedValue(undefined),
  injectText: vi.fn().mockResolvedValue(undefined),
  testAsrConnection: vi.fn().mockResolvedValue(true),
  testLlmConnection: vi.fn().mockResolvedValue(true),
  listAudioInputDevices: vi.fn().mockResolvedValue([]),
  exportData: vi.fn().mockResolvedValue(new Uint8Array()),
  importData: vi.fn().mockResolvedValue(undefined),
  listSkills: vi.fn().mockResolvedValue([]),
  setSkill: vi.fn().mockResolvedValue(undefined),
  getActiveSkill: vi.fn().mockResolvedValue(null),
}));

const mockedListConfig = vi.mocked(listConfig);
const mockedSetConfig = vi.mocked(setConfig);

beforeEach(() => {
  vi.clearAllMocks();
  usePanelStore.setState({
    dark: true,
    activeTab: null,
    appStatus: "Idle",
    previewDraft: null,
    pttKey: "Right-Alt",
    micDevice: "自动检测（麦克风 USB_MIC）",
    soundOn: true,
    muteSys: true,
    autoStart: true,
    service: {
      asrProvider: "auto",
      asrEndpoint: "https://api.openai.com/v1/audio/transcriptions",
      asrApiKey: "",
      asrModel: "whisper-1",
      llmEndpoint: "https://api.openai.com/v1/chat/completions",
      llmApiKey: "",
      llmModel: "gpt-4o-mini",
      textMode: "polish",
      handsFree: false,
      translateTargetLang: "英文",
    },
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
  });
});

describe("usePanelStore", () => {
  it("hydrates persisted config values", async () => {
    mockedListConfig.mockResolvedValue([
      { key: "ui.dark", value: "false" },
      { key: "ui.soundOn", value: "false" },
      { key: "input.pttKey", value: "F8" },
      { key: "service.asrProvider", value: "cloud" },
      { key: "service.asrApiKey", value: "secret" },
      { key: "service.handsFree", value: "true" },
    ]);

    await usePanelStore.getState().hydrateFromConfig();

    expect(usePanelStore.getState()).toMatchObject({
      dark: false,
      soundOn: false,
      pttKey: "F8",
      service: expect.objectContaining({
        asrProvider: "cloud",
        asrApiKey: "secret",
        handsFree: true,
      }),
    });
  });

  it("persists setting changes through the config command", () => {
    usePanelStore.getState().setMuteSys(false);

    expect(usePanelStore.getState().muteSys).toBe(false);
    expect(mockedSetConfig).toHaveBeenCalledWith("ui.muteSys", "false");
  });

  it("maps backend runtime status without a separate recording state", () => {
    usePanelStore.getState().setRuntimeStatus("Recording");
    expect(usePanelStore.getState().appStatus).toBe("Recording");

    usePanelStore.getState().setRuntimeStatus("Preview");
    expect(usePanelStore.getState().appStatus).toBe("Preview");
  });

  it("persists service configuration changes", () => {
    usePanelStore.getState().setServiceConfig({
      asrProvider: "cloud",
      asrEndpoint: "https://example.test/transcriptions",
      asrApiKey: "secret",
      handsFree: true,
    });

    expect(mockedSetConfig).toHaveBeenCalledWith("service.asrProvider", "cloud");
    expect(mockedSetConfig).toHaveBeenCalledWith("service.asrEndpoint", "https://example.test/transcriptions");
    expect(mockedSetConfig).toHaveBeenCalledWith("service.asrApiKey", "secret");
    expect(mockedSetConfig).toHaveBeenCalledWith("service.handsFree", "true");
  });

  // ---- New runtime feature state tests ----

  it("sets and clears rewrite mode", () => {
    usePanelStore.getState().setRewriteMode(true);
    expect(usePanelStore.getState().rewriteMode).toBe(true);

    usePanelStore.getState().setRewriteMode(false);
    expect(usePanelStore.getState().rewriteMode).toBe(false);
  });

  it("sets and clears TTS speaking state", () => {
    usePanelStore.getState().setTtsSpeaking(true);
    expect(usePanelStore.getState().ttsSpeaking).toBe(true);

    usePanelStore.getState().setTtsSpeaking(false);
    expect(usePanelStore.getState().ttsSpeaking).toBe(false);
  });

  it("sets and clears translate result", () => {
    const payload = { originalText: "hello", translatedText: "你好" };
    usePanelStore.getState().setTranslateResult(payload);
    expect(usePanelStore.getState().translateResult).toEqual(payload);

    usePanelStore.getState().setTranslateResult(null);
    expect(usePanelStore.getState().translateResult).toBeNull();
  });

  it("sets and clears error message", () => {
    usePanelStore.getState().setErrorMessage("网络错误");
    expect(usePanelStore.getState().errorMessage).toBe("网络错误");

    usePanelStore.getState().setErrorMessage(null);
    expect(usePanelStore.getState().errorMessage).toBeNull();
  });

  it("sets recording duration", () => {
    usePanelStore.getState().setRecordingDuration(42);
    expect(usePanelStore.getState().recordingDuration).toBe(42);
  });

  // ---- Preview draft tests ----

  it("sets preview draft and switches to home tab", () => {
    usePanelStore.getState().setActiveTab("history");
    usePanelStore.getState().setPreviewDraft({
      sourceText: "原文",
      processedText: "处理后",
      textMode: "Normal",
      asrProvider: "cloud",
    });

    const state = usePanelStore.getState();
    expect(state.previewDraft).not.toBeNull();
    expect(state.activeTab).toBeNull();
  });

  it("clears preview draft", () => {
    usePanelStore.getState().setPreviewDraft({
      sourceText: "原文",
      processedText: "处理后",
      textMode: "Normal",
      asrProvider: "cloud",
    });
    usePanelStore.getState().clearPreviewDraft();
    expect(usePanelStore.getState().previewDraft).toBeNull();
  });

  // ---- loadAll test ----

  it("loadAll resolves without errors in browser mode", async () => {
    // In jsdom (not Tauri), loadAll should complete without throwing
    await expect(usePanelStore.getState().loadAll()).resolves.toBeUndefined();
  });

  // ---- Optimistic update tests ----

  it("optimistically deletes history item from local state", async () => {
    usePanelStore.setState({
      historyItems: [
        { id: 1, createdAt: "2024-01-01", sourceText: "a", finalText: "a", textMode: "Normal", asrProvider: "cloud" },
        { id: 2, createdAt: "2024-01-02", sourceText: "b", finalText: "b", textMode: "Normal", asrProvider: "cloud" },
      ],
    });

    await usePanelStore.getState().deleteHistory(1);

    // Item should be removed from local state immediately
    expect(usePanelStore.getState().historyItems).toHaveLength(1);
    expect(usePanelStore.getState().historyItems[0].id).toBe(2);
  });

  it("optimistically clears all history items", async () => {
    usePanelStore.setState({
      historyItems: [
        { id: 1, createdAt: "2024-01-01", sourceText: "a", finalText: "a", textMode: "Normal", asrProvider: "cloud" },
      ],
    });

    await usePanelStore.getState().clearHistory();

    expect(usePanelStore.getState().historyItems).toHaveLength(0);
  });

  it("optimistically toggles filter word enabled state", async () => {
    usePanelStore.setState({
      filterWords: [
        { id: 1, word: "嗯", replacement: "", enabled: true },
      ],
    });

    await usePanelStore.getState().toggleFilterWord(1);

    expect(usePanelStore.getState().filterWords[0].enabled).toBe(false);
  });

  it("optimistically deletes filter word from local state", async () => {
    usePanelStore.setState({
      filterWords: [
        { id: 1, word: "嗯", replacement: "", enabled: true },
        { id: 2, word: "啊", replacement: "", enabled: true },
      ],
    });

    await usePanelStore.getState().deleteFilterWord(1);

    expect(usePanelStore.getState().filterWords).toHaveLength(1);
    expect(usePanelStore.getState().filterWords[0].id).toBe(2);
  });

  it("tracks downloading models in local state", async () => {
    // Simulate Tauri runtime so downloadModel doesn't early-return
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};

    usePanelStore.setState({
      models: [{ id: "m1", name: "Model 1", sizeBytes: 1024, sha256: "abc", downloadUrl: "http://x", installed: false }],
    });

    const promise = usePanelStore.getState().downloadModel("m1");

    // While downloading, the model ID should be in downloadingModels
    expect(usePanelStore.getState().downloadingModels).toContain("m1");

    await promise;

    // After download completes, it should be removed
    expect(usePanelStore.getState().downloadingModels).not.toContain("m1");

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });
});
