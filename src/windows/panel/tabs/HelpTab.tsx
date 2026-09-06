import { ArrowLeft, Keyboard, Mic, Wand2, Settings, Info, Github } from "lucide-react";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import { formatKeyLabel } from "../../../components/ui/HotkeyRecorder";
import { useT } from "../../../lib/i18n";

export function HelpTab() {
  const t = useT();
  const pttKey = usePanelStore((s) => s.pttKey);
  const ttsKey = usePanelStore((s) => s.ttsKey);
  const translateKey = usePanelStore((s) => s.translateKey);
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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">{t("tab.help.title")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4 pb-2 allow-select">
        {/* 版本信息 */}
        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-[18px] font-semibold text-neutral-100 tracking-tight mb-1">
            TerminalVoice
          </div>
          <div className="text-[11px] text-neutral-500">{t("tab.help.subtitle")}</div>
        </div>

        {/* 快捷键 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" /> {t("tab.help.section.shortcuts")}
          </p>
          <div className="bg-neutral-800 rounded-xl divide-y divide-white/5">
            <ShortcutRow keys={[formatKeyLabel(pttKey)]} desc={t("tab.help.shortcut.ptt")} />
            <ShortcutRow keys={[formatKeyLabel(pttKey), t("tab.help.shortcut.handsFreeKey")]} desc={t("tab.help.shortcut.handsFree")} />
            <ShortcutRow keys={["Alt", formatKeyLabel(ttsKey)]} desc={t("tab.help.shortcut.tts")} />
            <ShortcutRow keys={["Alt", formatKeyLabel(translateKey)]} desc={t("tab.help.shortcut.translate")} />
            <ShortcutRow keys={["Esc"]} desc={t("tab.help.shortcut.esc")} />
            <ShortcutRow keys={["Ctrl", "Enter"]} desc={t("tab.help.shortcut.ctrlEnter")} />
          </div>
        </section>

        {/* 使用指南 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> {t("tab.help.section.guide")}
          </p>
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2.5 text-[12px] text-neutral-300 leading-relaxed">
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">1.</span>
              <span>{t("tab.help.guide.step1")}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">2.</span>
              <span>{t("tab.help.guide.step2")}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">3.</span>
              <span>{t("tab.help.guide.step3")}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">4.</span>
              <span>{t("tab.help.guide.step4")}</span>
            </div>
          </div>
        </section>

        {/* AI 整理说明 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> {t("tab.help.section.modes")}
          </p>
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2 text-[12px] text-neutral-300 leading-relaxed">
            <div>{t("tab.help.mode.off")}</div>
            <div>{t("tab.help.mode.proofread")}</div>
            <div>{t("tab.help.mode.polish")}</div>
            <div>{t("tab.help.mode.structure")}</div>
          </div>
        </section>

        {/* 链接 */}
        <div className="flex gap-2">
          <LinkBtn icon={Settings} label={t("tab.help.link.service")} onClick={() => setActiveTab("service")} />
          <LinkBtn icon={Github} label={t("tab.help.link.github")} onClick={() => showToast(t("tab.help.openingGithub"), "info")} />
          <LinkBtn icon={Info} label={t("tab.help.link.feedback")} onClick={() => showToast(t("tab.help.thanksFeedback"), "info")} />
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
