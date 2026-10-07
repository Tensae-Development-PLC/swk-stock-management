"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/empty-state";
import { inventoryApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime, formatEtb } from "@/lib/format";

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-unit", id],
    queryFn: () => inventoryApi.one(id),
  });
  if (isLoading || !data) return <TableSkeleton />;

  return (
    <div>
      <PageHeader
        title={data.product?.itemName ?? "Unit"}
        description={`${data.product?.model} · Serial ${data.serialNumber}`}
      />
      <div className="flex flex-wrap items-center gap-4">
        <StatusBadge value={data.status} />
        <span>{data.currentLocation?.name}</span>
        <span className="text-ink-soft">{formatEtb(data.purchasePrice)}</span>
        <span className="text-ink-soft">Purchased {formatDate(data.purchaseDate)}</span>
      </div>
      <h2 className="display mt-10 text-2xl">Movement history</h2>
      <ol className="mt-4 space-y-5">
        {data.movements?.map((m) => (
          <li key={m.id} className="border-l border-line pl-4">
            <StatusBadge value={m.movementType} />
            <p className="mt-1 text-sm">{m.referenceNumber}</p>
            <p className="text-xs text-ink-soft">
              {formatDateTime(m.createdAt)}
              {m.sourceLocation ? ` · from ${m.sourceLocation.name}` : ""}
              {m.destinationLocation ? ` · to ${m.destinationLocation.name}` : ""}
            </p>
            {m.notes ? <p className="text-sm text-ink-soft">{m.notes}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
