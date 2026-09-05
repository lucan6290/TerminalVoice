import { useEffect, useRef, useState } from "react";
import type { ConfirmPreviewInput, PreviewDraft } from "../lib/types";

interface PreviewPopupProps {
  draft: PreviewDraft | null;
  onConfirm: (input: ConfirmPreviewInput) => Promise<void>;
  onCancel: () => void;
}

export default function PreviewPopup({ draft, onConfirm, onCancel }: PreviewPopupProps) {
  const [finalText, setFinalText] = useState(draft?.processedText ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    setFinalText(draft?.processedText ?? "");
  }, [draft]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!draft) {
    return null;
  }

  const currentDraft = draft;

  async function confirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm({
        sourceText: currentDraft.sourceText,
        finalText,
        textMode: currentDraft.textMode,
        asrProvider: currentDraft.asrProvider,
      });
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      void confirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <section aria-label="语音输入预览" style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <h2>语音输入预览</h2>
      <textarea
        aria-label="预览文本"
        value={finalText}
        onChange={(event) => setFinalText(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={onCancel}>放弃</button>
        <button type="button" onClick={confirm} disabled={isSaving}>
          {isSaving ? "保存中…" : "确认上屏"}
        </button>
      </div>
    </section>
  );
}
