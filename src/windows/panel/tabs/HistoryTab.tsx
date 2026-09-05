import { useMemo, useState } from "react";
import { ArrowLeft, Search, Trash2, Copy, Trash } from "lucide-react";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";

export function HistoryTab() {
  const items = usePanelStore((s) => s.historyItems);
  const deleteHistory = usePanelStore((s) => s.deleteHistory);
  const clearHistory = usePanelStore((s) => s.clearHistory);
  const reInjectHistory = usePanelStore((s) => s.reInjectHistory);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.final_text.toLowerCase().includes(q) ||
        i.source_text.toLowerCase().includes(q)
    );
  }, [items, query]);

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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">历史记录</h2>
        <button
          onClick={() => {
            clearHistory();
            showToast("历史记录已清空", "success");
          }}
          className="text-[12px] text-neutral-500 hover:text-red-400 transition-colors px-2"
        >
          清空
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          placeholder="搜索历史记录..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-neutral-800 rounded-lg pl-9 pr-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none border border-white/5 focus:border-green-500/40 transition-colors"
        />
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 allow-select">
        {filtered.length === 0 ? (
          <div className="text-center text-neutral-500 text-[13px] py-12">
            {query ? "未找到匹配的记录" : "暂无历史记录"}
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-neutral-800 rounded-xl p-3 group hover:bg-neutral-800/80 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {item.created_at}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      reInjectHistory(item.id);
                      showToast("已复制到剪贴板", "success");
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-green-400 hover:bg-white/5 transition-colors"
                    data-tip="重新上屏"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      deleteHistory(item.id);
                      showToast("已删除", "info");
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                    data-tip="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[13px] text-neutral-100 leading-relaxed whitespace-pre-wrap">
                {item.final_text}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/60 text-neutral-400">
                  {item.asr_provider}
                </span>
                {item.text_mode !== "Normal" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                    {item.text_mode === "Developer" ? "开发者模式" : "原文"}
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
