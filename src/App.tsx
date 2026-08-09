import { useEffect, useState } from "react";
import PreviewPopup from "./components/PreviewPopup";
import StatusBadge from "./components/StatusBadge";
import History from "./pages/History";
import Settings from "./pages/Settings";
import { confirmPreview, createMockPreview, getAppStatus, listHistory } from "./lib/commands";
import type { AppStatus, ConfirmPreviewInput, HistoryItem, PreviewDraft } from "./lib/types";

type Tab = "history" | "settings";

export default function App() {
  const [status, setStatus] = useState<AppStatus>("Idle");
  const [tab, setTab] = useState<Tab>("history");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [draft, setDraft] = useState<PreviewDraft | null>(null);
  const [mockText, setMockText] = useState("嗯 请帮我修改这个函数");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void getAppStatus()
      .then(setStatus)
      .catch(() => setErrorMessage("读取应用状态失败"));
    void listHistory()
      .then(setHistory)
      .catch(() => setErrorMessage("读取历史记录失败"));
  }, []);

  async function startMockFlow() {
    setErrorMessage(null);
    setStatus("Recognizing");

    try {
      const nextDraft = await createMockPreview(mockText);
      setDraft(nextDraft);
      setStatus("Preview");
    } catch {
      setStatus("Idle");
      setErrorMessage("生成预览失败，请稍后重试");
    }
  }

  async function handleConfirm(input: ConfirmPreviewInput) {
    setErrorMessage(null);

    try {
      const saved = await confirmPreview(input);
      setHistory((items) => [saved, ...items]);
      setDraft(null);
      setStatus("Idle");
    } catch {
      setStatus("Idle");
      setErrorMessage("保存历史记录失败，请稍后重试");
    }
  }

  function handleCancel() {
    setDraft(null);
    setStatus("Idle");
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>TerminalVoice</h1>
          <p>Mock 端到端链路：输入模拟识别文本 → 预处理 → 预览编辑 → 写入历史。</p>
        </div>
        <StatusBadge status={status} />
      </header>

      {errorMessage ? (
        <p role="alert" style={{ color: "#b91c1c", marginTop: 12 }}>
          {errorMessage}
        </p>
      ) : null}

      <section aria-label="模拟识别" style={{ marginTop: 16, marginBottom: 16 }}>
        <label>
          模拟 ASR 原始文本
          <input
            aria-label="模拟 ASR 原始文本"
            value={mockText}
            onChange={(event) => setMockText(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <button type="button" onClick={startMockFlow} style={{ marginTop: 8 }}>
          生成预览
        </button>
      </section>

      <PreviewPopup draft={draft} onConfirm={handleConfirm} onCancel={handleCancel} />

      <nav style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <button type="button" onClick={() => setTab("history")}>历史记录</button>
        <button type="button" onClick={() => setTab("settings")}>设置</button>
      </nav>

      <div style={{ marginTop: 16 }}>
        {tab === "history" ? <History items={history} /> : <Settings />}
      </div>
    </main>
  );
}
