import { useEffect } from "react";
import { usePanelStore } from "../../stores/appStore";
import { showToast } from "../../stores/toastStore";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";

/**
 * 更新弹窗（接入 tauri-plugin-updater 真实更新流程）
 * - 有新版本时显示：版本标题、更新日志、取消/下载按钮
 * - 下载中显示：进度条，更新按钮禁用带 loading
 * - 下载完成显示：立即重启（调用 tauri-plugin-process 重启）
 * - 适配深浅主题（通过 appStore.dark 切换）
 */
export function UpdateModal() {
  const t = useT();
  const dark = usePanelStore((s) => s.dark);
  const updateInfo = usePanelStore((s) => s.updateInfo);
  const showUpdateModal = usePanelStore((s) => s.showUpdateModal);
  const updateDownloading = usePanelStore((s) => s.updateDownloading);
  const updateProgress = usePanelStore((s) => s.updateProgress);
  const updateDownloaded = usePanelStore((s) => s.updateDownloaded);
  const setShowUpdateModal = usePanelStore((s) => s.setShowUpdateModal);
  const startDownloadUpdate = usePanelStore((s) => s.startDownloadUpdate);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !updateDownloading) {
        setShowUpdateModal(false);
      }
    };
    if (showUpdateModal) {
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [showUpdateModal, updateDownloading, setShowUpdateModal]);

  if (!showUpdateModal || !updateInfo) return null;

  const handleUpdate = async () => {
    if (updateDownloaded) {
      // 重启应用完成安装
      try {
        if ("__TAURI_INTERNALS__" in window) {
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        } else {
          showToast(t("update.browserSimulated"), "info");
          setShowUpdateModal(false);
        }
      } catch {
        showToast(t("update.restartFail"), "error");
      }
      return;
    }
    await startDownloadUpdate();
  };

  const handleCancel = () => {
    if (updateDownloading) return;
    setShowUpdateModal(false);
  };

  return (
    <div
      className={cn("fixed inset-0 z-[60] flex items-center justify-center", dark ? "dark" : "theme-light")}
      style={{ background: dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)" }}
      onClick={handleCancel}
    >
      <div
        className="relative w-[440px] rounded-[22px] shadow-2xl overflow-hidden animate-fade-in"
        style={{
          background: "var(--color-bg-primary)",
          border: "0.5px solid var(--color-border-soft)",
          boxShadow: "var(--shadow-window)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--color-fg-primary)" }}>
            {t("update.title", { version: updateInfo.version })}
          </h2>
          <span className="text-[12px]" style={{ color: "var(--color-fg-tertiary)" }}>
            {t("update.currentVersion", { version: updateInfo.currentVersion })}
          </span>
        </div>

        {/* 更新内容 */}
        <div className="px-5 pb-4 max-h-[300px] overflow-y-auto allow-select">
          <ReleaseNotes content={updateInfo.releaseNotes} />
        </div>

        {/* 进度条 */}
        {(updateDownloading || updateDownloaded) && (
          <div className="px-5 pb-4">
            <div
              className="h-[4px] rounded-full overflow-hidden"
              style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{ width: `${updateProgress}%`, background: "#0a84ff" }}
              />
            </div>
            <p className="text-center text-[12px] mt-2 tabular-nums" style={{ color: "var(--color-fg-tertiary)" }}>
              {updateDownloaded ? t("update.downloadedHint") : `${updateProgress}%`}
            </p>
          </div>
        )}

        {/* 底部按钮 */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "0.5px solid var(--color-border-soft)" }}
        >
          <button
            onClick={handleCancel}
            disabled={updateDownloading}
            className="h-8 px-4 rounded-[10px] text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--color-fg-secondary)" }}
            onMouseEnter={(e) => !updateDownloading && (e.currentTarget.style.color = "var(--color-fg-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-fg-secondary)")}
          >
            {updateDownloaded ? t("update.later") : t("common.cancel")}
          </button>
          <button
            onClick={handleUpdate}
            disabled={updateDownloading}
            className="h-8 px-5 rounded-[10px] text-[13px] font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            style={{ background: "#0a84ff" }}
            onMouseEnter={(e) => !updateDownloading && (e.currentTarget.style.background = "#0a84ffd0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#0a84ff")}
          >
            {updateDownloading && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {updateDownloaded
              ? t("update.restartNow")
              : updateDownloading
                ? t("update.downloading")
                : t("update.downloadBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 简单 Markdown 渲染：支持 ## 标题 和 - 列表项 */
function ReleaseNotes({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 mb-3">
          {listItems.map((item, i) => (
            <li key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--color-fg-secondary)" }}>
              {item}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <p key={`h-${idx}`} className="text-[14px] font-medium mt-1 mb-2" style={{ color: "var(--color-fg-primary)" }}>
          {trimmed.slice(3)}
        </p>
      );
    } else if (/^\d+\.\d+\.\d+/.test(trimmed)) {
      flushList();
      elements.push(
        <p key={`v-${idx}`} className="text-[16px] font-semibold mb-1" style={{ color: "var(--color-fg-primary)" }}>
          {trimmed}
        </p>
      );
    } else if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
    } else if (trimmed) {
      flushList();
      elements.push(
        <p key={`p-${idx}`} className="text-[13px] leading-relaxed mb-2" style={{ color: "var(--color-fg-secondary)" }}>
          {trimmed}
        </p>
      );
    }
  });
  flushList();

  return <div>{elements}</div>;
}
