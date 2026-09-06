import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

/**
 * 单个按键录入按钮：点击后进入"等待按键"状态，下一个按下的按键会被捕获，
 * 调用 onConfirm 回传；Esc 取消。不捕获修饰键本身（Ctrl/Shift/Alt/Win）作为 PTT 键，
 * 但允许把它们作为 TTS/翻译等修饰键的主键（其实 TTS/翻译默认走 Alt+X 范式，这里只采集主键）。
 */

type KeyName = string; // 传给后端 parse_hotkey 的字符串

interface HotkeyRecorderProps {
  /** 当前按键名（如 "RightAlt"、"1"） */
  value: KeyName;
  /** 用户按下新键时调用；返回 Promise 用于显示 loading */
  onChange: (next: KeyName) => void | Promise<void>;
  /** 显示在按键旁的标签 */
  label?: string;
  /** 额外样式 */
  className?: string;
  /** 占位宽度（tailwind w-*） */
  widthClass?: string;
}

/** 将浏览器 KeyboardEvent 转成我们的按键名字符串。
 *  浏览器端无法完美区分左右修饰键（rdev 层面能分），这里给用户一个通用名，
 *  后端会做大小写无关解析；如果需要区分左右，用户可以直接在设置行里手动改文本。
 */
function eventToKeyName(e: KeyboardEvent): KeyName | null {
  const code = e.code;
  // 映射浏览器 code 到后端 parse_hotkey 可识别的字符串
  if (code === "AltRight") return "RightAlt";
  if (code === "AltLeft") return "LeftAlt";
  if (code === "ControlRight") return "RightCtrl";
  if (code === "ControlLeft") return "LeftCtrl";
  if (code === "ShiftRight") return "RightShift";
  if (code === "ShiftLeft") return "LeftShift";
  if (code === "Space") return "Space";
  if (code === "Enter") return "Enter";
  if (code === "Tab") return "Tab";
  if (code === "Escape") return "Esc";
  if (code === "Backspace") return "Backspace";
  // 数字键
  if (/^Digit([0-9])$/.test(code)) return code.replace("Digit", "");
  // 字母
  if (/^Key([A-Z])$/.test(code)) return code.replace("Key", "");
  // F 键
  if (/^F([0-9]{1,2})$/.test(code)) return code;
  return null;
}

/** 把后端存的 KeyName 转成 UI 显示文本（如 RightAlt → Right-Alt） */
export function formatKeyLabel(key: KeyName): string {
  switch (key) {
    case "RightAlt":
    case "AltGr":
      return "Right-Alt";
    case "LeftAlt":
    case "Alt":
      return "Alt";
    case "RightCtrl":
      return "Right-Ctrl";
    case "LeftCtrl":
    case "Ctrl":
      return "Ctrl";
    case "RightShift":
      return "Right-Shift";
    case "LeftShift":
    case "Shift":
      return "Shift";
    default:
      return key;
  }
}

export function HotkeyRecorder({
  value,
  onChange,
  className,
  widthClass = "min-w-[100px]",
}: HotkeyRecorderProps) {
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Esc 在录制模式下作为"取消"，而不是设为 Esc 键
      if (e.key === "Escape" || e.code === "Escape") {
        setCapturing(false);
        return;
      }
      const next = eventToKeyName(e);
      if (!next) return; // 不认识的键忽略
      setCapturing(false);
      setSaving(true);
      Promise.resolve()
        .then(() => onChange(next))
        .finally(() => setSaving(false));
    };
    window.addEventListener("keydown", handler, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // 失焦/点击其他位置也取消录制
    const blurHandler = () => setCapturing(false);
    window.addEventListener("blur", blurHandler);
    return () => {
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("blur", blurHandler);
      document.body.style.overflow = prevOverflow;
    };
  }, [capturing, onChange]);

  const display = capturing ? "按下按键..." : formatKeyLabel(value);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => {
        if (saving) return;
        setCapturing((c) => !c);
      }}
      className={cn(
        widthClass,
        "rounded-lg px-3 py-1.5 font-mono text-[13px] tracking-wider text-center select-none transition-colors",
        capturing
          ? "bg-green-500/15 text-green-300 border border-green-500/40 animate-pulse"
          : "bg-neutral-900 text-neutral-100 border border-white/5 hover:border-white/20",
        className,
      )}
      title={capturing ? "按下要设置的键，按 Esc 取消" : "点击修改按键"}
    >
      {saving ? "保存中..." : display}
    </button>
  );
}
