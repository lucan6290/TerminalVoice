import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PreviewPopup from "./PreviewPopup";
import type { PreviewDraft } from "../lib/types";

const draft: PreviewDraft = {
  sourceText: "嗯 请帮我修改",
  processedText: "请帮我修改。",
  textMode: "Normal",
  asrProvider: "mock",
};

describe("PreviewPopup", () => {
  it("renders processed text and confirms edited text", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<PreviewPopup draft={draft} onConfirm={onConfirm} onCancel={() => undefined} />);

    const textarea = screen.getByLabelText("预览文本");
    await user.clear(textarea);
    await user.type(textarea, "最终文本");
    await user.click(screen.getByRole("button", { name: "确认上屏" }));

    expect(onConfirm).toHaveBeenCalledWith({
      sourceText: "嗯 请帮我修改",
      finalText: "最终文本",
      textMode: "Normal",
      asrProvider: "mock",
    });
  });

  it("calls cancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<PreviewPopup draft={draft} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByLabelText("预览文本"));
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
