import { useEffect } from "react";
import { X, Languages } from "lucide-react";
import { usePanelStore } from "../../stores/appStore";
import { useT } from "../../lib/i18n";

/**
 * 翻译结果浮窗
 * 浮球旁临时显示译文，8 秒后自动消失
 */
export function TranslatePopup() {
  const t = useT();
  const translateResult = usePanelStore((s) => s.translateResult);
  const setTranslateResult = usePanelStore((s) => s.setTranslateResult);

  useEffect(() => {
    if (!translateResult) return;
    const timer = setTimeout(() => {
      setTranslateResult(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [translateResult, setTranslateResult]);

  if (!translateResult) return null;

  return (
    <div
      className="absolute left-full ml-3 top-0 z-50 w-[240px] rounded-xl p-3 animate-fade-in pointer-events-auto"
      style={{
        background: "rgba(20, 20, 22, 0.95)",
        backdropFilter: "blur(14px) saturate(180%)",
        WebkitBackdropFilter: "blur(14px) saturate(180%)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        border: "0.5px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[11px] font-medium text-teal-400">{t("translate.title")}</span>
        </div>
        <button
          type="button"
          aria-label={t("translate.close")}
          onClick={() => setTranslateResult(null)}
          className="w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[10px] text-neutral-500 mb-0.5">{t("translate.original")}</p>
          <p className="text-[12px] leading-relaxed text-neutral-400 whitespace-pre-wrap break-words max-h-[60px] overflow-y-auto overflow-x-hidden">
            {translateResult.originalText}
          </p>
        </div>
        <div className="h-px bg-neutral-700/50" />
        <div>
          <p className="text-[10px] text-teal-400/70 mb-0.5">{t("translate.translated")}</p>
          <p className="text-[13px] leading-relaxed text-neutral-100 whitespace-pre-wrap break-words max-h-[80px] overflow-y-auto overflow-x-hidden">
            {translateResult.translatedText}
          </p>
        </div>
      </div>
    </div>
  );
}
