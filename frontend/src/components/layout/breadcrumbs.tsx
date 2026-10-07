"use client";

import Link from "next/link";
import { pageMeta } from "@/lib/nav";

export function Breadcrumbs({ pathname }: { pathname: string }) {
  const { crumbs } = pageMeta(pathname);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-2 text-[12px] text-ink-soft">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {i === crumbs.length - 1 ? (
              <span className="truncate text-ink">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate hover:text-ink">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
