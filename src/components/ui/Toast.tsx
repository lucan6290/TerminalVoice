import { CheckCircle, AlertCircle, Info, XCircle, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { dismissToast, useToasts, type ToastLevel } from "../../stores/toastStore";

const LEVEL_META: Record<ToastLevel, { icon: typeof Info; color: string }> = {
  info:    { icon: Info,       color: "text-sky-400" },
  success: { icon: CheckCircle, color: "text-green-400" },
  warn:    { icon: AlertCircle, color: "text-amber-400" },
  error:   { icon: XCircle,     color: "text-red-400" },
};

export function ToastContainer() {
  const toasts = useToasts();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => {
        const meta = LEVEL_META[t.level];
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            className="pointer-events-auto animate-fade-in flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800/95 shadow-xl ring-1 ring-white/10 text-[13px] text-neutral-100 max-w-[320px]"
          >
            <Icon className={cn("w-4 h-4 shrink-0", meta.color)} />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
