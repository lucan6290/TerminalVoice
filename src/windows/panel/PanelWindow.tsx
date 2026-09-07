import { useEffect, useState } from "react";
import {
  X,
  Settings as SettingsIcon,
  Circle,
  ChevronRight,
  Sparkles,
  BookText,
  Clock,
  HelpCircle,
  Minus,
  Square,
  Moon,
  Sun,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";
import { cancelPreview, confirmPreview, listAudioInputDevices } from "../../lib/commands";
import { SettingRow } from "../../components/ui/SettingRow";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { HotkeyRecorder, formatKeyLabel } from "../../components/ui/HotkeyRecorder";
import { usePanelStore } from "../../stores/appStore";
import { showToast } from "../../stores/toastStore";
import { HistoryTab } from "./tabs/HistoryTab";
import { DictTab } from "./tabs/DictTab";
import { SkillTab } from "./tabs/SkillTab";
import { ServiceTab } from "./tabs/ServiceTab";
import { HelpTab } from "./tabs/HelpTab";
import { SettingsTab } from "./tabs/SettingsTab";
import type { TabKey } from "../../stores/appStore";
import { PreviewPopup } from "./PreviewPopup";
import { StateView } from "./StateView";

/**
 * 极简面板 v6
 * - 主页：快捷设置（服务配置/触发键/麦克风/开关）
 * - 点击底部 Tab 切换到对应功能页
 * - 点击「服务配置」行进入 ServiceTab
 * - Zustand 管理全部状态 + Toast 反馈
 */
export function PanelWindow() {
  const t = useT();
  const dark = usePanelStore((s) => s.dark);
  const uiLang = usePanelStore((s) => s.uiLang);
  const activeTab = usePanelStore((s) => s.activeTab);
  const appStatus = usePanelStore((s) => s.appStatus);
  const recording = appStatus === "Recording";
  const pttKey = usePanelStore((s) => s.pttKey);
  const ttsKey = usePanelStore((s) => s.ttsKey);
  const translateKey = usePanelStore((s) => s.translateKey);
  const micDevice = usePanelStore((s) => s.micDevice);
  const soundOn = usePanelStore((s) => s.soundOn);
  const muteSys = usePanelStore((s) => s.muteSys);
  const autoStart = usePanelStore((s) => s.autoStart);
  const serviceReady = usePanelStore((s) => s.serviceReady);
  const service = usePanelStore((s) => s.service);
  const skipPreview = service.skipPreview;
  const quotaDisplay = usePanelStore((s) => s.quotaDisplay);
  const previewDraft = usePanelStore((s) => s.previewDraft);
  const llmStreamingText = usePanelStore((s) => s.llmStreamingText);
  const updateInfo = usePanelStore((s) => s.updateInfo);

  const toggleDark = usePanelStore((s) => s.toggleDark);
  const setUiLang = usePanelStore((s) => s.setUiLang);
  const setServiceConfig = usePanelStore((s) => s.setServiceConfig);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const setSoundOn = usePanelStore((s) => s.setSoundOn);
  const setMuteSys = usePanelStore((s) => s.setMuteSys);
  const setAutoStart = usePanelStore((s) => s.setAutoStart);
  const setMicDevice = usePanelStore((s) => s.setMicDevice);
  const saveHotkeyConfig = usePanelStore((s) => s.saveHotkeyConfig);
  const clearPreviewDraft = usePanelStore((s) => s.clearPreviewDraft);
  const setShowUpdateModal = usePanelStore((s) => s.setShowUpdateModal);
  const [micDevices, setMicDevices] = useState<string[]>([micDevice]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void listAudioInputDevices()
      .then((devices) => {
        const names = devices.map((device) => device.name);
        setMicDevices(names.length > 0 ? names : [micDevice]);
      })
      .catch((error) => {
        console.warn("[TerminalVoice] 枚举麦克风失败:", error);
        showToast(t("toast.micEnumFail"), "warn");
      });
  }, [micDevice]);

  const isHome = activeTab === null;

  async function handleMinimize() {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch {
      // Browser dev mode - no-op
    }
  }

  async function handleClose() {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch {
      // Browser dev mode - no-op
    }
  }

  async function handleConfirmPreview(input: Parameters<typeof confirmPreview>[0]) {
    try {
      await confirmPreview(input);
      clearPreviewDraft();
      showToast(t("toast.confirmed"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
      throw error;
    }
  }

  async function handleCancelPreview() {
    try {
      await cancelPreview();
    } catch (error) {
      // Browser preview does not have the Tauri command; clearing locally is still safe.
      if ("__TAURI_INTERNALS__" in window) {
        showToast(error instanceof Error ? error.message : String(error), "error");
      }
    } finally {
      clearPreviewDraft();
    }
  }

  const displayDraft = previewDraft
    ? llmStreamingText !== null
      ? { ...previewDraft, processedText: llmStreamingText }
      : previewDraft
    : null;

  return (
    <div
      className={cn("w-full h-full flex items-stretch justify-stretch p-1", dark ? "dark" : "theme-light")}
      style={{ background: "transparent" }}
    >
      <div className="relative w-full h-full flex flex-col rounded-[22px] bg-neutral-900 text-neutral-100 shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* ========== 顶部栏 ========== */}
        <header
          className="flex items-center justify-between px-5 pt-[18px] pb-[12px] shrink-0"
          data-tauri-drag-region
        >
          <div className="flex items-center gap-[10px] min-w-0">
            <span
              data-tip={`${t("panel.header.serviceRunning")} · ${appStatus}`}
              className="tip-below tip-left relative flex h-[10px] w-[10px] shrink-0 cursor-help"
            >
              <span
                className={cn(
                  "rounded-full bg-green-500",
                  recording
                    ? "h-[12px] w-[12px] animate-pulse -ml-[1px] -mt-[1px]"
                    : "h-[10px] w-[10px]"
                )}
              />
            </span>
            <span className="text-[20px] font-[500] leading-none tracking-tight truncate">
              TerminalVoice
            </span>
            {updateInfo && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowUpdateModal(true); }}
                className="shrink-0 h-[16px] px-[6px] rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-[10px] font-medium leading-none transition-colors"
                title={t("tab.settings.updateAvailable", { version: updateInfo.version })}
              >
                v{updateInfo.version}
              </button>
            )}
          </div>

          <div className="flex items-center gap-[2px]">
            <IconBtn
              title={t("panel.header.btn.record.tooltip")}
              data-tip={t("panel.header.btn.record.holdTip", { key: formatKeyLabel(pttKey) })}
              accent={recording}
              className="tip-below"
              onClick={() => {
                showToast(
                  recording
                    ? t("panel.header.btn.recording")
                    : t("panel.header.btn.recordInactive", { key: formatKeyLabel(pttKey) }),
                  "info",
                );
              }}
            >
              {recording ? (
                <Square className="w-[14px] h-[14px]" fill="currentColor" />
              ) : (
                <Circle className="w-[18px] h-[18px]" strokeWidth={1.5} />
              )}
            </IconBtn>
            <IconBtn title={t("panel.header.btn.minimize")} data-tip={t("panel.header.btn.minimize")} className="tip-below" onClick={handleMinimize}>
              <Minus className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
            <IconBtn title={t("panel.header.btn.close")} data-tip={t("panel.header.btn.close")} className="tip-below" onClick={handleClose}>
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
          </div>
        </header>

        {/* 分隔线 */}
        <div className="h-px mx-5 bg-neutral-800 shrink-0" />

        {/* ========== 内容区 ========== */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-[14px] pb-2 min-h-0">
          {isHome && <StateView />}
          {isHome ? (
            <HomeView
              recording={recording}
              pttKey={pttKey}
              ttsKey={ttsKey}
              translateKey={translateKey}
              micDevice={micDevice}
              micDevices={micDevices}
              soundOn={soundOn}
              muteSys={muteSys}
              autoStart={autoStart}
              skipPreview={skipPreview}
              serviceReady={serviceReady}
              quotaDisplay={quotaDisplay}
              setSoundOn={setSoundOn}
              setMuteSys={setMuteSys}
              setAutoStart={setAutoStart}
              setMicDevice={setMicDevice}
              setSkipPreview={(v) => setServiceConfig({ skipPreview: v })}
              onSaveHotkey={saveHotkeyConfig}
              onOpenService={() => setActiveTab("service")}
            />
          ) : (
            <TabContent activeTab={activeTab} />
          )}
        </main>

        {/* ========== 底部 Tab 栏 ========== */}
        <footer
          className="flex items-center justify-between px-[12px] py-[8px] border-t border-neutral-800 shrink-0 relative gap-2"
        >
          {/* 左侧：快捷按钮（与右侧 TabBtn 同样大小 w-9 h-9，同样间距 gap-[2px]） */}
          <div className="flex items-center gap-[2px]">
            <FooterBtn
              onClick={() => {
                const next = uiLang === "zh-CN" ? "en" : "zh-CN";
                setUiLang(next);
                showToast(t("toast.langSwitched", { lang: t(`panel.footer.langLabel.${next === "zh-CN" ? "cn" : "en"}`) }), "info");
              }}
              title={t("panel.footer.uiLang.title")}
            >
              <span className="text-[11px] font-semibold leading-none tracking-wide">
                {uiLang === "zh-CN" ? "CN" : "EN"}
              </span>
            </FooterBtn>
            <FooterBtn
              onClick={toggleDark}
              title={dark ? t("panel.footer.dark.light") : t("panel.footer.dark.dark")}
            >
              {dark ? <Sun className="w-[18px] h-[18px]" strokeWidth={1.8} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={1.8} />}
            </FooterBtn>
          </div>

          {/* 右侧：Tab 按钮组 */}
          <div className="flex items-center gap-[2px]">
            <TabBtn
              active={activeTab === "service"}
              onClick={() => setActiveTab(activeTab === "service" ? null : "service")}
              title={t("panel.footer.tab.service")}
              data-tip={t("panel.footer.tab.service")}
              className="tip-above"
            >
              <Square className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "skill"}
              onClick={() => setActiveTab(activeTab === "skill" ? null : "skill")}
              title={t("panel.footer.tab.skill")}
              data-tip={t("panel.footer.tab.skill")}
              className="tip-above"
            >
              <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "dict"}
              onClick={() => setActiveTab(activeTab === "dict" ? null : "dict")}
              title={t("panel.footer.tab.dict")}
              data-tip={t("panel.footer.tab.dict")}
              className="tip-above"
            >
              <BookText className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "history"}
              onClick={() => setActiveTab(activeTab === "history" ? null : "history")}
              title={t("panel.footer.tab.history")}
              data-tip={t("panel.footer.tab.history")}
              className="tip-above"
            >
              <Clock className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "help"}
              onClick={() => setActiveTab(activeTab === "help" ? null : "help")}
              title={t("panel.footer.tab.help")}
              data-tip={t("panel.footer.tab.help")}
              className="tip-above"
            >
              <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "settings"}
              onClick={() => setActiveTab(activeTab === "settings" ? null : "settings")}
              title={t("panel.footer.tab.settings")}
              data-tip={t("panel.footer.tab.settings")}
              className="tip-above"
            >
              <SettingsIcon className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
          </div>
        </footer>
        <PreviewPopup
          draft={displayDraft}
          onConfirm={handleConfirmPreview}
          onCancel={handleCancelPreview}
        />
      </div>
    </div>
  );
}

/* ========== 主页视图 ========== */
function HomeView({
  pttKey,
  ttsKey,
  translateKey,
  micDevice,
  micDevices,
  soundOn,
  muteSys,
  autoStart,
  skipPreview,
  serviceReady,
  quotaDisplay,
  setSoundOn,
  setMuteSys,
  setAutoStart,
  setMicDevice,
  setSkipPreview,
  onSaveHotkey,
  onOpenService,
}: {
  recording: boolean;
  pttKey: string;
  ttsKey: string;
  translateKey: string;
  micDevice: string;
  micDevices: string[];
  soundOn: boolean;
  muteSys: boolean;
  autoStart: boolean;
  skipPreview: boolean;
  serviceReady: boolean;
  quotaDisplay: string;
  setSoundOn: (v: boolean) => void;
  setMuteSys: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  setMicDevice: (value: string) => void;
  setSkipPreview: (v: boolean) => void;
  onSaveHotkey: (config: { pttKey: string; ttsKey: string; translateKey: string }) => Promise<void>;
  onOpenService: () => void;
}) {
  const t = useT();
  return (
    <>
      {/* 服务配置：可点击进入配置页 */}
      <button
        onClick={onOpenService}
        className="w-full bg-neutral-800 rounded-xl px-4 py-3 mb-3 flex items-center gap-3 hover:bg-neutral-800/80 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] text-neutral-100 leading-none">{t("panel.header.serviceConfig")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-[6px] rounded-full overflow-hidden bg-neutral-700">
            <div className={cn("h-full rounded-full", serviceReady ? "bg-green-500 w-full" : "bg-amber-500 w-1/3")} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] text-neutral-400 tabular-nums">{quotaDisplay}</span>
          <ChevronRight className="w-[16px] h-[16px] text-neutral-500" />
        </div>
      </button>

      {/* 快捷键设置 */}
      <div className="bg-neutral-800 rounded-xl p-3 mb-3 space-y-2">
        <div className="text-[12px] text-neutral-500 px-1 pb-1">{t("panel.home.hotkeySectionTitle")}</div>
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-neutral-200 shrink-0">{t("panel.home.hotkey.ptt")}</span>
          <HotkeyRecorder
            value={pttKey}
            onChange={(v) => onSaveHotkey({ pttKey: v, ttsKey, translateKey })}
            widthClass="min-w-[110px]"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-neutral-200 shrink-0">
            {t("panel.home.hotkey.tts")} <span className="text-neutral-500">(Alt+)</span>
          </span>
          <HotkeyRecorder
            value={ttsKey}
            onChange={(v) => onSaveHotkey({ pttKey, ttsKey: v, translateKey })}
            widthClass="min-w-[80px]"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-neutral-200 shrink-0">
            {t("panel.home.hotkey.translate")} <span className="text-neutral-500">(Alt+)</span>
          </span>
          <HotkeyRecorder
            value={translateKey}
            onChange={(v) => onSaveHotkey({ pttKey, ttsKey, translateKey: v })}
            widthClass="min-w-[80px]"
          />
        </div>
      </div>

      {/* 麦克风 */}
      <SettingRow
        label={t("panel.home.mic.label")}
        helpTip={t("panel.home.mic.helpTip")}
        childrenLeft={
          <select
            aria-label={t("panel.home.mic.label")}
            value={micDevice}
            onChange={(event) => setMicDevice(event.target.value)}
            className="w-full min-w-0 appearance-none bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 border border-white/5 outline-none cursor-pointer"
          >
            {micDevices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
        }
        childrenRight={<ChevronRight className="w-[16px] h-[16px] text-neutral-500" />}
      />

      {/* 开关项 */}
      <div className="flex items-center justify-between px-1 py-3 mb-1">
        <span className="text-[14px] text-neutral-100 leading-none">{t("panel.home.toggle.sound")}</span>
        <ToggleSwitch checked={soundOn} onChange={setSoundOn} />
      </div>
      <div className="flex items-center justify-between px-1 py-3 mb-1">
        <span className="text-[14px] text-neutral-100 leading-none">{t("panel.home.toggle.muteSys")}</span>
        <ToggleSwitch checked={muteSys} onChange={setMuteSys} />
      </div>
      <div className="flex items-center justify-between px-1 py-3 mb-1">
        <span className="text-[14px] text-neutral-100 leading-none">{t("panel.home.toggle.autoStart")}</span>
        <ToggleSwitch checked={autoStart} onChange={setAutoStart} />
      </div>
      <div className="flex items-center justify-between px-1 py-3 mb-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] text-neutral-100 leading-none">{t("panel.home.preview.title")}</span>
          <span className="text-[11px] text-neutral-500">{t("panel.home.preview.desc")}</span>
        </div>
        <ToggleSwitch checked={!skipPreview} onChange={(v) => setSkipPreview(!v)} />
      </div>

      {/* 底部提示 */}
      <p className="text-[12px] text-center text-neutral-500 my-4">
        {t("panel.home.footerHint", { key: formatKeyLabel(pttKey) })}
      </p>
    </>
  );
}

/* ========== Tab 内容分发 ========== */
function TabContent({ activeTab }: { activeTab: TabKey | null }) {
  switch (activeTab) {
    case "history":  return <HistoryTab />;
    case "dict":     return <DictTab />;
    case "skill":    return <SkillTab />;
    case "service":  return <ServiceTab />;
    case "help":     return <HelpTab />;
    case "settings": return <SettingsTab />;
    default:         return null;
  }
}

/* ========== 子组件 ========== */
function IconBtn({
  children,
  title,
  onClick,
  accent,
  className,
  ...rest
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
  accent?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      title={title}
      onClick={onClick}
      {...rest}
      className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors", className)}
      style={{ color: accent ? "#22c55e" : "#a3a3a3" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function TabBtn({
  children,
  active,
  onClick,
  title,
  className,
  ...rest
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      title={title}
      {...rest}
      className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors", className)}
      style={{
        color: active ? "#22c55e" : "#a3a3a3",
        background: active ? "rgba(34,197,94,0.12)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? "rgba(34,197,94,0.12)" : "transparent";
      }}
    >
      {children}
    </button>
  );
}

/* 底部快捷按钮（与 TabBtn 同尺寸 w-9 h-9 圆形，图标统一 18px） */
function FooterBtn({
  children,
  onClick,
  title,
  className,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      title={title}
      {...rest}
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center transition-colors text-neutral-400 hover:text-neutral-100",
        className,
      )}
      style={{ background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

