import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../lib/utils';

/**
 * 监听 Tauri 事件的通用 React Hook
 *
 * - 自动在组件卸载时取消监听（cleanup）
 * - 使用 ref 保持最新 handler，避免 handler 变化导致重复订阅
 * - 浏览器开发模式下静默跳过（isTauriRuntime 返回 false）
 *
 * @param eventName 事件名称（建议使用 src/lib/events.ts 中的常量）
 * @param handler    事件回调，接收 event.payload
 * @param enabled    是否启用监听，默认 true
 */
export function useTauriEvent<T = unknown>(
  eventName: string,
  handler: (payload: T) => void,
  enabled: boolean = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;

    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen<T>(eventName, (event) => {
      if (!cancelled) {
        handlerRef.current(event.payload);
      }
    })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {
        // 浏览器开发模式下静默失败
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [eventName, enabled]);
}
