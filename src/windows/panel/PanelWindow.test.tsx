import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/commands", () => ({
  listConfig: vi.fn().mockResolvedValue([]),
  setConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    show: vi.fn(),
    setFocus: vi.fn(),
    hide: vi.fn(),
    minimize: vi.fn(),
    close: vi.fn(),
    onCloseRequested: vi.fn(() => () => {}),
  }),
}));
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn().mockResolvedValue(undefined),
}));

import { usePanelStore } from "../../stores/appStore";
import { PanelWindow } from "./PanelWindow";

describe("PanelWindow theme toggle", () => {
  beforeEach(() => {
    usePanelStore.setState({ dark: true, activeTab: null, uiLang: "zh-CN" });
  });

  it("switches between dark and light panel themes", () => {
    const { container } = render(<PanelWindow />);

    // 初始是深色主题，底部栏深色按钮显示太阳图标（点击切换浅色）
    expect(container.querySelector(".dark")).not.toBeNull();

    // 通过 footer 中 Moon/Sun 图标查找主题按钮
    const themeBtn = container.querySelector("footer button svg.lucide-sun, footer button svg.lucide-moon")
      ?.closest("button") as HTMLButtonElement | null;
    expect(themeBtn).not.toBeNull();
    expect(themeBtn!.querySelector("svg.lucide-sun")).not.toBeNull();

    fireEvent.click(themeBtn!);

    expect(container.querySelector(".theme-light")).not.toBeNull();
    // 点击后应该显示月亮图标（可切回深色）
    expect(themeBtn!.querySelector("svg.lucide-moon")).not.toBeNull();

    fireEvent.click(themeBtn!);

    expect(container.querySelector(".dark")).not.toBeNull();
    expect(themeBtn!.querySelector("svg.lucide-sun")).not.toBeNull();
  });
});
