"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/empty-state";
import { inventoryApi, productsApi } from "@/lib/api/endpoints";
import { formatDate, formatEtb } from "@/lib/format";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const product = useQuery({ queryKey: ["product", id], queryFn: () => productsApi.one(id) });
  const units = useQuery({
    queryKey: ["inventory", "product", id],
    queryFn: () => inventoryApi.list({ productId: id, limit: 100 }),
  });

  if (product.isLoading || !product.data) return <TableSkeleton />;
  const p = product.data;
  const list = units.data?.data ?? [];
  const byStatus = (s: string) => list.filter((u) => u.status === s).length;
  const value = list
    .filter((u) => u.status === "IN_STOCK" || u.status === "RECEIVED")
    .reduce((n, u) => n + Number(u.purchasePrice), 0);

  return (
    <div>
      <PageHeader title={`${p.itemName} ${p.model}`} description={p.category?.name} />
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-ink-soft">Brand</dt>
          <dd>{p.brand ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-ink-soft">Unit</dt>
          <dd>{p.unit}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-ink-soft">Serialized</dt>
          <dd>{p.isSerialized ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-5">
        {[
          ["Total", list.length],
          ["Available", byStatus("IN_STOCK") + byStatus("RECEIVED")],
          ["Sold", byStatus("SOLD")],
          ["Dispatched", byStatus("DISPATCHED")],
          ["Value", formatEtb(value)],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-paper p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">{k}</p>
            <p className="display mt-1 text-2xl">{v}</p>
          </div>
        ))}
      </div>
      <table className="mt-8 w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          <tr>
            <th className="py-2">Serial</th>
            <th>Status</th>
            <th>Location</th>
            <th>Cost</th>
            <th>Purchased</th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-3 font-mono">
                <Link href={`/inventory/${u.id}`} className="hover:text-accent">
                  {u.serialNumber}
                </Link>
              </td>
              <td>
                <StatusBadge value={u.status} />
              </td>
              <td>{u.currentLocation?.name}</td>
              <td>{formatEtb(u.purchasePrice)}</td>
              <td>{formatDate(u.purchaseDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
