"use client";

import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50",
        size === "sm" && "h-8 rounded-md px-3 text-xs",
        size === "md" && "h-9 rounded-md px-3.5 text-sm",
        size === "lg" && "h-11 rounded-md px-5 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-[var(--accent-hover)]",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "outline" && "border border-line bg-transparent text-ink hover:bg-surface",
        variant === "ghost" && "text-ink-muted hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
