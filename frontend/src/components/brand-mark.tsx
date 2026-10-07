import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="display text-[1.25rem] font-semibold leading-none tracking-[-0.04em] text-ink">
        SWK
      </span>
      {!compact ? (
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          HVACR
        </span>
      ) : null}
    </span>
  );
}
