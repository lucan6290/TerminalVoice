import { ArrowLeft, Keyboard, Mic, Wand2, Settings, Info, Github } from "lucide-react";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";

export function HelpTab() {
  const pttKey = usePanelStore((s) => s.pttKey);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);

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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">帮助与关于</h2>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4 pb-2 allow-select">
        {/* 版本信息 */}
        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-[18px] font-semibold text-neutral-100 tracking-tight mb-1">
            TerminalVoice
          </div>
          <div className="text-[11px] text-neutral-500">v0.1.0 · 语音输入 AI 助手</div>
        </div>

        {/* 快捷键 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" /> 快捷键
          </p>
          <div className="bg-neutral-800 rounded-xl divide-y divide-white/5">
            <ShortcutRow keys={[pttKey]} desc="按住说话，松开上屏" />
            <ShortcutRow keys={[pttKey, "单击"]} desc="切换免提模式（按一次开始，再按一次结束）" />
            <ShortcutRow keys={["Esc"]} desc="关闭预览弹窗 / 停止录音" />
            <ShortcutRow keys={["Ctrl", "Enter"]} desc="预览中确认并换行" />
          </div>
        </section>

        {/* 使用指南 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> 使用指南
          </p>
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2.5 text-[12px] text-neutral-300 leading-relaxed">
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">1.</span>
              <span>将光标定位到需要输入文字的地方（微信、浏览器、编辑器等）。</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">2.</span>
              <span>按住 <b className="text-neutral-100 font-mono text-[11px]">{pttKey}</b> 对着麦克风说话，音量适中即可。</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">3.</span>
              <span>松开按键，识别结果经AI整理后自动写入焦点输入框。</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">4.</span>
              <span>选中文本后按住热键说出修改要求，可直接改写选中内容。</span>
            </div>
          </div>
        </section>

        {/* AI 整理说明 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> AI 整理模式
          </p>
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2 text-[12px] text-neutral-300 leading-relaxed">
            <div><b className="text-neutral-100">原文直出</b>：不做任何AI处理，输出识别结果原样。</div>
            <div><b className="text-neutral-100">原意校对</b>：只修正错别字、标点，保持原意和口语风格。</div>
            <div><b className="text-neutral-100">自然润色</b>：将口语转为流畅书面表达，推荐日常使用。</div>
            <div><b className="text-neutral-100">结构整理</b>：自动分段、加标点、提炼要点，适合长内容。</div>
          </div>
        </section>

        {/* 链接 */}
        <div className="flex gap-2">
          <LinkBtn icon={Settings} label="服务配置" onClick={() => setActiveTab("service")} />
          <LinkBtn icon={Github} label="项目主页" onClick={() => showToast("即将打开 GitHub", "info")} />
          <LinkBtn icon={Info} label="反馈问题" onClick={() => showToast("感谢反馈！", "info")} />
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span className="text-neutral-600 mx-0.5 text-[10px]">+</span>}
            <kbd className="text-[10px]">{k}</kbd>
          </span>
        ))}
      </div>
      <span className="text-[12px] text-neutral-400 flex-1">{desc}</span>
    </div>
  );
}

function LinkBtn({ icon: Icon, label, onClick }: { icon: typeof Settings; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-neutral-800 rounded-xl py-2.5 flex flex-col items-center gap-1 hover:bg-neutral-800/80 transition-colors"
    >
      <Icon className="w-4 h-4 text-neutral-400" />
      <span className="text-[11px] text-neutral-400">{label}</span>
    </button>
  );
}
