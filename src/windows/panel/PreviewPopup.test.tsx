import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PreviewDraft } from "../../lib/types";
import { PreviewPopup } from "./PreviewPopup";

const draft: PreviewDraft = {
  mode: "recognition",
  sourceText: "嗯 请帮我修改",
  processedText: "请帮我修改。",
  textMode: "Normal",
  asrProvider: "cloud",
};

const rewriteDraft: PreviewDraft = {
  mode: "rewrite",
  sourceText: "原始文本",
  processedText: "改写后的文本",
  textMode: "Normal",
  asrProvider: "rewrite",
};

describe("PreviewPopup", () => {
  it("shows before and after text and confirms edited content", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<PreviewPopup draft={draft} onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.getByText("嗯 请帮我修改")).toBeInTheDocument();
    const textarea = screen.getByLabelText("预览文本");
    await user.clear(textarea);
    await user.type(textarea, "最终文本");
    await user.click(screen.getByRole("button", { name: "确认上屏" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "recognition",
        sourceText: "嗯 请帮我修改",
        finalText: "最终文本",
        textMode: "Normal",
        asrProvider: "cloud",
      }),
    );
  });

  it("supports Escape cancellation", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn().mockResolvedValue(undefined);

    render(<PreviewPopup draft={draft} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByLabelText("预览文本"));
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses Ctrl+Enter for confirmation while plain Enter edits multiline text", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<PreviewPopup draft={draft} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const textarea = screen.getByLabelText("预览文本");
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders rewrite mode with rewrite-specific labels", () => {
    render(<PreviewPopup draft={rewriteDraft} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("确认改写结果")).toBeInTheDocument();
    expect(screen.getByText("改写原文")).toBeInTheDocument();
    expect(screen.getByText("改写结果（可编辑）")).toBeInTheDocument();
    // Should not show asrProvider in rewrite mode
    expect(screen.queryByText("rewrite")).not.toBeInTheDocument();
  });

  it("confirms rewrite mode with mode field set to rewrite", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<PreviewPopup draft={rewriteDraft} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "确认上屏" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "rewrite",
        sourceText: "原始文本",
        finalText: "改写后的文本",
      }),
    );
  });
});
