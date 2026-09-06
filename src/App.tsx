import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getAppStatus } from "./lib/commands";
import type {
  AppStatus,
  ConfigEntry,
  PreviewDraft,
  RecordingTickPayload,
  ToastPayload,
  TranslateResultPayload,
  RewriteResultPayload,
  LlmStreamingDeltaPayload,
} from "./lib/types";
import {
  EVENT_RUNTIME_STATE_CHANGED,
  EVENT_CONFIG_UPDATED,
  EVENT_TOAST,
  EVENT_PREVIEW_READY,
  EVENT_PREVIEW_CLEARED,
  EVENT_RECORDING_STARTED,
  EVENT_RECORDING_STOPPED,
  EVENT_RECORDING_CANCELLED,
  EVENT_RECORDING_TICK,
  EVENT_TTS_STARTED,
  EVENT_TTS_STOPPED,
  EVENT_TRANSLATE_RESULT,
  EVENT_REWRITE_STARTED,
  EVENT_REWRITE_RESULT,
  EVENT_LLM_STREAMING_DELTA,
} from "./lib/events";
import { usePanelStore } from "./stores/appStore";
import { showToast, type ToastLevel } from "./stores/toastStore";
import { cn } from "./lib/cn";
import { BallWindow } from "./windows/ball/BallWindow";
import { PanelWindow } from "./windows/panel/PanelWindow";
import { ToastContainer } from "./components/ui/Toast";
import { ErrorModal } from "./components/ui/ErrorModal";
import { UpdateModal } from "./components/ui/UpdateModal";
import { ToggleSwitch } from "./components/ui/ToggleSwitch";

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function useBackendSync(): void {
  const setRuntimeStatus = usePanelStore((state) => state.setRuntimeStatus);
  const hydrateFromConfig = usePanelStore((state) => state.hydrateFromConfig);
  const applyConfigEntry = usePanelStore((state) => state.applyConfigEntry);
  const setPreviewDraft = usePanelStore((state) => state.setPreviewDraft);
  const clearPreviewDraft = usePanelStore((state) => state.clearPreviewDraft);
  const loadAll = usePanelStore((state) => state.loadAll);
  const setTtsSpeaking = usePanelStore((state) => state.setTtsSpeaking);
  const setTranslateResult = usePanelStore((state) => state.setTranslateResult);
  const setRewriteMode = usePanelStore((state) => state.setRewriteMode);
  const setRewriteResult = usePanelStore((state) => state.setRewriteResult);
  const setRecordingDuration = usePanelStore((state) => state.setRecordingDuration);
  const setErrorMessage = usePanelStore((state) => state.setErrorMessage);
  const setLlmStreamingText = usePanelStore((state) => state.setLlmStreamingText);
  const checkForUpdate = usePanelStore((state) => state.checkForUpdate);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      try {
        // Runtime state
        unlisteners.push(await listen<{ state: AppStatus }>(
          EVENT_RUNTIME_STATE_CHANGED,
          (event) => { if (!disposed) setRuntimeStatus(event.payload.state); },
        ));

        // Config updates
        unlisteners.push(await listen<ConfigEntry>(
          EVENT_CONFIG_UPDATED,
          (event) => {
            if (disposed) return;
            if (event.payload.value === "__terminalvoice_secret_updated__") {
              void hydrateFromConfig();
            } else {
              applyConfigEntry(event.payload);
            }
          },
        ));

        // Preview
        unlisteners.push(await listen<PreviewDraft>(
          EVENT_PREVIEW_READY,
          (event) => { if (!disposed) setPreviewDraft(event.payload); },
        ));
        unlisteners.push(await listen(EVENT_PREVIEW_CLEARED, () => {
          if (!disposed) clearPreviewDraft();
        }));

        // Toast
        unlisteners.push(await listen<ToastPayload>(
          EVENT_TOAST,
          (event) => {
            if (!disposed) showToast(event.payload.message, event.payload.level);
          },
        ));

        // Recording events
        unlisteners.push(await listen(EVENT_RECORDING_STARTED, () => {
          if (!disposed) { setRecordingDuration(0); setErrorMessage(null); }
        }));
        unlisteners.push(await listen<{ duration: number }>(
          EVENT_RECORDING_TICK,
          (event) => { if (!disposed) setRecordingDuration(event.payload.duration); },
        ));
        unlisteners.push(await listen(EVENT_RECORDING_STOPPED, () => {
          if (!disposed) setRecordingDuration(0);
        }));
        unlisteners.push(await listen(EVENT_RECORDING_CANCELLED, () => {
          if (!disposed) setRecordingDuration(0);
        }));

        // TTS events
        unlisteners.push(await listen(EVENT_TTS_STARTED, () => {
          if (!disposed) setTtsSpeaking(true);
        }));
        unlisteners.push(await listen(EVENT_TTS_STOPPED, () => {
          if (!disposed) setTtsSpeaking(false);
        }));

        // Translate events
        unlisteners.push(await listen<TranslateResultPayload>(
          EVENT_TRANSLATE_RESULT,
          (event) => { if (!disposed) setTranslateResult(event.payload); },
        ));

        // Rewrite events
        unlisteners.push(await listen(EVENT_REWRITE_STARTED, () => {
          if (!disposed) setRewriteMode(true);
        }));
        unlisteners.push(await listen<RewriteResultPayload>(
          EVENT_REWRITE_RESULT,
          (event) => {
            if (!disposed) {
              setRewriteResult(event.payload);
              setRewriteMode(false);
              setPreviewDraft({
                mode: "rewrite",
                sourceText: event.payload.originalText,
                processedText: event.payload.rewrittenText,
                textMode: "Normal",
                asrProvider: "rewrite",
              });
            }
          },
        ));

        // LLM streaming
        unlisteners.push(await listen<LlmStreamingDeltaPayload>(
          EVENT_LLM_STREAMING_DELTA,
          (event) => {
            if (!disposed) {
              setLlmStreamingText(event.payload.accumulated);
            }
          },
        ));

        // Initial load
        await loadAll();
        const status = await getAppStatus();
        if (!disposed) setRuntimeStatus(status);

        // 延迟检查更新（避免阻塞初始化）
        setTimeout(() => { void checkForUpdate(); }, 2000);
      } catch (error) {
        console.warn("[TerminalVoice] 后端状态同步不可用", error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [
    applyConfigEntry, clearPreviewDraft, hydrateFromConfig, loadAll,
    setPreviewDraft, setRuntimeStatus, setTtsSpeaking, setTranslateResult,
    setRewriteMode, setRewriteResult, setRecordingDuration, setErrorMessage,
    setLlmStreamingText, checkForUpdate,
  ]);
}

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash || "#/panel");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/panel");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  useBackendSync();
  const route = useHashRoute();

  useEffect(() => {
    const isTransparent = route === "#/ball" || route === "#/panel";
    const isTauri = isTauriRuntime();
    document.body.classList.toggle("window-transparent", isTransparent);
    // browser-preview-dark 仅用于浏览器中预览透明窗口（模拟桌面深色背景）
    document.body.classList.toggle("browser-preview-dark", isTransparent && !isTauri);
  }, [route]);

  return (
    <>
      {route === "#/ball" && <BallWindow />}
      {route === "#/panel" && <PanelWindow />}
      {route === "#/main" && <MainWindow />}
      {!["#/ball", "#/panel", "#/main"].includes(route) && <DevPreview />}
      <ToastContainer />
      <ErrorModal />
      <UpdateModal />
    </>
  );
}

function MainWindow() {
  const dark = usePanelStore((s) => s.dark);
  const toggleDark = usePanelStore((s) => s.toggleDark);
  const autoStart = usePanelStore((s) => s.autoStart);
  const setAutoStart = usePanelStore((s) => s.setAutoStart);
  const service = usePanelStore((s) => s.service);

  return (
    <div className={cn(
      "w-full h-full overflow-y-auto",
      dark ? "bg-neutral-900 text-neutral-100" : "bg-neutral-100 text-neutral-900"
    )}>
      <header className={cn(
        "px-6 py-4 border-b sticky top-0 z-10",
        dark ? "border-white/5 bg-neutral-900/95 backdrop-blur" : "border-black/5 bg-neutral-100/95 backdrop-blur"
      )}>
        <h1 className="text-[18px] font-semibold">TerminalVoice 设置</h1>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* 通用设置 */}
        <section>
          <h2 className={cn("text-[14px] font-medium mb-3", dark ? "text-neutral-300" : "text-neutral-700")}>通用设置</h2>
          <div className={cn(
            "rounded-xl divide-y",
            dark ? "bg-neutral-800 divide-white/5" : "bg-white divide-black/5"
          )}>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[13px]">开机自启</div>
                <div className={cn("text-[11px] mt-0.5", dark ? "text-neutral-500" : "text-neutral-400")}>系统启动时自动运行</div>
              </div>
              <ToggleSwitch checked={autoStart} onChange={setAutoStart} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[13px]">深色模式</div>
                <div className={cn("text-[11px] mt-0.5", dark ? "text-neutral-500" : "text-neutral-400")}>切换界面主题</div>
              </div>
              <ToggleSwitch checked={dark} onChange={toggleDark} />
            </div>
          </div>
        </section>

        {/* 服务状态 */}
        <section>
          <h2 className={cn("text-[14px] font-medium mb-3", dark ? "text-neutral-300" : "text-neutral-700")}>服务状态</h2>
          <div className={cn(
            "rounded-xl px-4 py-3 space-y-1.5",
            dark ? "bg-neutral-800" : "bg-white"
          )}>
            <div className="flex items-center justify-between text-[12px]">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>ASR Provider</span>
              <span className="font-medium">{service.asrProvider}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>LLM Model</span>
              <span className="font-medium">{service.llmModel || "未配置"}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>翻译目标语言</span>
              <span className="font-medium">{service.translateTargetLang}</span>
            </div>
          </div>
        </section>

        {/* 关于 */}
        <section>
          <h2 className={cn("text-[14px] font-medium mb-3", dark ? "text-neutral-300" : "text-neutral-700")}>关于</h2>
          <div className={cn(
            "rounded-xl px-4 py-3 space-y-1",
            dark ? "bg-neutral-800" : "bg-white"
          )}>
            <div className="text-[12px] flex items-center justify-between">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>版本</span>
              <span className="font-medium">0.1.0</span>
            </div>
            <div className="text-[12px] flex items-center justify-between">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>快捷键</span>
              <span className="font-medium">Right Alt · Shift+Alt · Alt+1 · Alt+2</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DevPreview() {
  return (
    <div
      className="w-full h-full overflow-auto flex flex-col items-center"
      style={{ background: "#d1d1d6", padding: "48px 24px 64px" }}
    >
      {/* 页头 */}
      <header className="mb-10 text-center">
        <h1
          className="text-[22px] font-semibold mb-1"
          style={{ color: "#1c1c1e", letterSpacing: "-0.01em" }}
        >
          TerminalVoice UI 预览
        </h1>
        <p className="text-[13px]" style={{ color: "#636366" }}>
          浏览器预览模式 · Tauri 中悬浮球与面板为独立透明窗口
        </p>
      </header>

      {/* 两栏并列：标题在卡片顶部，与控件强关联 */}
      <section className="flex gap-12 items-start justify-center flex-wrap">
        {/* 悬浮小球卡片 */}
        <PreviewCard title="悬浮小球" subtitle="点击切换 idle / 录音 / 识别 / 暂停">
          <div
            className="w-[200px] h-[200px] rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #3a3a3c 0%, #1c1c1e 100%)",
            }}
          >
            <div className="w-12 h-12">
              <BallWindow />
            </div>
          </div>
        </PreviewCard>

        {/* 极简面板卡片 */}
        <PreviewCard title="极简面板" subtitle="深/浅主题 · 可交互开关与按钮">
          <div style={{ width: 380 }}>
            <PanelWindow />
          </div>
        </PreviewCard>
      </section>

      {/* 操作提示 */}
      <footer
        className="mt-10 text-center text-[12px] leading-7"
        style={{ color: "#636366" }}
      >
        · 鼠标悬浮在小球/图标/按钮上可看到提示气泡
        <br />· 面板左上角状态点与悬浮球均由后端 AppRuntime 同步驱动
        <br />· 所有开关、按钮、主题切换均为可交互
      </footer>
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-center">
        <div
          className="text-[15px] font-semibold"
          style={{ color: "#1c1c1e" }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-[12px] mt-[2px]" style={{ color: "#8e8e93" }}>
            {subtitle}
          </div>
        )}
      </div>
      <div
        className="rounded-2xl p-3"
        style={{
          background: "rgba(255,255,255,0.5)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          border: "0.5px solid rgba(0,0,0,0.06)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
