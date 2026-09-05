import { useEffect, useState } from "react";
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
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "../../lib/cn";
import { cancelPreview, confirmPreview, listAudioInputDevices } from "../../lib/commands";
import { SettingRow } from "../../components/ui/SettingRow";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { usePanelStore } from "../../stores/appStore";
import { showToast } from "../../stores/toastStore";
import { HistoryTab } from "./tabs/HistoryTab";
import { DictTab } from "./tabs/DictTab";
import { SkillTab } from "./tabs/SkillTab";
import { ServiceTab } from "./tabs/ServiceTab";
import { HelpTab } from "./tabs/HelpTab";
import type { TabKey } from "../../stores/appStore";
import { PreviewPopup } from "./PreviewPopup";

/**
 * 极简面板 v6
 * - 主页：快捷设置（服务配置/触发键/麦克风/开关）
 * - 点击底部 Tab 切换到对应功能页
 * - 点击「服务配置」行进入 ServiceTab
 * - Zustand 管理全部状态 + Toast 反馈
 */
export function PanelWindow() {
  const dark = usePanelStore((s) => s.dark);
  const activeTab = usePanelStore((s) => s.activeTab);
  const appStatus = usePanelStore((s) => s.appStatus);
  const recording = appStatus === "Recording";
  const pttKey = usePanelStore((s) => s.pttKey);
  const micDevice = usePanelStore((s) => s.micDevice);
  const soundOn = usePanelStore((s) => s.soundOn);
  const muteSys = usePanelStore((s) => s.muteSys);
  const autoStart = usePanelStore((s) => s.autoStart);
  const serviceReady = usePanelStore((s) => s.serviceReady);
  const quotaDisplay = usePanelStore((s) => s.quotaDisplay);
  const previewDraft = usePanelStore((s) => s.previewDraft);

  const toggleDark = usePanelStore((s) => s.toggleDark);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const setSoundOn = usePanelStore((s) => s.setSoundOn);
  const setMuteSys = usePanelStore((s) => s.setMuteSys);
  const setAutoStart = usePanelStore((s) => s.setAutoStart);
  const setMicDevice = usePanelStore((s) => s.setMicDevice);
  const clearPreviewDraft = usePanelStore((s) => s.clearPreviewDraft);
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
    showToast("更多选项（开发中）", "info");
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

  return (
    <div
      className={cn("w-full h-full flex items-center justify-center", dark ? "dark" : "theme-light")}
      style={{ background: "transparent" }}
    >
      <div className="relative w-[380px] flex flex-col rounded-[22px] bg-neutral-900 text-neutral-100 shadow-2xl ring-1 ring-white/10 max-h-[600px]">
        {/* ========== 顶部栏 ========== */}
        <header
          className="flex items-center justify-between px-5 pt-[18px] pb-[12px] shrink-0"
          data-tauri-drag-region
        >
          <div className="flex items-center gap-[10px]">
            <span
              data-tip={`服务运行中 · ${appStatus}`}
              className="relative flex h-[10px] w-[10px] shrink-0 cursor-help"
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
            <span className="text-[20px] font-[500] leading-none tracking-tight">
              TerminalVoice
            </span>
          </div>

          <div className="flex items-center gap-[2px]">
            <IconBtn
              title="通过触发键录音"
              data-tip={`按住 ${pttKey} 录音`}
              accent={recording}
              onClick={() => {
                showToast(
                  recording ? "录音进行中，请松开触发键结束" : `请使用 ${pttKey} 触发录音`,
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
            <IconBtn title="更多" data-tip="更多选项" onClick={handleMore}>
              <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
            <IconBtn title="最小化到托盘" data-tip="最小化到托盘" onClick={handleMinimize}>
              <Minus className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
            <IconBtn title="关闭面板" data-tip="关闭面板" onClick={handleClose}>
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </IconBtn>
            <button
              onClick={toggleDark}
              aria-label={dark ? "切换为浅色主题" : "切换为深色主题"}
              aria-pressed={dark}
              data-tip={dark ? "切换为浅色主题" : "切换为深色主题"}
              className="ml-[6px] w-7 h-7 rounded-full text-[11px] flex items-center justify-center transition-colors border border-white/10 text-neutral-400 hover:text-neutral-200 hover:border-white/20"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        {/* 分隔线 */}
        <div className="h-px mx-5 bg-neutral-800 shrink-0" />

        {/* ========== 内容区 ========== */}
        <main className="flex-1 overflow-y-auto px-5 pt-[14px] pb-2 min-h-0">
          {isHome ? (
            <HomeView
              recording={recording}
              pttKey={pttKey}
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
              onOpenService={() => setActiveTab("service")}
            />
          ) : (
            <TabContent activeTab={activeTab} />
          )}
        </main>

        {/* ========== 底部 Tab 栏 ========== */}
        <footer
          className="flex items-center justify-center px-[12px] py-[8px] border-t border-neutral-800 shrink-0"
        >
          <div className="flex items-center gap-[2px]">
            <TabBtn
              active={activeTab === "skill"}
              onClick={() => setActiveTab(activeTab === "skill" ? null : "skill")}
              data-tip="语音技能"
            >
              <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "dict"}
              onClick={() => setActiveTab(activeTab === "dict" ? null : "dict")}
              data-tip="自定义词典"
            >
              <BookText className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "history"}
              onClick={() => setActiveTab(activeTab === "history" ? null : "history")}
              data-tip="历史记录"
            >
              <Clock className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
            <TabBtn
              active={activeTab === "help"}
              onClick={() => setActiveTab(activeTab === "help" ? null : "help")}
              data-tip="帮助与关于"
            >
              <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </TabBtn>
          </div>
        </footer>
        <PreviewPopup
          draft={previewDraft}
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
  onOpenService,
}: {
  recording: boolean;
  pttKey: string;
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

      {/* 触发按键 */}
      <SettingRow
        label="设置触发键"
        helpIcon
        helpTip="按住此键开始录音，松开上屏。可单击切换免提模式。"
        childrenLeft={
          <input
            aria-label="设置触发键"
            type="text"
            value={pttKey}
            readOnly
            className="w-full min-w-0 bg-neutral-900 rounded-lg px-3 py-2 text-[15px] font-mono tracking-wider text-neutral-100 border border-white/5 text-center outline-none"
          />
        }
      />

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
        按住 {pttKey} 说话 · 松开上屏
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
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
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
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
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
