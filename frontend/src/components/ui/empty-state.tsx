import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void; href?: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-start justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-line bg-surface px-6 py-8",
        className,
      )}
    >
      <h3 className="display text-lg font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-ink-muted">{body}</p>
      {action ? (
        <Button className="mt-2" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-md bg-surface-2" />
      ))}
    </div>
  );
}
