import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/commands", () => ({
  listConfig: vi.fn().mockResolvedValue([]),
  setConfig: vi.fn().mockResolvedValue(undefined),
}));

import { usePanelStore } from "../../stores/appStore";
import { PanelWindow } from "./PanelWindow";

describe("PanelWindow theme toggle", () => {
  beforeEach(() => {
    usePanelStore.setState({ dark: true, activeTab: null });
  });

  it("switches between dark and light panel themes", () => {
    const { container } = render(<PanelWindow />);

    const themeButton = screen.getByRole("button", { name: "切换为浅色主题" });
    expect(container.querySelector(".dark")).not.toBeNull();

    fireEvent.click(themeButton);

    expect(container.querySelector(".theme-light")).not.toBeNull();
    expect(screen.getByRole("button", { name: "切换为深色主题" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "切换为深色主题" }));

    expect(container.querySelector(".dark")).not.toBeNull();
  });
});
