import { useSyncExternalStore } from "react";

export type ToastLevel = "info" | "warn" | "error" | "success";

export interface ToastItem {
  id: number;
  level: ToastLevel;
  message: string;
  duration: number;
}

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return toasts;
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function _remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message: string, level: ToastLevel = "info", duration = 3000) {
  const id = nextId++;
  const toast: ToastItem = { id, level, message, duration };
  toasts = [...toasts, toast];
  emit();
  if (duration > 0) {
    setTimeout(() => _remove(id), duration);
  }
  return id;
}

export function dismissToast(id: number) {
  _remove(id);
}
