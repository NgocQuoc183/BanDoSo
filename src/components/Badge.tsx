import type { ReactNode } from "react";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-accent-soft text-accent-dark",
  neutral: "bg-[#eef2f6] text-ink-500",
};

// Nhãn trạng thái dùng chung cho toàn hệ thống — trước đây mỗi nơi tự phối
// nền/chữ riêng cho "Bình thường"/"Cảnh báo"/"Ngừng hoạt động", nay gom về 1
// component để màu trạng thái nhất quán trên mọi bảng dữ liệu.
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
