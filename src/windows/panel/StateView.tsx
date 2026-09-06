import { Mic, LoaderCircle, Volume2, Sparkles, Languages, Square } from "lucide-react";
import { usePanelStore } from "../../stores/appStore";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 紧凑状态视图 — 当应用处于非空闲状态时，在面板主页内容区上方显示实时状态卡片。
 * 优先级：Recording > Recognizing > TTS speaking > LLM streaming > Translating > Idle(null)
 */
export function StateView() {
  const appStatus = usePanelStore((s) => s.appStatus);
  const recordingDuration = usePanelStore((s) => s.recordingDuration);
  const ttsSpeaking = usePanelStore((s) => s.ttsSpeaking);
  const llmStreamingText = usePanelStore((s) => s.llmStreamingText);
  const translateResult = usePanelStore((s) => s.translateResult);
  const setTtsSpeaking = usePanelStore((s) => s.setTtsSpeaking);

  if (appStatus === "Recording") {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-neutral-800 border border-white/5 px-4 py-3 animate-fade-in">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-pulse-dot" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>
        <span className="text-[14px] text-neutral-100">录音中</span>
        <span className="ml-auto text-[14px] text-neutral-400 tabular-nums">
          {formatDuration(recordingDuration)}
        </span>
      </div>
    );
  }

  if (appStatus === "Recognizing") {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-neutral-800 border border-white/5 px-4 py-3 animate-fade-in">
        <LoaderCircle className="w-4 h-4 text-neutral-400 animate-spin shrink-0" />
        <span className="text-[14px] text-neutral-100">识别中...</span>
      </div>
    );
  }

  if (ttsSpeaking) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-neutral-800 border border-white/5 px-4 py-3 animate-fade-in">
        <Volume2 className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-[14px] text-neutral-100">朗读中...</span>
        <button
          type="button"
          onClick={() => setTtsSpeaking(false)}
          aria-label="停止朗读"
          data-tip="停止朗读"
          className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-white/5 transition-colors"
        >
          <Square className="w-3.5 h-3.5" fill="currentColor" />
        </button>
      </div>
    );
  }

  if (llmStreamingText !== null) {
    return (
      <div className="mb-3 flex items-start gap-3 rounded-xl bg-neutral-800 border border-white/5 px-4 py-3 animate-fade-in">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-[14px] text-neutral-100">AI整理中...</span>
          {llmStreamingText && (
            <p className="mt-1 text-[12px] text-neutral-400 leading-relaxed line-clamp-3 break-words">
              {llmStreamingText}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (translateResult) {
    return (
      <div className="mb-3 flex items-start gap-3 rounded-xl bg-neutral-800 border border-white/5 px-4 py-3 animate-fade-in">
        <Languages className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-[14px] text-neutral-100">翻译结果</span>
          <p className="mt-1 text-[12px] text-neutral-400 leading-relaxed line-clamp-3 break-words">
            {translateResult.translatedText}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
