import {
  BadgeCheck,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

export function paymentStatusIcon(status?: string): LucideIcon {
  if (!status) return CircleDashed;
  if (status === "CREATED" || status === "PAYER_ACTION_REQUIRED") return Clock;
  if (status === "APPROVED") return BadgeCheck;
  if (status === "COMPLETED") return CircleCheck;
  if (status === "VOIDED" || status === "CANCELLED" || status === "CANCELED") return CircleX;
  return CircleDashed;
}

export function PaymentStatusIcon({
  status,
  className = "size-4 shrink-0",
}: {
  status?: string;
  className?: string;
}) {
  const Icon = paymentStatusIcon(status);
  return <Icon className={className} aria-hidden />;
}

export function RefundStatusIcon({ className = "size-4 shrink-0" }: { className?: string }) {
  return <RotateCcw className={className} aria-hidden />;
}
