"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { notificationsApi, transfersApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime } from "@/lib/format";

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const feed = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(12),
    refetchInterval: 30_000,
  });
  const pending = useQuery({
    queryKey: ["transfers", "AWAITING_RECEIPT", "notify"],
    queryFn: () => transfersApi.list({ status: "AWAITING_RECEIPT", limit: 4 }),
    refetchInterval: 30_000,
  });

  const unread = feed.data?.unreadCount ?? 0;
  const items = feed.data?.items ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid h-9 w-9 place-items-center rounded-md hover:bg-surface-2"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4 text-ink-muted" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-96 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-xs font-medium text-ink-muted">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs text-accent"
                onClick={async () => {
                  await notificationsApi.markAllRead();
                  await qc.invalidateQueries({ queryKey: ["notifications"] });
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length === 0 && !(pending.data?.data.length) ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 overflow-auto">
              {items.map((n) => {
                const href =
                  n.entity === "Transfer" && n.entityId
                    ? `/transfers/${n.entityId}`
                    : "/transfers";
                return (
                  <li key={n.id} className="border-b border-line last:border-0">
                    <Link
                      href={href}
                      className="block px-4 py-3 text-sm hover:bg-surface-2"
                      onClick={async () => {
                        setOpen(false);
                        if (!n.readAt) {
                          await notificationsApi.markRead(n.id);
                          await qc.invalidateQueries({ queryKey: ["notifications"] });
                        }
                      }}
                    >
                      <span className={`font-medium ${n.readAt ? "text-ink-muted" : ""}`}>
                        {n.title}
                      </span>
                      <span className="mt-1 block text-ink-muted">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-ink-soft">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {(pending.data?.data ?? []).map((t) => (
                <li key={`pending-${t.id}`} className="border-b border-line last:border-0">
                  <Link
                    href={`/transfers/${t.id}`}
                    className="block px-4 py-3 text-sm hover:bg-surface-2"
                    onClick={() => setOpen(false)}
                  >
                    <span className="font-mono text-xs">{t.referenceNumber}</span>
                    <span className="mt-1 block text-ink-muted">
                      Awaiting receipt · {t.destinationLocation?.name} ·{" "}
                      {formatDate(t.dispatchDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
