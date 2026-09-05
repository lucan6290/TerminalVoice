import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { cn } from "../../../lib/cn";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";

export function DictTab() {
  const words = usePanelStore((s) => s.filterWords);
  const addFilterWord = usePanelStore((s) => s.addFilterWord);
  const toggleFilterWord = usePanelStore((s) => s.toggleFilterWord);
  const deleteFilterWord = usePanelStore((s) => s.deleteFilterWord);
  const updateFilterWord = usePanelStore((s) => s.updateFilterWord);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);

  const [newWord, setNewWord] = useState("");
  const [newRepl, setNewRepl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editRepl, setEditRepl] = useState("");

  function handleAdd() {
    const w = newWord.trim();
    if (!w) return;
    void addFilterWord(w, newRepl.trim()).then(() => showToast(`已添加过滤词「${w}」`, "success"));
    setNewWord("");
    setNewRepl("");
  }

  function startEdit(id: number, word: string, repl: string) {
    setEditingId(id);
    setEditWord(word);
    setEditRepl(repl);
  }

  function saveEdit() {
    if (editingId === null) return;
    void updateFilterWord(editingId, editWord.trim(), editRepl.trim()).then(() => showToast("已更新", "success"));
    setEditingId(null);
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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">自定义词典</h2>
        <span className="text-[11px] text-neutral-500">{words.filter((w) => w.enabled).length} 条生效</span>
      </div>

      <p className="text-[12px] text-neutral-500 mb-3 px-1 leading-relaxed">
        添加常见口语词或错别字，语音识别后会自动替换为空或指定文字。
      </p>

      {/* 新增行 */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="过滤词"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 bg-neutral-800 rounded-lg px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none border border-white/5 focus:border-green-500/40 transition-colors"
        />
        <input
          type="text"
          placeholder="替换为（空=删除）"
          value={newRepl}
          onChange={(e) => setNewRepl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 bg-neutral-800 rounded-lg px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none border border-white/5 focus:border-green-500/40 transition-colors"
        />
        <button
          onClick={handleAdd}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
        {words.length === 0 ? (
          <div className="text-center text-neutral-500 text-[13px] py-12">
            暂无过滤词
          </div>
        ) : (
          words.map((w) => (
            <div
              key={w.id}
              className="bg-neutral-800 rounded-xl px-3 py-2.5 flex items-center gap-2"
            >
              {editingId === w.id ? (
                <>
                  <input
                    value={editWord}
                    onChange={(e) => setEditWord(e.target.value)}
                    className="flex-1 bg-neutral-900 rounded px-2 py-1 text-[13px] text-neutral-100 outline-none border border-white/10"
                    autoFocus
                  />
                  <span className="text-neutral-600">→</span>
                  <input
                    value={editRepl}
                    onChange={(e) => setEditRepl(e.target.value)}
                    placeholder="（空）"
                    className="flex-1 bg-neutral-900 rounded px-2 py-1 text-[13px] text-neutral-100 outline-none border border-white/10"
                  />
                  <button onClick={saveEdit} className="w-7 h-7 rounded flex items-center justify-center text-green-400 hover:bg-white/5">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:bg-white/5">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className={cn("text-[13px] text-neutral-100", !w.enabled && "line-through text-neutral-500")}>
                    {w.word}
                  </span>
                  {w.replacement && (
                    <>
                      <span className="text-neutral-600 text-[12px]">→</span>
                      <span className={cn("text-[13px] text-green-400", !w.enabled && "text-neutral-500")}>
                        {w.replacement}
                      </span>
                    </>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => startEdit(w.id, w.word, w.replacement)}
                    className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      void deleteFilterWord(w.id).then(() => showToast("已删除", "info"));
                    }}
                    className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-white/5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ToggleSwitch checked={w.enabled} onChange={() => void toggleFilterWord(w.id)} />
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
