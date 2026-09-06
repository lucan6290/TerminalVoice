import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";

export interface SettingRowProps {
  label: string;
  helpIcon?: boolean;
  helpTip?: string;
  childrenLeft?: ReactNode;
  childrenRight?: ReactNode;
  className?: string;
}

/**
 * 设置面板统一配置行。
 * 三段布局：左侧标签（shrink-0）+ 中间主体（flex-1）+ 右侧控件（shrink-0）。
 */
export function SettingRow({
  label,
  helpIcon = false,
  helpTip,
  childrenLeft,
  childrenRight,
  className,
}: SettingRowProps) {
  const t = useT();
  return (
    <div
      className={cn(
        "bg-neutral-800 rounded-xl px-4 py-3 mb-3 flex items-center gap-3",
        className
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[14px] text-neutral-100 leading-none whitespace-nowrap">
          {label}
        </span>
        {helpIcon && (
          <span
            aria-label={helpTip ?? t("settingRow.helpAria", { label })}
            data-tip={helpTip}
            className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-neutral-500 cursor-help shrink-0"
          >
            <Info className="w-[13px] h-[13px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">{childrenLeft}</div>
      <div className="shrink-0">{childrenRight}</div>
    </div>
  );
}
