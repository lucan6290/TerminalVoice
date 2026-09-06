import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import type { ConfirmPreviewInput, PreviewDraft, PreviewMode } from "../../lib/types";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";

interface PreviewPopupProps {
  draft: PreviewDraft | null;
  onConfirm: (input: ConfirmPreviewInput) => Promise<void>;
  onCancel: () => Promise<void>;
}

export function PreviewPopup({ draft, onConfirm, onCancel }: PreviewPopupProps) {
  const t = useT();
  const [finalText, setFinalText] = useState(draft?.processedText ?? "");
  const [action, setAction] = useState<"confirm" | "cancel" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setFinalText(draft?.processedText ?? "");
    setAction(null);
    if (draft) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [draft]);

  if (!draft) return null;

  const mode: PreviewMode = draft.mode ?? "recognition";
  const isRewrite = mode === "rewrite";
  const currentDraft = draft;
  const busy = action !== null;

  async function confirm() {
    if (busy || !finalText.trim()) return;
    setAction("confirm");
    try {
      await onConfirm({
        mode,
        sourceText: currentDraft.sourceText,
        finalText,
        textMode: currentDraft.textMode,
        asrProvider: currentDraft.asrProvider,
        durationMs: currentDraft.durationMs ?? null,
        llmRewritten: currentDraft.llmRewritten ?? null,
        skillId: currentDraft.skillId ?? null,
      });
    } finally {
      setAction(null);
    }
  }

  async function cancel() {
    if (busy) return;
    setAction("cancel");
    try {
      await onCancel();
    } finally {
      setAction(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void confirm();
    } else if (event.key === "Escape") {
      event.preventDefault();
      void cancel();
    }
  }

  const accentText = isRewrite ? "text-purple-400" : "text-green-400";
  const accentBg = isRewrite ? "bg-purple-500" : "bg-green-500";
  const accentRing = isRewrite ? "focus:ring-purple-500/50" : "focus:ring-green-500/50";
  const accentHover = isRewrite ? "hover:bg-purple-400" : "hover:bg-green-400";

  return (
    <section
      aria-label={isRewrite ? t("preview.aria.rewrite") : t("preview.aria.recognition")}
      aria-modal="true"
      role="dialog"
      className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-[22px] bg-neutral-900 text-neutral-100"
    >
      <header className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
        <div>
          <h2 className="text-[16px] font-medium">
            {isRewrite ? t("preview.title.rewrite") : t("preview.title.recognition")}
          </h2>
          <p className="text-[11px] text-neutral-500 mt-1">
            {isRewrite ? t("preview.subtitle.rewrite") : t("preview.subtitle.recognition")}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("preview.aria.close")}
          onClick={() => void cancel()}
          disabled={busy}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-white/5 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-neutral-400">
              {isRewrite ? t("preview.sourceLabel.rewrite") : t("preview.sourceLabel.recognition")}
            </span>
            {!isRewrite && (
              <span className="text-[10px] text-neutral-600">{currentDraft.asrProvider}</span>
            )}
          </div>
          <div className="allow-select max-h-[120px] overflow-y-auto rounded-xl bg-neutral-800 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-400 whitespace-pre-wrap">
            {currentDraft.sourceText}
          </div>
        </div>

        <div className="flex justify-center text-neutral-600" aria-hidden="true">
          <ArrowRight className="w-4 h-4 rotate-90" />
        </div>

        <div>
          <label
            htmlFor="preview-final-text"
            className={cn("block text-[11px] font-medium mb-1.5", accentText)}
          >
            {isRewrite ? t("preview.resultLabel.rewrite") : t("preview.resultLabel.recognition")}
          </label>
          <textarea
            ref={textareaRef}
            id="preview-final-text"
            aria-label={t("preview.aria.textarea")}
            value={finalText}
            onChange={(event) => setFinalText(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={8}
            className={cn(
              "allow-select w-full resize-none rounded-xl bg-neutral-800 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-100 outline-none ring-1 ring-white/5 focus:ring-2 placeholder:text-neutral-600",
              accentRing,
            )}
            placeholder={isRewrite ? t("preview.empty.rewrite") : t("preview.empty.recognition")}
          />
          <p className="text-[10px] text-neutral-600 mt-1.5">{t("preview.hint")}</p>
        </div>
      </div>

      <footer className="flex gap-2 px-5 py-4 border-t border-neutral-800 shrink-0">
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={busy}
          className="flex-1 h-9 rounded-[10px] bg-neutral-800 text-[13px] text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
        >
          {action === "cancel" ? t("preview.canceling") : t("preview.closeBtn")}
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy || !finalText.trim()}
          className={cn(
            "flex-[1.4] h-9 rounded-[10px] text-[13px] font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed",
            accentBg,
            accentHover,
          )}
        >
          {action === "confirm" ? (
            <>
              <LoaderCircle className="w-4 h-4 animate-spin" /> {t("preview.submitting")}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" /> {t("preview.confirmBtn")}
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
