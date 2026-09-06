import { useState } from "react";
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
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { usePanelStore } from "../../../stores/appStore";
import { showToast } from "../../../stores/toastStore";
import { testAsrConnection, testLlmConnection } from "../../../lib/commands";
import type { ASRProvider } from "../../../lib/types";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const ASR_OPTIONS: { key: ASRProvider; label: string; desc: string; icon: typeof Cloud }[] = [
  { key: "auto",    label: "智能切换",   desc: "优先云端，失败时自动降级离线",   icon: Zap },
  { key: "cloud",   label: "仅云端",     desc: "始终使用云端ASR，识别精度高",   icon: Cloud },
  { key: "offline", label: "仅离线",     desc: "使用本地模型，无需网络",         icon: Cpu },
];

export function ServiceTab() {
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
      showToast(ok ? "ASR 连接成功" : "ASR 连接失败，请检查配置", ok ? "success" : "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "连接测试失败", "error");
    } finally {
      setTestingAsr(false);
    }
  }

  async function handleTestLlm() {
    setTestingLlm(true);
    try {
      const ok = await testLlmConnection();
      showToast(ok ? "LLM 连接成功" : "LLM 连接失败，请检查配置", ok ? "success" : "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "连接测试失败", "error");
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
        <h2 className="text-[15px] font-medium text-neutral-100 flex-1">服务配置</h2>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4 pb-2">
        {/* ASR 服务商 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">语音识别 (ASR)</p>
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
                      {o.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{o.desc}</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-green-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* ASR 配置 */}
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2.5">
            <Field label="API Endpoint">
              <input
                type="text"
                value={service.asrEndpoint}
                onChange={(e) => setServiceConfig({ asrEndpoint: e.target.value })}
                placeholder="https://api.openai.com/v1/audio/transcriptions"
                className="w-full bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                value={service.asrModel}
                onChange={(e) => setServiceConfig({ asrModel: e.target.value })}
                placeholder="whisper-1"
                className="w-full bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
              />
            </Field>
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
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 测试中…</>
              ) : (
                <><Wifi className="w-3.5 h-3.5" /> 测试 ASR 连接</>
              )}
            </button>
          </div>
        </section>

        {/* LLM 配置 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">AI 整理 (LLM)</p>
          <div className="bg-neutral-800 rounded-xl p-3 space-y-2.5">
            <Field label="API Endpoint">
              <input
                type="text"
                value={service.llmEndpoint}
                onChange={(e) => setServiceConfig({ llmEndpoint: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
                className="w-full bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                value={service.llmModel}
                onChange={(e) => setServiceConfig({ llmModel: e.target.value })}
                placeholder="gpt-4o-mini"
                className="w-full bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none border border-white/5 focus:border-green-500/40"
              />
            </Field>
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
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 测试中…</>
              ) : (
                <><Wifi className="w-3.5 h-3.5" /> 测试 LLM 连接</>
              )}
            </button>
          </div>
        </section>

        {/* 翻译目标语言 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">翻译目标语言</p>
          <div className="bg-neutral-800 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
              <select
                value={service.translateTargetLang}
                onChange={(e) => setServiceConfig({ translateTargetLang: e.target.value })}
                className="flex-1 bg-neutral-900 rounded-lg px-3 py-1.5 text-[12px] text-neutral-100 outline-none border border-white/5 focus:border-green-500/40 cursor-pointer"
              >
                <option value="英文">英文</option>
                <option value="中文">中文</option>
                <option value="日文">日文</option>
                <option value="韩文">韩文</option>
                <option value="法文">法文</option>
                <option value="德文">德文</option>
                <option value="西班牙文">西班牙文</option>
                <option value="俄文">俄文</option>
              </select>
            </div>
            <p className="text-[11px] text-neutral-600 mt-2">Alt+2 翻译时的目标语言</p>
          </div>
        </section>

        {/* 离线模型管理 */}
        <section>
          <p className="text-[12px] text-neutral-500 mb-2 px-1">离线模型</p>
          <div className="space-y-2">
            {models.length === 0 ? (
              <div className="text-center text-neutral-500 text-[12px] py-6">暂无可用模型</div>
            ) : models.map((m) => {
              const isDownloading = downloadingModels.includes(m.id);
              return (
                <div key={m.id} className="bg-neutral-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-neutral-100 flex items-center gap-2">
                        {m.name}
                        {m.installed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">已安装</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {formatSize(m.sizeBytes)}
                      </div>
                    </div>
                    {m.installed ? (
                      <button
                        onClick={() => void deleteModel(m.id).then(() => showToast(`已删除 ${m.name}`, "info"))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-white/5"
                        data-tip="删除模型"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : isDownloading ? (
                      <div className="flex items-center gap-1.5 text-green-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-[11px]">下载中</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => void downloadModel(m.id).then(() => showToast(`开始下载 ${m.name}`, "info"))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-500/10"
                        data-tip="下载模型"
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
      <div className="flex-1">{children}</div>
    </div>
  );
}
