import { cn } from "@/lib/utils";
import { formatStatus } from "@/lib/format";

const tones: Record<string, string> = {
  IN_STOCK: "bg-[var(--success-soft)] text-[var(--success)]",
  OUT_OF_STOCK: "bg-surface-2 text-ink-muted",
  RECEIVED: "bg-[var(--success-soft)] text-[var(--success)]",
  COMPLETED: "bg-[var(--success-soft)] text-[var(--success)]",
  MATCH: "bg-[var(--success-soft)] text-[var(--success)]",
  SOLD: "bg-surface-2 text-ink-muted",
  DISPATCHED: "bg-[var(--warn-soft)] text-[var(--warn)]",
  AWAITING_RECEIPT: "bg-[var(--warn-soft)] text-[var(--warn)]",
  AWAITING_RECEIVE: "bg-[var(--warn-soft)] text-[var(--warn)]",
  PENDING_MAINTENANCE: "bg-[var(--warn-soft)] text-[var(--warn)]",
  MAINTENANCE_DONE: "bg-[var(--success-soft)] text-[var(--success)]",
  PENDING: "bg-[var(--warn-soft)] text-[var(--warn)]",
  DAMAGED: "bg-[var(--danger-soft)] text-danger",
  LOST: "bg-[var(--danger-soft)] text-danger",
  MISMATCH: "bg-[var(--danger-soft)] text-danger",
  CANCELLED: "bg-surface-2 text-ink-muted",
  EXPIRED: "bg-surface-2 text-ink-muted",
  IN_MAINTENANCE: "bg-[var(--info-soft)] text-info",
  ADMIN: "bg-[var(--accent-soft)] text-accent",
  SUPER_ADMIN: "bg-[var(--accent-soft)] text-accent",
  STOREKEEPER: "bg-surface-2 text-ink",
  STOCK_IN: "bg-[var(--success-soft)] text-[var(--success)]",
  SALE: "bg-[var(--info-soft)] text-info",
  TRANSFER_OUT: "bg-[var(--warn-soft)] text-[var(--warn)]",
  TRANSFER_IN: "bg-[var(--success-soft)] text-[var(--success)]",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium tracking-[0.02em]",
        tones[value] ?? "bg-surface-2 text-ink-muted",
      )}
    >
      {formatStatus(value)}
    </span>
  );
}
