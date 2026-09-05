import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { usePanelStore } from "../../stores/appStore";

/**
 * 阻断式错误模态对话框
 * 从 appStore.errorMessage 读取，为 null 时不渲染
 */
export function ErrorModal() {
  const errorMessage = usePanelStore((s) => s.errorMessage);
  const setErrorMessage = usePanelStore((s) => s.setErrorMessage);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage, setErrorMessage]);

  if (!errorMessage) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={() => setErrorMessage(null)}
    >
      <div
        className="relative w-[300px] rounded-2xl bg-neutral-900 ring-1 ring-red-500/30 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="关闭"
          onClick={() => setErrorMessage(null)}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[14px] font-medium text-neutral-100 mb-1">出错了</h3>
            <p className="text-[12px] text-neutral-400 leading-relaxed break-words">
              {errorMessage}
            </p>
          </div>
        </div>

        <button
          onClick={() => setErrorMessage(null)}
          className="w-full mt-4 h-9 rounded-[10px] bg-neutral-800 text-[13px] text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
