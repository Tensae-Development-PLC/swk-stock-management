import { cn } from "@/lib/utils";

export function Stepper({
  step,
  steps,
}: {
  step: number;
  steps: string[];
}) {
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium",
              active && "border-accent bg-[var(--accent-soft)] text-accent",
              done && "border-line text-ink",
              !active && !done && "border-line text-ink-muted",
            )}
          >
            <span className="font-mono text-[11px]">{String(n).padStart(2, "0")}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
