import { useEffect, useRef, useState } from "react";
import {
  X,
  MoreHorizontal,
  Circle,
  ChevronRight,
  Sparkles,
  BookText,
  Clock,
  HelpCircle,
  Minus,
  Square,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Globe,
  Moon,
  Sun,
  Github,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-shell";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";
import { cancelPreview, confirmPreview, exportData, importData, listAudioInputDevices } from "../../lib/commands";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreOpen]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void listAudioInputDevices()
      .then((devices) => {
        const names = devices.map((device) => device.name);
        setMicDevices(names.length > 0 ? names : [micDevice]);
      })
      .catch((error) => {
        console.warn("[TerminalVoice] 枚举麦克风失败:", error);
        showToast("无法读取麦克风设备", "warn");
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

  function handleMore() {
    setMoreOpen((v) => !v);
  }

  async function handleExportData() {
    setMoreOpen(false);
    if (!("__TAURI_INTERNALS__" in window)) {
      showToast("浏览器模式不支持数据导出", "info");
      return;
    }
    try {
      showToast("正在导出数据...", "info");
      const data = await exportData();
      const blob = new Blob([new Uint8Array(data)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `terminalvoice-backup-${date}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("数据导出成功", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败", "error");
    }
  }

  function handleImportClick() {
    setMoreOpen(false);
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!("__TAURI_INTERNALS__" in window)) {
      showToast("浏览器模式不支持数据导入", "info");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buf));
      await importData(data);
      showToast("数据导入成功，正在刷新...", "success");
      await usePanelStore.getState().loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导入失败", "error");
    }
  }

  async function handleCheckUpdate() {
    setMoreOpen(false);
    const { checkForUpdate } = usePanelStore.getState();
    showToast("正在检查更新...", "info");
    await checkForUpdate();
    const info = usePanelStore.getState().updateInfo;
    if (info?.hasUpdate) {
      usePanelStore.getState().setShowUpdateModal(true);
    } else {
      showToast("当前已是最新版本", "success");
    }
  }

  async function handleQuit() {
    setMoreOpen(false);
    if (!("__TAURI_INTERNALS__" in window)) {
      showToast("浏览器模式不支持退出", "info");
      return;
    }
    try {
      const { exit } = await import("@tauri-apps/plugin-process");
      await exit(0);
    } catch {
      showToast("退出失败", "error");
    }
  }

  async function handleConfirmPreview(input: Parameters<typeof confirmPreview>[0]) {
    try {
      await confirmPreview(input);
      clearPreviewDraft();
      showToast("已确认并上屏", "success");
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
              data-tip={`服务运行中 · ${appStatus}`}
              className="tip-below relative flex h-[10px] w-[10px] shrink-0 cursor-help"
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
                title={`新版本 v${updateInfo.version} 可用，点击查看`}
              >
                v{updateInfo.version}
              </button>
            )}
          </div>

          <div className="flex items-center gap-[2px]">
            <IconBtn
              title="通过触发键录音"
              data-tip={`按住 ${formatKeyLabel(pttKey)} 录音`}
              accent={recording}
              className="tip-below"
              onClick={() => {
                showToast(
                  recording ? "录音进行中，请松开触发键结束" : `请使用 ${formatKeyLabel(pttKey)} 触发录音`,
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
            <IconBtn title="最小化到托盘" data-tip="最小化到托盘" className="tip-below" onClick={handleMinimize}>
              <Minus className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
            <IconBtn title="关闭面板" data-tip="关闭面板" className="tip-below" onClick={handleClose}>
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
          </div>
        </header>

        {/* 分隔线 */}
        <div className="h-px mx-5 bg-neutral-800 shrink-0" />

        {/* ========== 内容区 ========== */}
        <main className="flex-1 overflow-y-auto px-5 pt-[14px] pb-2 min-h-0">
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
              serviceReady={serviceReady}
              quotaDisplay={quotaDisplay}
              setSoundOn={setSoundOn}
              setMuteSys={setMuteSys}
              setAutoStart={setAutoStart}
              setMicDevice={setMicDevice}
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
          {/* 左侧：快捷按钮 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <QuickPill
              onClick={() => {
                const next = service.translateTargetLang === "中文" ? "英文" : "中文";
                setServiceConfig({ translateTargetLang: next });
                showToast(`翻译目标语言已切换为${next}`, "info");
              }}
              title={`翻译目标语言：${service.translateTargetLang}（点击切换）`}
              wide
            >
              <Globe className="w-[14px] h-[14px] shrink-0" />
              <span className="text-[12px] font-medium leading-none">
                {service.translateTargetLang === "中文" ? "CN" : service.translateTargetLang === "英文" ? "EN" : service.translateTargetLang.slice(0, 2).toUpperCase()}
              </span>
            </QuickPill>
            <QuickPill
              onClick={toggleDark}
              title={dark ? "切换为浅色主题" : "切换为深色主题"}
            >
              {dark ? <Sun className="w-[14px] h-[14px] shrink-0" /> : <Moon className="w-[14px] h-[14px] shrink-0" />}
            </QuickPill>
            <QuickPill
              onClick={() => {
                open("https://github.com").catch(() => {
                  if ("__TAURI_INTERNALS__" in window) {
                    showToast("无法打开浏览器", "error");
                  } else {
                    window.open("https://github.com", "_blank");
                  }
                });
              }}
              title="访问 GitHub"
            >
              <Github className="w-[14px] h-[14px] shrink-0" />
            </QuickPill>
          </div>

          {/* 右侧：Tab 按钮组 */}
          <div className="flex items-center gap-[2px]">
            <TabBtn
              active={activeTab === "skill"}
              onClick={() => setActiveTab(activeTab === "skill" ? null : "skill")}
              data-tip="语音技能"
              className="tip-above"
            >
              <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "dict"}
              onClick={() => setActiveTab(activeTab === "dict" ? null : "dict")}
              data-tip="自定义词典"
              className="tip-above"
            >
              <BookText className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "history"}
              onClick={() => setActiveTab(activeTab === "history" ? null : "history")}
              data-tip="历史记录"
              className="tip-above"
            >
              <Clock className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "help"}
              onClick={() => setActiveTab(activeTab === "help" ? null : "help")}
              data-tip="帮助与关于"
              className="tip-above"
            >
              <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <div className="w-px h-5 bg-neutral-700 mx-1 shrink-0" />
            <div ref={moreMenuRef} className="relative">
              <TabBtn
                active={moreOpen}
                onClick={handleMore}
                title="更多选项"
                data-tip="更多选项"
                className="tip-above"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </TabBtn>
              {moreOpen && (
                <div
                  className="absolute bottom-[calc(100%+8px)] right-0 w-48 rounded-xl bg-neutral-800 shadow-2xl ring-1 ring-white/10 overflow-hidden animate-fade-in z-50"
                >
                  <MenuItem icon={Download} label="备份数据" onClick={handleExportData} />
                  <MenuItem icon={Upload} label="恢复数据" onClick={handleImportClick} />
                  <MenuItem icon={RefreshCw} label="检查更新" onClick={handleCheckUpdate} />
                  <div className="h-px bg-white/5" />
                  <MenuItem icon={LogOut} label="退出应用" onClick={handleQuit} danger />
                </div>
              )}
            </div>
          </div>
        </footer>
        <input
          ref={fileInputRef}
          type="file"
          accept=".db,.bin,application/octet-stream"
          className="hidden"
          onChange={handleImportFile}
        />
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
  serviceReady,
  quotaDisplay,
  setSoundOn,
  setMuteSys,
  setAutoStart,
  setMicDevice,
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
  serviceReady: boolean;
  quotaDisplay: string;
  setSoundOn: (v: boolean) => void;
  setMuteSys: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  setMicDevice: (value: string) => void;
  onSaveHotkey: (config: { pttKey: string; ttsKey: string; translateKey: string }) => Promise<void>;
  onOpenService: () => void;
}) {
  return (
    <>
      {/* 服务配置：可点击进入配置页 */}
      <button
        onClick={onOpenService}
        className="w-full bg-neutral-800 rounded-xl px-4 py-3 mb-3 flex items-center gap-3 hover:bg-neutral-800/80 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] text-neutral-100 leading-none">服务配置</span>
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
        <div className="text-[12px] text-neutral-500 px-1 pb-1">快捷键 · 点击按键可重新录制</div>
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-neutral-200 shrink-0">按住说话</span>
          <HotkeyRecorder
            value={pttKey}
            onChange={(v) => onSaveHotkey({ pttKey: v, ttsKey, translateKey })}
            widthClass="min-w-[110px]"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-neutral-200 shrink-0">
            朗读 <span className="text-neutral-500">(Alt+)</span>
          </span>
          <HotkeyRecorder
            value={ttsKey}
            onChange={(v) => onSaveHotkey({ pttKey, ttsKey: v, translateKey })}
            widthClass="min-w-[80px]"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-neutral-200 shrink-0">
            翻译 <span className="text-neutral-500">(Alt+)</span>
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
        label="选择麦克风"
        helpTip="选择录音输入设备"
        childrenLeft={
          <select
            aria-label="选择麦克风"
            value={micDevice}
            onChange={(event) => setMicDevice(event.target.value)}
            className="w-full min-w-0 appearance-none bg-neutral-900 rounded-lg px-3 py-2 text-[14px] text-neutral-100 border border-white/5 outline-none"
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
        <span className="text-[14px] text-neutral-100 leading-none">交互声音</span>
        <ToggleSwitch checked={soundOn} onChange={setSoundOn} />
      </div>
      <div className="flex items-center justify-between px-1 py-3 mb-1">
        <span className="text-[14px] text-neutral-100 leading-none">使用时静音系统声音</span>
        <ToggleSwitch checked={muteSys} onChange={setMuteSys} />
      </div>
      <div className="flex items-center justify-between px-1 py-3 mb-1">
        <span className="text-[14px] text-neutral-100 leading-none">开机启动并隐藏面板</span>
        <ToggleSwitch checked={autoStart} onChange={setAutoStart} />
      </div>

      {/* 底部提示 */}
      <p className="text-[12px] text-center text-neutral-500 my-4">
        按住 {formatKeyLabel(pttKey)} 说话 · 松开上屏
      </p>
    </>
  );
}

/* ========== Tab 内容分发 ========== */
function TabContent({ activeTab }: { activeTab: TabKey | null }) {
  switch (activeTab) {
    case "history": return <HistoryTab />;
    case "dict":    return <DictTab />;
    case "skill":   return <SkillTab />;
    case "service": return <ServiceTab />;
    case "help":    return <HelpTab />;
    default:        return null;
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

/* 底部快捷药丸按钮 */
function QuickPill({
  children,
  onClick,
  title,
  wide,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center gap-1 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 transition-colors",
        wide ? "px-3 min-w-[64px]" : "w-8",
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors text-left",
        danger ? "text-red-400 hover:bg-red-500/10" : "text-neutral-200 hover:bg-white/5",
      )}
    >
      <Icon className="w-[16px] h-[16px] shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}
