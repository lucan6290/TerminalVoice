import { useMemo, useState } from "react";
import { ArrowLeft, Search, Trash2, Copy } from "lucide-react";
import { useT } from "../../../lib/i18n";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import { searchHistory } from "../../../lib/commands";

export function HistoryTab() {
  const t = useT();
  const items = usePanelStore((s) => s.historyItems);
  const deleteHistory = usePanelStore((s) => s.deleteHistory);
  const clearHistory = usePanelStore((s) => s.clearHistory);
  const reInjectHistory = usePanelStore((s) => s.reInjectHistory);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<typeof items | null>(null);

  const filtered = useMemo(() => {
    return searchResults ?? items;
  }, [items, searchResults]);

  async function handleSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    if (!("__TAURI_INTERNALS__" in window)) {
      const lower = q.toLowerCase();
      setSearchResults(items.filter(
        (i) => i.finalText.toLowerCase().includes(lower) || i.sourceText.toLowerCase().includes(lower)
      ));
      return;
    }
    try {
      const results = await searchHistory(q);
      setSearchResults(results);
    } catch (error) {
      console.warn("[TerminalVoice] 搜索失败:", error);
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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">{t("tab.history.title")}</h2>
        <button
          onClick={() => {
            void clearHistory().then(() => showToast(t("tab.history.cleared"), "success"));
          }}
          className="text-[12px] text-neutral-500 hover:text-red-400 transition-colors px-2"
        >
          {t("tab.history.clearBtn")}
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          placeholder={t("tab.history.searchPlaceholder")}
          value={query}
          onChange={(e) => void handleSearch(e.target.value)}
          className="w-full bg-neutral-800 rounded-lg pl-9 pr-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none border border-white/5 focus:border-green-500/40 transition-colors"
        />
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 allow-select">
        {filtered.length === 0 ? (
          <div className="text-center text-neutral-500 text-[13px] py-12">
            {query ? t("tab.history.noResults") : t("tab.history.empty")}
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-neutral-800 rounded-xl p-3 group hover:bg-neutral-800/80 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {item.createdAt}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      void reInjectHistory(item.id).then(() => showToast(t("tab.history.reinjected"), "success"));
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-green-400 hover:bg-white/5 transition-colors"
                    data-tip={t("tab.history.reinject")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      void deleteHistory(item.id).then(() => showToast(t("tab.history.deleted"), "info"));
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                    data-tip={t("tab.history.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[13px] text-neutral-100 leading-relaxed whitespace-pre-wrap">
                {item.finalText}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/60 text-neutral-400">
                  {item.asrProvider}
                </span>
                {item.textMode !== "Normal" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                    {item.textMode === "Developer" ? t("tab.history.developerMode") : t("tab.history.rawText")}
                  </span>
                )}
                {item.llmRewritten && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                    {item.skillId ? t("tab.history.skillTag", { id: item.skillId }) : t("tab.history.aiPolished")}
                  </span>
                )}
                {typeof item.durationMs === "number" && item.durationMs > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/60 text-neutral-500 tabular-nums">
                    {(item.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {item.appContext && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 truncate max-w-[160px]" title={item.appContext}>
                    {item.appContext}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
