import { useRef, useState } from "react";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Bell,
  Volume2,
  VolumeX,
  Power,
  Shield,
  Info,
} from "lucide-react";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import { exportData, importData } from "../../../lib/commands";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import { useT } from "../../../lib/i18n";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function SettingsTab() {
  const t = useT();
  const soundOn = usePanelStore((s) => s.soundOn);
  const muteSys = usePanelStore((s) => s.muteSys);
  const autoStart = usePanelStore((s) => s.autoStart);
  const updateInfo = usePanelStore((s) => s.updateInfo);
  const setSoundOn = usePanelStore((s) => s.setSoundOn);
  const setMuteSys = usePanelStore((s) => s.setMuteSys);
  const setAutoStart = usePanelStore((s) => s.setAutoStart);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const checkForUpdate = usePanelStore((s) => s.checkForUpdate);
  const setShowUpdateModal = usePanelStore((s) => s.setShowUpdateModal);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleExport() {
    if (!isTauri()) {
      showToast(t("toast.browserNoExport"), "info");
      return;
    }
    setBusy("export");
    try {
      showToast(t("toast.exporting"), "info");
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
      showToast(t("toast.exportSuccess"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.exportFail"), "error");
    } finally {
      setBusy(null);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isTauri()) {
      showToast(t("toast.browserNoImport"), "info");
      return;
    }
    setBusy("import");
    try {
      const buf = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buf));
      await importData(data);
      showToast(t("toast.importSuccess"), "success");
      await usePanelStore.getState().loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.importFail"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleCheckUpdate() {
    setBusy("update");
    showToast(t("toast.checkingUpdate"), "info");
    await checkForUpdate();
    const info = usePanelStore.getState().updateInfo;
    if (info?.hasUpdate) {
      setShowUpdateModal(true);
    } else {
      showToast(t("toast.alreadyLatest"), "success");
    }
    setBusy(null);
  }

  async function handleQuit() {
    if (!isTauri()) {
      showToast(t("toast.browserNoQuit"), "info");
      return;
    }
    try {
      const { exit } = await import("@tauri-apps/plugin-process");
      await exit(0);
    } catch {
      showToast(t("toast.quitFail"), "error");
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <button
          onClick={() => setActiveTab(null)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">
          {t("tab.settings.title")}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4 pb-2 allow-select">
        {/* 偏好设置 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> {t("tab.settings.section.preferences")}
          </p>
          <div className="bg-neutral-800 rounded-xl divide-y divide-white/5">
            <Row
              icon={soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              label={t("panel.home.toggle.sound")}
            >
              <ToggleSwitch checked={soundOn} onChange={setSoundOn} size="sm" />
            </Row>
            <Row
              icon={<VolumeX className="w-4 h-4" />}
              label={t("panel.home.toggle.muteSys")}
            >
              <ToggleSwitch checked={muteSys} onChange={setMuteSys} size="sm" />
            </Row>
            <Row
              icon={<Power className="w-4 h-4" />}
              label={t("panel.home.toggle.autoStart")}
            >
              <ToggleSwitch checked={autoStart} onChange={setAutoStart} size="sm" />
            </Row>
          </div>
        </section>

        {/* 数据管理 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> {t("tab.settings.section.data")}
          </p>
          <div className="bg-neutral-800 rounded-xl divide-y divide-white/5">
            <ActionRow
              icon={<Download className="w-4 h-4" />}
              label={t("panel.footer.menu.backup")}
              desc={t("tab.settings.desc.backup")}
              onClick={handleExport}
              loading={busy === "export"}
            />
            <ActionRow
              icon={<Upload className="w-4 h-4" />}
              label={t("panel.footer.menu.restore")}
              desc={t("tab.settings.desc.restore")}
              onClick={handleImportClick}
              loading={busy === "import"}
            />
          </div>
        </section>

        {/* 关于与更新 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> {t("tab.settings.section.about")}
          </p>
          <div className="bg-neutral-800 rounded-xl divide-y divide-white/5">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center text-green-400 shrink-0">
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] text-neutral-100 leading-tight">TerminalVoice</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {updateInfo?.currentVersion || "v0.2.0"}
                    {updateInfo?.hasUpdate && (
                      <span className="ml-2 text-green-400">
                        → v{updateInfo.version}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <ActionRow
              icon={<RefreshCw className="w-4 h-4" />}
              label={t("panel.footer.menu.checkUpdate")}
              desc={
                updateInfo?.hasUpdate
                  ? t("tab.settings.updateAvailable", { version: updateInfo.version })
                  : t("tab.settings.desc.checkUpdate")
              }
              onClick={handleCheckUpdate}
              loading={busy === "update"}
              accent={updateInfo?.hasUpdate}
            />
            <ActionRow
              icon={<LogOut className="w-4 h-4" />}
              label={t("panel.footer.menu.quit")}
              desc={t("tab.settings.desc.quit")}
              onClick={handleQuit}
              danger
            />
          </div>
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.bin,application/octet-stream"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-neutral-400 shrink-0 flex items-center justify-center w-4">
          {icon}
        </span>
        <span className="text-[13px] text-neutral-100 truncate">{label}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  desc,
  onClick,
  loading,
  danger,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  onClick: () => void;
  loading?: boolean;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50",
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : accent
            ? "text-green-400 hover:bg-green-500/10"
            : "text-neutral-100 hover:bg-white/5",
      )}
    >
      <span
        className={cn(
          "shrink-0 flex items-center justify-center w-4",
          danger ? "text-red-400" : accent ? "text-green-400" : "text-neutral-400",
        )}
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-tight">{label}</div>
        {desc && (
          <div
            className={cn(
              "text-[11px] mt-0.5 truncate",
              danger ? "text-red-400/70" : "text-neutral-500",
            )}
          >
            {desc}
          </div>
        )}
      </div>
    </button>
  );
}

function cn(...args: (string | false | undefined | null)[]): string {
  return args.filter(Boolean).join(" ");
}
