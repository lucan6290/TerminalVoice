import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "../../stores/appStore";
import { ErrorModal } from "./ErrorModal";

beforeEach(() => {
  usePanelStore.setState({ errorMessage: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ErrorModal", () => {
  it("does not render when errorMessage is null", () => {
    render(<ErrorModal />);
    expect(screen.queryByText("出错了")).not.toBeInTheDocument();
  });

  it("renders error message when errorMessage is set", () => {
    usePanelStore.setState({ errorMessage: "网络连接失败" });
    render(<ErrorModal />);

    expect(screen.getByText("出错了")).toBeInTheDocument();
    expect(screen.getByText("网络连接失败")).toBeInTheDocument();
  });

  it("dismisses when clicking the 知道了 button", async () => {
    const user = userEvent.setup();
    usePanelStore.setState({ errorMessage: "ASR 服务不可用" });
    render(<ErrorModal />);

    await user.click(screen.getByRole("button", { name: "知道了" }));

    expect(usePanelStore.getState().errorMessage).toBeNull();
  });

  it("dismisses when clicking the close icon button", async () => {
    const user = userEvent.setup();
    usePanelStore.setState({ errorMessage: "录音设备未找到" });
    render(<ErrorModal />);

    await user.click(screen.getByLabelText("关闭"));

    expect(usePanelStore.getState().errorMessage).toBeNull();
  });

  it("auto-dismisses after 5 seconds", () => {
    vi.useFakeTimers();
    usePanelStore.setState({ errorMessage: "超时错误" });
    render(<ErrorModal />);

    expect(screen.getByText("超时错误")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(usePanelStore.getState().errorMessage).toBeNull();
  });
});
