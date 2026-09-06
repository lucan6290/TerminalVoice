import { cn } from "../../lib/cn";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** 尺寸："md" 默认 40×22，"sm" 紧凑 34×18 */
  size?: "sm" | "md";
}

/**
 * Toggle 开关
 * md: 40×22, knob 18px；sm: 34×18, knob 14px
 * 绿色开启 / 灰色关闭
 */
export function ToggleSwitch({ checked, onChange, size = "md" }: ToggleSwitchProps) {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={cn(
        "relative shrink-0 inline-flex items-center rounded-full transition-colors duration-200 ease-out cursor-pointer",
        "focus:outline-none",
        isSm ? "h-[18px] w-[34px]" : "h-[22px] w-[40px]",
        checked ? "bg-green-500" : "bg-neutral-500"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          isSm
            ? "top-[2px] left-[2px] h-[14px] w-[14px]"
            : "top-[2px] left-[2px] h-[18px] w-[18px]",
          checked ? (isSm ? "translate-x-[16px]" : "translate-x-[18px]") : "translate-x-0"
        )}
      />
    </button>
  );
}
