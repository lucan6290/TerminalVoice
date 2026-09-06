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

    // 主题按钮 title 使用 i18n key
    const themeButton = screen.getByTitle("切换为浅色主题");
    expect(container.querySelector(".dark")).not.toBeNull();

    fireEvent.click(themeButton);

    expect(container.querySelector(".theme-light")).not.toBeNull();
    expect(screen.getByTitle("切换为深色主题")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("切换为深色主题"));

    expect(container.querySelector(".dark")).not.toBeNull();
  });
});
