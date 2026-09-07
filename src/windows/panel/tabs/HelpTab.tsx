import { useState } from "react";
import { ArrowLeft, Keyboard, Mic, Wand2, Settings, Info, Github, X } from "lucide-react";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import { formatKeyLabel } from "../../../components/ui/HotkeyRecorder";
import { useT } from "../../../lib/i18n";
import { submitFeedback } from "../../../lib/commands";
import type { FeedbackInput, FeedbackType } from "../../../lib/types";
import { open } from "@tauri-apps/plugin-shell";

const FEEDBACK_TYPES: FeedbackType[] = ["bug", "feature", "experience", "other"];

export function HelpTab() {
  const t = useT();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pttKey = usePanelStore((s) => s.pttKey);
  const ttsKey = usePanelStore((s) => s.ttsKey);
  const translateKey = usePanelStore((s) => s.translateKey);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);

  const openGithub = () => {
    void open("https://github.com/lucan6290/TerminalVoice").catch(() => {
      showToast(t("tab.help.openingGithub"), "info");
    });
  };

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

      <div className="flex-1 overflow-y-auto overflow-x-hidden -mx-1 px-1 space-y-4 pb-2 allow-select">
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
          <LinkBtn icon={Github} label={t("tab.help.link.github")} onClick={openGithub} />
          <LinkBtn icon={Info} label={t("tab.help.link.feedback")} onClick={() => setFeedbackOpen(true)} />
        </div>
      </div>
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [form, setForm] = useState<FeedbackInput>({
    title: "",
    description: "",
    feedbackType: "bug",
    contact: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const validate = (): string | null => {
    const title = form.title.trim();
    const description = form.description.trim();
    if (title.length < 3 || title.length > 120) return t("tab.help.feedback.validationTitle");
    if (description.length < 10 || description.length > 5000) return t("tab.help.feedback.validationDescription");
    const unsafe = /<script|javascript:|data:text\/html/i;
    if (unsafe.test(title) || unsafe.test(description) || unsafe.test(form.contact)) {
      return t("tab.help.feedback.validationUnsafe");
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      showToast(validationError, "warn");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFeedback({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        contact: form.contact.trim(),
      });
      showToast(result.queued ? t("tab.help.feedback.queued") : t("tab.help.feedback.success"), result.queued ? "warn" : "success");
      onClose();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : String(submitError);
      setError(message);
      showToast(`${t("tab.help.feedback.failed")}: ${message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-[360px] bg-neutral-900 border border-white/10 rounded-2xl shadow-floating p-4 allow-select">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[15px] font-medium text-neutral-100 flex-1">{t("tab.help.feedback.title")}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-white/5 disabled:opacity-50"
            aria-label={t("tab.help.feedback.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-neutral-400">{t("tab.help.feedback.type")}</span>
            <select
              value={form.feedbackType}
              onChange={(event) => updateField("feedbackType", event.target.value as FeedbackType)}
              disabled={submitting}
              className="mt-1 w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-neutral-100 outline-none focus:border-green-500/60 disabled:opacity-60"
            >
              {FEEDBACK_TYPES.map((type) => (
                <option key={type} value={type}>{t(`tab.help.feedback.type.${type}`)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] text-neutral-400">{t("tab.help.feedback.issueTitle")}</span>
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              maxLength={120}
              disabled={submitting}
              placeholder={t("tab.help.feedback.issueTitlePlaceholder")}
              className="mt-1 w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-green-500/60 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-neutral-400">{t("tab.help.feedback.description")}</span>
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              maxLength={5000}
              rows={6}
              disabled={submitting}
              placeholder={t("tab.help.feedback.descriptionPlaceholder")}
              className="mt-1 w-full resize-none bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-green-500/60 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-neutral-400">{t("tab.help.feedback.contact")}</span>
            <input
              value={form.contact}
              onChange={(event) => updateField("contact", event.target.value)}
              maxLength={200}
              disabled={submitting}
              placeholder={t("tab.help.feedback.contactPlaceholder")}
              className="mt-1 w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-green-500/60 disabled:opacity-60"
            />
          </label>

          {error && <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-9 rounded-lg bg-green-500 text-neutral-950 text-[12px] font-medium hover:bg-green-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? t("tab.help.feedback.submitting") : t("tab.help.feedback.submit")}
          </button>
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
