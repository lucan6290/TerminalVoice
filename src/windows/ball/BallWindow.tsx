import { useState, useEffect, useRef } from "react";
import { Mic, AlertCircle, Loader2, Wand2, Volume2 } from "lucide-react";
import { Window } from "@tauri-apps/api/window";
import { cn } from "../../lib/cn";
import { usePanelStore } from "../../stores/appStore";
import { TranslatePopup } from "../../components/ui/TranslatePopup";
import type { AppStatus } from "../../lib/types";

/**
 * 悬浮小球
 * - 48×48 毛玻璃圆盘，64×64 透明窗口居中
 * - 状态：idle / recording / thinking / disabled / error / rewrite / tts
 * - 状态由后端 AppRuntime 同步，点击仅打开控制面板
 * - 使用原生 title 实现 OS 级 tooltip（自动浮于窗口顶层，不受裁剪）
 */
type BallState = "idle" | "recording" | "thinking" | "disabled" | "error" | "rewrite" | "tts";

interface BallStateMeta {
  core: string;
  ring: string;
  label: string;
  glow?: boolean;
  icon?: "mic" | "error" | "loader" | "wand" | "volume";
}

export function computeBallState(
  appStatus: AppStatus,
  rewriteMode: boolean,
  ttsSpeaking: boolean,
  errorMessage: string | null,
): BallState {
  if (errorMessage) return "error";
  if (ttsSpeaking) return "tts";
  if (rewriteMode && (appStatus === "Recording" || appStatus === "Recognizing")) return "rewrite";
  if (rewriteMode) return "rewrite";
  switch (appStatus) {
    case "Recording": return "recording";
    case "Recognizing": return "thinking";
    case "Preview": return "thinking";
    case "Paused": return "disabled";
    default: return "idle";
  }
}

const STATE_META: Record<BallState, BallStateMeta> = {
  idle: {
    core: "bg-[var(--color-accent)]",
    ring: "bg-[var(--color-accent-soft)]",
    label: "就绪 · 按住 Right-Alt 说话",
  },
  recording: {
    core: "bg-sky-400",
    ring: "bg-sky-400/30",
    label: "录音中 · 松开上屏",
    glow: true,
    icon: "mic",
  },
  thinking: {
    core: "bg-amber-400",
    ring: "bg-amber-400/30",
    label: "识别中…",
    glow: true,
    icon: "loader",
  },
  disabled: {
    core: "bg-[var(--color-toggle-off)]",
    ring: "bg-[var(--color-toggle-off)]/25",
    label: "已暂停",
  },
  error: {
    core: "bg-red-500",
    ring: "bg-red-500/30",
    label: "出错了 · 点击查看",
    glow: true,
    icon: "error",
  },
  rewrite: {
    core: "bg-purple-400",
    ring: "bg-purple-400/30",
    label: "改写模式 · 选中文字后说话",
    glow: true,
    icon: "wand",
  },
  tts: {
    core: "bg-teal-400",
    ring: "bg-teal-400/30",
    label: "朗读中 · Alt+1 停止",
    glow: true,
    icon: "volume",
  },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BallWindow() {
  const appStatus = usePanelStore((state) => state.appStatus);
  const rewriteMode = usePanelStore((state) => state.rewriteMode);
  const ttsSpeaking = usePanelStore((state) => state.ttsSpeaking);
  const errorMessage = usePanelStore((state) => state.errorMessage);
  const recordingDuration = usePanelStore((state) => state.recordingDuration);
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const state = computeBallState(appStatus, rewriteMode, ttsSpeaking, errorMessage);
  const meta = STATE_META[state];
  const isActive = state === "recording" || state === "thinking" || state === "error" || state === "rewrite" || state === "tts";
  const showTimer = state === "recording" && recordingDuration > 0;

  // 动态更新原生 title（包含录音时长等实时信息）
  const tooltipText = `${meta.label} · 点击打开面板${showTimer ? ` ${formatDuration(recordingDuration)}` : ""}`;
  useEffect(() => {
    if (buttonRef.current) {
      buttonRef.current.title = tooltipText;
    }
  }, [tooltipText]);

  async function openPanel() {
    if (!("__TAURI_INTERNALS__" in window)) return;

    try {
      const panel = await Window.getByLabel("panel");
      if (!panel) {
        console.warn("[TerminalVoice] 未找到 panel 窗口");
        return;
      }
      await panel.show();
      await panel.setFocus();
    } catch (error) {
      console.warn("[TerminalVoice] 打开面板失败", error);
    }
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center relative"
      style={{ background: "transparent" }}
      data-tauri-drag-region
    >
      <button
        ref={buttonRef}
        onClick={() => void openPanel()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ease-out outline-none group"
        data-tauri-drag-region
        style={{
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-300",
            meta.ring,
            meta.glow && "animate-breathing",
            hovered && !isActive && "opacity-80"
          )}
        />

        <span
          className="absolute inset-[5px] rounded-full flex items-center justify-center transition-all"
          style={{
            background: "color-mix(in srgb, var(--color-bg-primary) 92%, transparent)",
            backdropFilter: "blur(14px) saturate(180%)",
            WebkitBackdropFilter: "blur(14px) saturate(180%)",
            boxShadow: hovered
              ? "0 0 0 1.5px var(--color-accent), var(--shadow-ball)"
              : "var(--shadow-ball)",
            border: "0.5px solid var(--color-border-soft)",
          }}
        />

        {meta.icon === "mic" ? (
          <Mic
            className={cn(
              "relative z-10 w-[18px] h-[18px] text-white",
              isActive && "animate-pulse-dot"
            )}
            strokeWidth={2.2}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
          />
        ) : meta.icon === "error" ? (
          <AlertCircle
            className={cn(
              "relative z-10 w-[18px] h-[18px] text-red-400",
              isActive && "animate-pulse-dot"
            )}
            strokeWidth={2.2}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
          />
        ) : meta.icon === "loader" ? (
          <Loader2
            className={cn(
              "relative z-10 w-[18px] h-[18px] text-amber-400 animate-spin"
            )}
            strokeWidth={2.2}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
          />
        ) : meta.icon === "wand" ? (
          <Wand2
            className={cn(
              "relative z-10 w-[18px] h-[18px] text-purple-300",
              isActive && "animate-pulse-dot"
            )}
            strokeWidth={2.2}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
          />
        ) : meta.icon === "volume" ? (
          <Volume2
            className={cn(
              "relative z-10 w-[18px] h-[18px] text-teal-300",
              isActive && "animate-pulse-dot"
            )}
            strokeWidth={2.2}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
          />
        ) : (
          <span
            className={cn(
              "relative z-10 rounded-full transition-all duration-300",
              state === "idle" ? "w-2.5 h-2.5" : "w-3 h-3",
              meta.core,
              isActive && "animate-pulse-dot"
            )}
          />
        )}
      </button>

      <TranslatePopup />
    </div>
  );
}
