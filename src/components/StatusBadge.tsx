import type { AppStatus } from "../lib/types";

interface StatusBadgeProps {
  status: AppStatus;
}

const labels: Record<AppStatus, string> = {
  Idle: "空闲",
  Recording: "录音中",
  Recognizing: "识别中",
  Preview: "预览中",
  Paused: "已暂停",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span aria-label="应用状态" style={{ border: "1px solid #ddd", borderRadius: 999, padding: "4px 10px" }}>
      {labels[status]}
    </span>
  );
}
