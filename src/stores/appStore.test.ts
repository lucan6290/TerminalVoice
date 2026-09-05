import { beforeEach, describe, expect, it, vi } from "vitest";
import { listConfig, setConfig } from "../lib/commands";
import { usePanelStore } from "./appStore";

vi.mock("../lib/commands", () => ({
  listConfig: vi.fn(),
  setConfig: vi.fn().mockResolvedValue(undefined),
}));

const mockedListConfig = vi.mocked(listConfig);
const mockedSetConfig = vi.mocked(setConfig);

beforeEach(() => {
  vi.clearAllMocks();
  usePanelStore.setState({
    dark: true,
    activeTab: null,
    appStatus: "Idle",
    pttKey: "Right-Alt",
    micDevice: "自动检测（麦克风 USB_MIC）",
    soundOn: true,
    muteSys: true,
    autoStart: true,
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

});
