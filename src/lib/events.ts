/**
 * Tauri 事件名称常量
 *
 * 所有 Rust → 前端的事件推送使用 kebab-case 命名。
 * 前端监听事件时必须使用此处的常量，禁止硬编码字符串。
 */

// ── 运行时状态事件 ──
export const EVENT_RUNTIME_STATE_CHANGED = 'runtime-state-changed';
export const EVENT_CONFIG_UPDATED = 'config-updated';
export const EVENT_TOAST = 'toast';
export const EVENT_PREVIEW_READY = 'preview-ready';
export const EVENT_PREVIEW_CLEARED = 'preview-cleared';

// ── 录音事件 ──
export const EVENT_RECORDING_STARTED = 'recording-started';
export const EVENT_RECORDING_STOPPED = 'recording-stopped';
export const EVENT_RECORDING_CANCELLED = 'recording-cancelled';
export const EVENT_RECORDING_TICK = 'recording-tick';

// ── TTS 事件 ──
export const EVENT_TTS_STARTED = 'tts-started';
export const EVENT_TTS_STOPPED = 'tts-stopped';

// ── 翻译事件 ──
export const EVENT_TRANSLATE_RESULT = 'translate-result';

// ── AI 改写事件 ──
export const EVENT_REWRITE_STARTED = 'rewrite-started';
export const EVENT_REWRITE_RESULT = 'rewrite-result';

// ── LLM 流式输出事件 ──
export const EVENT_LLM_STREAMING_DELTA = 'llm-streaming-delta';

/**
 * 所有 Tauri 事件名称的联合类型
 */
export type TauriEventName =
  | typeof EVENT_RUNTIME_STATE_CHANGED
  | typeof EVENT_CONFIG_UPDATED
  | typeof EVENT_TOAST
  | typeof EVENT_PREVIEW_READY
  | typeof EVENT_PREVIEW_CLEARED
  | typeof EVENT_RECORDING_STARTED
  | typeof EVENT_RECORDING_STOPPED
  | typeof EVENT_RECORDING_CANCELLED
  | typeof EVENT_RECORDING_TICK
  | typeof EVENT_TTS_STARTED
  | typeof EVENT_TTS_STOPPED
  | typeof EVENT_TRANSLATE_RESULT
  | typeof EVENT_REWRITE_STARTED
  | typeof EVENT_REWRITE_RESULT
  | typeof EVENT_LLM_STREAMING_DELTA;
