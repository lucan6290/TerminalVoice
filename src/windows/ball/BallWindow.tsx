import { useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "../../lib/cn";
import { usePanelStore } from "../../stores/appStore";
import type { AppStatus } from "../../lib/types";

/**
 * 悬浮小球
 * - 48×48 毛玻璃圆盘
 * - 状态：idle(绿点) / recording(蓝麦+呼吸) / thinking(橙点+脉冲) / disabled(灰点)
 * - 点击切换状态（演示用）
 */
type BallState = "idle" | "recording" | "thinking" | "disabled";

const STATUS_TO_BALL_STATE: Record<AppStatus, BallState> = {
  Idle: "idle",
  Recording: "recording",
  Recognizing: "thinking",
  Preview: "thinking",
  Paused: "disabled",
};

const STATE_META: Record<
  BallState,
  { core: string; ring: string; label: string; glow?: boolean; icon?: "mic" }
> = {
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
  },
  disabled: {
    core: "bg-[var(--color-toggle-off)]",
    ring: "bg-[var(--color-toggle-off)]/25",
    label: "已暂停",
  },
};

export function BallWindow() {
  const appStatus = usePanelStore((state) => state.appStatus);
  const setRuntimeStatus = usePanelStore((state) => state.setRuntimeStatus);
  const [hovered, setHovered] = useState(false);

  const state = STATUS_TO_BALL_STATE[appStatus];
  const meta = STATE_META[state];
  const isActive = state === "recording" || state === "thinking";

  function cycleStatus() {
    const order: AppStatus[] = ["Idle", "Recording", "Recognizing", "Paused"];
    const idx = order.indexOf(appStatus);
    setRuntimeStatus(order[(idx + 1) % order.length]);
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center relative"
      style={{ background: "transparent" }}
    >
      {hovered && (
        <div
          className="absolute left-full ml-3 whitespace-nowrap px-2 py-1 rounded-md text-[11px] pointer-events-none z-50"
          style={{
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            backdropFilter: "blur(6px)",
          }}
        >
          {meta.label} · 点击打开面板
        </div>
      )}

      <button
        onClick={cycleStatus}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-tip={meta.label}
        className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ease-out outline-none group"
        style={{
          transform: hovered ? "scale(1.08)" : "scale(1)",
          WebkitAppRegion: "drag",
        }}
        title={meta.label}
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
    </div>
  );
}
