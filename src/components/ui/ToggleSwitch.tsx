import { cn } from "../../lib/cn";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * Toggle 开关
 * 固定 50×30，绿色开启 / 灰色关闭，knob 26px
 */
export function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
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
        "relative shrink-0 inline-flex items-center h-[30px] w-[50px] rounded-full transition-colors duration-200 ease-out cursor-pointer",
        "focus:outline-none",
        checked ? "bg-green-500" : "bg-neutral-600"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-[2px] left-[2px] h-[26px] w-[26px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-[20px]" : "translate-x-0"
        )}
      />
    </button>
  );
}
