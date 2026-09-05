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
} from "./lib/events";
import { usePanelStore } from "./stores/appStore";
import { showToast, type ToastLevel } from "./stores/toastStore";
import { BallWindow } from "./windows/ball/BallWindow";
import { PanelWindow } from "./windows/panel/PanelWindow";
import { ToastContainer } from "./components/ui/Toast";
import { ErrorModal } from "./components/ui/ErrorModal";

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

        // Initial load
        await loadAll();
        const status = await getAppStatus();
        if (!disposed) setRuntimeStatus(status);
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
    if (route === "#/ball" || route === "#/panel") {
      document.body.classList.add("window-transparent");
      document.body.classList.add("browser-preview-dark");
    } else {
      document.body.classList.remove("window-transparent");
      document.body.classList.remove("browser-preview-dark");
    }
  }, [route]);

  return (
    <>
      {route === "#/ball" && <BallWindow />}
      {route === "#/panel" && <PanelWindow />}
      {route === "#/main" && <MainWindowPlaceholder />}
      {!["#/ball", "#/panel", "#/main"].includes(route) && <DevPreview />}
      <ToastContainer />
      <ErrorModal />
    </>
  );
}

function MainWindowPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-fg-secondary)] text-sm">
      主窗口（历史/设置）— 待实现
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
