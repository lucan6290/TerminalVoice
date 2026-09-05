import { ArrowLeft, Wand2, FileText, Sparkles, List, Type } from "lucide-react";
import { cn } from "../../../lib/cn";
import { usePanelStore } from "../../../stores/appStore";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { TextProcessMode } from "../../../lib/types";

const MODES: { key: TextProcessMode; label: string; desc: string; icon: typeof Wand2 }[] = [
  { key: "off",       label: "原文直出",   desc: "不进行AI整理，输出识别原文",       icon: Type },
  { key: "proofread", label: "原意校对",   desc: "修正错别字和标点，保留原意",       icon: FileText },
  { key: "polish",    label: "自然润色",   desc: "优化表达流畅度，口语转书面",       icon: Wand2 },
  { key: "structure", label: "结构整理",   desc: "自动分段、加标点、整理要点",       icon: List },
];

export function SkillTab() {
  const service = usePanelStore((s) => s.service);
  const setServiceConfig = usePanelStore((s) => s.setServiceConfig);
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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">语音技能</h2>
      </div>

      {/* AI 整理模式 */}
      <p className="text-[12px] text-neutral-500 mb-2 px-1">AI 文字整理模式</p>
      <div className="space-y-2 mb-4">
        {MODES.map((m) => {
          const active = service.textMode === m.key;
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => setServiceConfig({ textMode: m.key })}
              className={cn(
                "w-full bg-neutral-800 rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                active ? "ring-1 ring-green-500/40 bg-green-500/5" : "hover:bg-neutral-800/80"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                active ? "bg-green-500/20 text-green-400" : "bg-neutral-700/60 text-neutral-400"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-[13px] font-medium", active ? "text-green-400" : "text-neutral-100")}>
                  {m.label}
                </div>
                <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">{m.desc}</div>
              </div>
              {active && <Sparkles className="w-4 h-4 text-green-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* 免提模式开关 */}
      <div className="flex items-center justify-between px-1 py-2 mb-3">
        <div>
          <div className="text-[14px] text-neutral-100">免提模式</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">按一次开始录音，再按一次提交；松开不结束</div>
        </div>
        <ToggleSwitch
          checked={service.handsFree}
          onChange={(v) => setServiceConfig({ handsFree: v })}
        />
      </div>

      <p className="text-[11px] text-neutral-600 px-1 leading-relaxed mt-auto">
        提示：AI 整理需要配置 LLM 服务，前往服务配置页面设置 API Key。
      </p>
    </div>
  );
}
