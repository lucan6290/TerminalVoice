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
  EVENT_TRAY_NAVIGATE,
  EVENT_TRAY_CHECK_UPDATE,
} from "./lib/events";
import { usePanelStore } from "./stores/appStore";
import { showToast, type ToastLevel } from "./stores/toastStore";
import { cn } from "./lib/cn";
import { useT } from "./lib/i18n";
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
  const setActiveTab = usePanelStore((state) => state.setActiveTab);
  const setShowUpdateModal = usePanelStore((state) => state.setShowUpdateModal);
  const checkForUpdate = usePanelStore((state) => state.checkForUpdate);
  const startDownloadUpdate = usePanelStore((state) => state.startDownloadUpdate);

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
                durationMs: null,
                llmRewritten: true,
                skillId: null,
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

        // Tray: 面板内切换 Tab（如「查看历史记录」）
        unlisteners.push(await listen<{ tab?: string; section?: string }>(
          EVENT_TRAY_NAVIGATE,
          (event) => {
            if (disposed) return;
            const { tab, section } = event.payload;
            if (tab === "history") {
              // 面板窗口：切换到历史 Tab
              setActiveTab("history");
            }
            if (section === "about") {
              // 主窗口：滚动到关于区块（通过 id 锚点）
              setTimeout(() => {
                document.getElementById("section-about")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }
          },
        ));

        // Tray: 触发检查更新
        unlisteners.push(await listen(EVENT_TRAY_CHECK_UPDATE, () => {
          if (!disposed) void checkForUpdate();
        }));

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
    setLlmStreamingText, setActiveTab, setShowUpdateModal,
    checkForUpdate, startDownloadUpdate,
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
  const t = useT();
  const dark = usePanelStore((s) => s.dark);
  const toggleDark = usePanelStore((s) => s.toggleDark);
  const autoStart = usePanelStore((s) => s.autoStart);
  const setAutoStart = usePanelStore((s) => s.setAutoStart);
  const service = usePanelStore((s) => s.service);

  return (
    <div className={cn(
      "w-full h-full overflow-y-auto overflow-x-hidden",
      dark ? "bg-neutral-900 text-neutral-100" : "bg-neutral-100 text-neutral-900"
    )}>
      <header className={cn(
        "px-6 py-4 border-b sticky top-0 z-10",
        dark ? "border-white/5 bg-neutral-900/95 backdrop-blur" : "border-black/5 bg-neutral-100/95 backdrop-blur"
      )}>
        <h1 className="text-[18px] font-semibold">{t("app.main.title")}</h1>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* 通用设置 */}
        <section>
          <h2 className={cn("text-[14px] font-medium mb-3", dark ? "text-neutral-300" : "text-neutral-700")}>{t("app.main.section.preferences")}</h2>
          <div className={cn(
            "rounded-xl divide-y",
            dark ? "bg-neutral-800 divide-white/5" : "bg-white divide-black/5"
          )}>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[13px]">{t("app.main.autostart.label")}</div>
                <div className={cn("text-[11px] mt-0.5", dark ? "text-neutral-500" : "text-neutral-400")}>{t("app.main.autostart.desc")}</div>
              </div>
              <ToggleSwitch checked={autoStart} onChange={setAutoStart} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[13px]">{t("app.main.dark.label")}</div>
                <div className={cn("text-[11px] mt-0.5", dark ? "text-neutral-500" : "text-neutral-400")}>{t("app.main.dark.desc")}</div>
              </div>
              <ToggleSwitch checked={dark} onChange={toggleDark} />
            </div>
          </div>
        </section>

        {/* 服务状态 */}
        <section>
          <h2 className={cn("text-[14px] font-medium mb-3", dark ? "text-neutral-300" : "text-neutral-700")}>{t("app.main.section.service")}</h2>
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
              <span className="font-medium">{service.llmModel || t("app.main.llmUnconfigured")}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>{t("app.main.service.translateTarget")}</span>
              <span className="font-medium">{service.translateTargetLang}</span>
            </div>
          </div>
        </section>

        {/* 关于 */}
        <section id="section-about">
          <h2 className={cn("text-[14px] font-medium mb-3", dark ? "text-neutral-300" : "text-neutral-700")}>{t("app.main.section.about")}</h2>
          <div className={cn(
            "rounded-xl px-4 py-3 space-y-1",
            dark ? "bg-neutral-800" : "bg-white"
          )}>
            <div className="text-[12px] flex items-center justify-between">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>{t("app.main.about.version")}</span>
              <span className="font-medium">0.1.0</span>
            </div>
            <div className="text-[12px] flex items-center justify-between">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>{t("app.main.about.hotkeys")}</span>
              <span className="font-medium">Right Alt · Shift+Alt · Alt+1 · Alt+2</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DevPreview() {
  const t = useT();
  return (
    <div
      className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center"
      style={{ background: "#d1d1d6", padding: "48px 24px 64px" }}
    >
      {/* 页头 */}
      <header className="mb-10 text-center">
        <h1
          className="text-[22px] font-semibold mb-1"
          style={{ color: "#1c1c1e", letterSpacing: "-0.01em" }}
        >
          {t("app.dev.title")}
        </h1>
        <p className="text-[13px]" style={{ color: "#636366" }}>
          {t("app.dev.subtitle")}
        </p>
      </header>

      {/* 两栏并列：标题在卡片顶部，与控件强关联 */}
      <section className="flex gap-12 items-start justify-center flex-wrap">
        {/* 悬浮小球卡片 */}
        <PreviewCard title={t("app.dev.card.ball")} subtitle={t("app.dev.card.ball.sub")}>
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
        <PreviewCard title={t("app.dev.card.panel")} subtitle={t("app.dev.card.panel.sub")}>
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
        {t("app.dev.footer1")}
        <br />{t("app.dev.footer2")}
        <br />{t("app.dev.footer3")}
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
