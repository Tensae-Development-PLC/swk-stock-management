"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { DualStageChips, TransferInspect } from "@/components/transfers/transfer-inspect";
import { transfersApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

function TransfersInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [fsNumber, setFsNumber] = useState("");
  const [stockYear, setStockYear] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedFs = useDebouncedValue(fsNumber);

  const query = useQuery({
    queryKey: ["transfers", status, debouncedFs, stockYear],
    queryFn: () =>
      transfersApi.list({
        status,
        fsNumber: debouncedFs || undefined,
        stockYear: stockYear || undefined,
        limit: 50,
      }),
  });

  const detail = useQuery({
    queryKey: ["transfer", selectedId],
    queryFn: () => transfersApi.one(selectedId!),
    enabled: !!selectedId,
  });

  const tabs = ["", "AWAITING_RECEIPT", "RECEIVED", "CANCELLED", "EXPIRED"];
  const selectedRow = query.data?.data.find((t) => t.id === selectedId);

  return (
    <div>
      <PageHeader
        title="Transfers"
        description="Click a row for receive / maintenance details, GPS, and shareable links."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="FS number…"
          value={fsNumber}
          onChange={(e) => setFsNumber(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="number"
          placeholder="Year"
          value={stockYear}
          onChange={(e) => setStockYear(e.target.value)}
          className="max-w-[120px]"
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t || "all"}
            type="button"
            onClick={() => setStatus(t)}
            className={`border px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${status === t ? "border-accent text-accent" : "border-line"}`}
          >
            {t || "All"}
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <TableSkeleton />
      ) : !query.data?.data.length ? (
        <EmptyState
          title="No transfers found"
          body="No inventory transfers match your current filters."
        />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-paper-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">FS</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Product / serial</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Receiver</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Dispatched</th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((t) => {
                const item = t.items?.[0];
                const active = selectedId === t.id;
                return (
                  <tr
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(t.id);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-t border-line transition-colors hover:bg-paper-2/70",
                      active && "bg-[var(--accent-soft)]/50",
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{t.referenceNumber}</td>
                    <td className="px-4 py-3 font-mono">{t.fsNumber ?? "—"}</td>
                    <td className="px-4 py-3">{t.stockYear ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{item?.expectedSerialNumber ?? "—"}</span>
                      {item?.product ? (
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {item.product.itemName} · {item.product.model}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{t.sourceLocation?.name}</td>
                    <td className="px-4 py-3">{t.destinationLocation?.name}</td>
                    <td className="px-4 py-3">
                      {t.receiverName && t.receiverName !== "Awaiting receiver"
                        ? t.receiverName
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <DualStageChips transfer={t} />
                    </td>
                    <td className="px-4 py-3">{formatDate(t.dispatchDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={selectedRow?.referenceNumber ?? detail.data?.referenceNumber ?? "Transfer"}
        subtitle={
          selectedRow || detail.data
            ? `${(selectedRow ?? detail.data)?.sourceLocation?.name ?? "—"} → ${(selectedRow ?? detail.data)?.destinationLocation?.name ?? "—"}`
            : undefined
        }
      >
        {detail.isLoading ? (
          <TableSkeleton />
        ) : detail.isError ? (
          <p className="text-sm text-danger">Could not load transfer details.</p>
        ) : detail.data ? (
          <TransferInspect transfer={detail.data} compact showCancel showFullPageLink />
        ) : null}
      </SlideOver>
    </div>
  );
}

export default function TransfersPage() {
  return (
    <Suspense>
      <TransfersInner />
    </Suspense>
  );
}
