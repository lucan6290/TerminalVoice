import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Cloud,
  Cpu,
  Zap,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Loader2,
  Wifi,
  Globe,
  Link,
  ChevronDown,
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { useT } from "../../../lib/i18n";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import {
  testAsrConnection,
  testLlmConnection,
  fetchAsrModels,
  fetchLlmModels,
  type FetchedModel,
} from "../../../lib/commands";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { ASRProvider } from "../../../lib/types";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// label/desc 存 i18n key，渲染时用组件内 t() 取文案
const ASR_OPTIONS: { key: ASRProvider; label: string; desc: string; icon: typeof Cloud }[] = [
  { key: "auto",    label: "tab.service.asr.auto",    desc: "tab.service.asr.autoDesc",    icon: Zap },
  { key: "cloud",   label: "tab.service.asr.cloud",   desc: "tab.service.asr.cloudDesc",   icon: Cloud },
  { key: "offline", label: "tab.service.asr.offline", desc: "tab.service.asr.offlineDesc", icon: Cpu },
];

type ModelFieldProps = {
  label?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onFetch: () => Promise<FetchedModel[]>;
};

function ModelField({ label = "Model", value, placeholder, onChange, onFetch }: ModelFieldProps) {
  const t = useT();
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function handleFetch() {
    setLoading(true);
    try {
      const result = await onFetch();
      setModels(result);
      if (result.length === 0) {
        showToast(t("tab.service.modelList.unavailable"), "warn");
      } else {
        showToast(t("tab.service.modelList.count", { n: result.length }), "success");
        setOpen(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg || t("tab.service.modelList.fail"), "error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = models.filter((m) =>
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    (m.ownedBy || "").toLowerCase().includes(search.toLowerCase()),
  );

  const grouped: Record<string, FetchedModel[]> = {};
  for (const m of filtered) {
    const vendor = m.ownedBy || "Other";
    if (!grouped[vendor]) grouped[vendor] = [];
    grouped[vendor].push(m);
  }
  const vendors = Object.keys(grouped).sort();

  return (
    <Field label={label}>
      <div ref={wrapRef} className="relative flex gap-1.5 w-full min-w-0">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (models.length > 0) setOpen(true); }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-neutral-900 dark:bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 dark:text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
        />
        {loading ? (
          <button
            type="button"
            disabled
            className="shrink-0 w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFetch}
            title={t("tab.service.modelList.fetchBtn")}
            className="shrink-0 w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-green-400 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        {models.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            title={t("tab.service.modelList.selectBtn")}
            className={cn(
              "shrink-0 w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center transition-colors",
              open ? "text-green-400 bg-neutral-700" : "text-neutral-400 hover:text-green-400 hover:bg-neutral-700",
            )}
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}

        {open && models.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            <div className="p-1.5 border-b border-white/5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("tab.service.modelList.searchPlaceholder")}
                autoFocus
                className="w-full bg-neutral-900 rounded px-2 py-1 text-[11px] text-neutral-200 placeholder:text-neutral-600 outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1 text-[11px]">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-neutral-500">{t("tab.service.modelList.noMatch")}</div>
              ) : (
                vendors.map((vendor) => (
                  <div key={vendor}>
                    <div className="px-3 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 font-medium">
                      {vendor}
                    </div>
                    {grouped[vendor].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onChange(m.id);
                          setOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 transition-colors",
                          m.id === value
                            ? "bg-green-500/10 text-green-400"
                            : "text-neutral-200 hover:bg-white/5",
                        )}
                      >
                        {m.id}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

export function ServiceTab() {
  const t = useT();
  const service = usePanelStore((s) => s.service);
  const setServiceConfig = usePanelStore((s) => s.setServiceConfig);
  const models = usePanelStore((s) => s.models);
  const downloadingModels = usePanelStore((s) => s.downloadingModels);
  const downloadModel = usePanelStore((s) => s.downloadModel);
  const deleteModel = usePanelStore((s) => s.deleteModel);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);

  const [showAsrKey, setShowAsrKey] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [testingAsr, setTestingAsr] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);

  async function handleTestAsr() {
    setTestingAsr(true);
    try {
      const ok = await testAsrConnection();
      showToast(ok ? t("tab.service.testSuccess.asr") : t("tab.service.testFail.asr"), ok ? "success" : "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("tab.service.testFail.generic"), "error");
    } finally {
      setTestingAsr(false);
    }
  }

  async function handleTestLlm() {
    setTestingLlm(true);
    try {
      const ok = await testLlmConnection();
      showToast(ok ? t("tab.service.testSuccess.llm") : t("tab.service.testFail.llm"), ok ? "success" : "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("tab.service.testFail.generic"), "error");
    } finally {
      setTestingLlm(false);
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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">{t("tab.service.title")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4 pb-2">
        {/* ASR 服务商 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">{t("tab.service.asr.section")}</p>
          <div className="space-y-2 mb-3">
            {ASR_OPTIONS.map((o) => {
              const active = service.asrProvider === o.key;
              const Icon = o.icon;
              return (
                <button
                  key={o.key}
                  onClick={() => setServiceConfig({ asrProvider: o.key })}
                  className={cn(
                    "w-full bg-neutral-800 rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                    active && "ring-1 ring-green-500/40 bg-green-500/5"
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
                      {t(o.label)}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{t(o.desc)}</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-green-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* ASR 配置 */}
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2.5">
            {/* 完整 URL 开关 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                <span className="text-[12px] text-neutral-700 dark:text-neutral-200">{t("tab.service.fullUrl")}</span>
              </div>
              <ToggleSwitch
                size="sm"
                checked={service.asrFullUrl}
                onChange={(checked) => setServiceConfig({ asrFullUrl: checked })}
              />
            </div>

            <Field label="API URL">
              <input
                type="text"
                value={service.asrEndpoint}
                onChange={(e) => setServiceConfig({ asrEndpoint: e.target.value })}
                placeholder={service.asrFullUrl ? "https://example.com/v1/your/custom/path" : "https://api.openai.com/v1"}
                className="w-full bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
              />
            </Field>

            {service.asrFullUrl && (
              <p className="text-[11px] text-amber-500 dark:text-amber-400/90 leading-snug px-0.5">
                {t("tab.service.fullUrl.hint")}
              </p>
            )}
            {!service.asrFullUrl && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-500 px-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {t("tab.service.endpointHint.asr")}
              </p>
            )}

            <ModelField
              value={service.asrModel}
              placeholder="whisper-1"
              onChange={(v) => setServiceConfig({ asrModel: v })}
              onFetch={fetchAsrModels}
            />
            <Field label="API Key">
              <div className="relative">
                <input
                  type={showAsrKey ? "text" : "password"}
                  value={service.asrApiKey}
                  onChange={(e) => setServiceConfig({ asrApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-neutral-900 rounded-lg pl-3 pr-9 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
                />
                <button
                  onClick={() => setShowAsrKey(!showAsrKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showAsrKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </Field>
            <button
              onClick={() => void handleTestAsr()}
              disabled={testingAsr}
              className="w-full mt-1 h-8 rounded-lg bg-green-500/15 text-green-400 text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-green-500/25 transition-colors disabled:opacity-50"
            >
              {testingAsr ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("tab.service.testing")}</>
              ) : (
                <><Wifi className="w-3.5 h-3.5" /> {t("tab.service.testBtn.asr")}</>
              )}
            </button>
          </div>
        </section>

        {/* LLM 配置 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">{t("tab.service.llm.section")}</p>
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2.5">
            {/* 完整 URL 开关 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                <span className="text-[12px] text-neutral-700 dark:text-neutral-200">{t("tab.service.fullUrl")}</span>
              </div>
              <ToggleSwitch
                size="sm"
                checked={service.llmFullUrl}
                onChange={(checked) => setServiceConfig({ llmFullUrl: checked })}
              />
            </div>

            <Field label="API URL">
              <input
                type="text"
                value={service.llmEndpoint}
                onChange={(e) => setServiceConfig({ llmEndpoint: e.target.value })}
                placeholder={service.llmFullUrl ? "https://example.com/v1/your/custom/path" : "https://api.openai.com/v1"}
                className="w-full bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-purple-500/40"
              />
            </Field>

            {service.llmFullUrl && (
              <p className="text-[11px] text-amber-500 dark:text-amber-400/90 leading-snug px-0.5">
                {t("tab.service.fullUrl.hint")}
              </p>
            )}
            {!service.llmFullUrl && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-500 px-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {t("tab.service.endpointHint.llm")}
              </p>
            )}

            <ModelField
              value={service.llmModel}
              placeholder="gpt-4o-mini"
              onChange={(v) => setServiceConfig({ llmModel: v })}
              onFetch={fetchLlmModels}
            />
            <Field label="API Key">
              <div className="relative">
                <input
                  type={showLlmKey ? "text" : "password"}
                  value={service.llmApiKey}
                  onChange={(e) => setServiceConfig({ llmApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-neutral-900 rounded-lg pl-3 pr-9 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
                />
                <button
                  onClick={() => setShowLlmKey(!showLlmKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showLlmKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </Field>
            <button
              onClick={() => void handleTestLlm()}
              disabled={testingLlm}
              className="w-full mt-1 h-8 rounded-lg bg-purple-500/15 text-purple-400 text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
            >
              {testingLlm ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("tab.service.testing")}</>
              ) : (
                <><Wifi className="w-3.5 h-3.5" /> {t("tab.service.testBtn.llm")}</>
              )}
            </button>
          </div>
        </section>

        {/* 翻译目标语言 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">{t("tab.service.translate.section")}</p>
          <div className="bg-neutral-800 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
              <select
                value={service.translateTargetLang}
                onChange={(e) => setServiceConfig({ translateTargetLang: e.target.value })}
                className="flex-1 bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 outline-none border border-white/5 focus:border-green-500/40 cursor-pointer"
              >
                <option value="英文">{t("tab.service.translate.lang.en")}</option>
                <option value="中文">{t("tab.service.translate.lang.zh")}</option>
                <option value="日文">{t("tab.service.translate.lang.ja")}</option>
                <option value="韩文">{t("tab.service.translate.lang.ko")}</option>
                <option value="法文">{t("tab.service.translate.lang.fr")}</option>
                <option value="德文">{t("tab.service.translate.lang.de")}</option>
                <option value="西班牙文">{t("tab.service.translate.lang.es")}</option>
                <option value="俄文">{t("tab.service.translate.lang.ru")}</option>
              </select>
            </div>
            <p className="text-[11px] text-neutral-600 mt-2">{t("tab.service.translate.hint")}</p>
          </div>
        </section>

        {/* 离线模型管理 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">{t("tab.service.offline.section")}</p>
          <div className="space-y-2">
            {models.length === 0 ? (
              <div className="text-center text-neutral-500 text-[12px] py-6">{t("tab.service.offline.empty")}</div>
            ) : models.map((m) => {
              const isDownloading = downloadingModels.includes(m.id);
              return (
                <div key={m.id} className="bg-neutral-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-neutral-100 flex items-center gap-2">
                        {m.name}
                        {m.installed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{t("tab.service.offline.installed")}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {formatSize(m.sizeBytes)}
                      </div>
                    </div>
                    {m.installed ? (
                      <button
                        onClick={() => void deleteModel(m.id).then(() => showToast(t("tab.service.offline.deleted", { name: m.name }), "info"))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-white/5"
                        data-tip={t("tab.service.offline.deleteBtn")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : isDownloading ? (
                      <div className="flex items-center gap-1.5 text-green-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-[11px]">{t("tab.service.offline.downloading")}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => void downloadModel(m.id).then(() => showToast(t("tab.service.offline.downloadStarted", { name: m.name }), "info"))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-500/10"
                        data-tip={t("tab.service.offline.downloadBtn")}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-[12px] text-neutral-400 shrink-0 w-[72px]">{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
