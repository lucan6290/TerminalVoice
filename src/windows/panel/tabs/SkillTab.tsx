import { ArrowLeft, Wand2, FileText, Sparkles, List, Type, Languages, ListChecks, Presentation } from "lucide-react";
import { cn } from "../../../lib/cn";
import { useT } from "../../../lib/i18n";
import { usePanelStore } from "../../../stores/appStore";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { TextProcessMode } from "../../../lib/types";

const MODES: { key: TextProcessMode; icon: typeof Wand2 }[] = [
  { key: "off",       icon: Type },
  { key: "proofread", icon: FileText },
  { key: "polish",    icon: Wand2 },
  { key: "structure", icon: List },
];

const MODE_LABEL_KEYS: Record<TextProcessMode, string> = {
  off: "tab.skill.mode.off",
  proofread: "tab.skill.mode.proofread",
  polish: "tab.skill.mode.polish",
  structure: "tab.skill.mode.structure",
};

const MODE_DESC_KEYS: Record<TextProcessMode, string> = {
  off: "tab.skill.mode.offDesc",
  proofread: "tab.skill.mode.proofreadDesc",
  polish: "tab.skill.mode.polishDesc",
  structure: "tab.skill.mode.structureDesc",
};

export function SkillTab() {
  const t = useT();
  const service = usePanelStore((s) => s.service);
  const setServiceConfig = usePanelStore((s) => s.setServiceConfig);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const skills = usePanelStore((s) => s.skills);
  const activeSkillId = usePanelStore((s) => s.activeSkillId);
  const setActiveSkillId = usePanelStore((s) => s.setActiveSkillId);

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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">{t("tab.skill.title")}</h2>
      </div>

      {/* AI 整理模式 */}
      <p className="text-[12px] text-neutral-500 mb-2 px-1">{t("tab.skill.modeSectionTitle")}</p>
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
                  {t(MODE_LABEL_KEYS[m.key])}
                </div>
                <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">{t(MODE_DESC_KEYS[m.key])}</div>
              </div>
              {active && <Sparkles className="w-4 h-4 text-green-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* 语音输入技能 */}
      <p className="text-[12px] text-neutral-500 mb-2 px-1 mt-2">{t("tab.skill.templateSectionTitle")}</p>
      <div className="space-y-2 mb-4">
        {skills.map((skill) => {
          const active = activeSkillId === skill.id;
          const Icon = skill.id === 'english' ? Languages : skill.id === 'list' ? ListChecks : skill.id === 'report' ? Presentation : FileText;
          return (
            <button
              key={skill.id}
              onClick={() => setActiveSkillId(active ? null : skill.id)}
              className={cn(
                "w-full bg-neutral-800 rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                active ? "ring-1 ring-blue-500/40 bg-blue-500/5" : "hover:bg-neutral-800/80"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                active ? "bg-blue-500/20 text-blue-400" : "bg-neutral-700/60 text-neutral-400"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-[13px] font-medium", active ? "text-blue-400" : "text-neutral-100")}>
                  {skill.name}
                </div>
                <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">{skill.description}</div>
              </div>
              {active && <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* 免提模式开关 */}
      <div className="flex items-center justify-between px-1 py-2 mb-3">
        <div>
          <div className="text-[14px] text-neutral-100">{t("tab.skill.handsFree")}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">{t("tab.skill.handsFreeDesc")}</div>
        </div>
        <ToggleSwitch
          checked={service.handsFree}
          onChange={(v) => setServiceConfig({ handsFree: v })}
        />
      </div>

      <p className="text-[11px] text-neutral-600 px-1 leading-relaxed mt-auto">
        {t("tab.skill.hint")}
      </p>
    </div>
  );
}
