/**
 * 判断当前是否运行在 Tauri 运行时中
 *
 * 通过检测 window.__TAURI_INTERNALS__ 是否存在来判断。
 * 浏览器开发预览模式下返回 false，所有 invoke / listen 调用应据此降级。
 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
