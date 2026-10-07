"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  CircleDollarSign,
  Package,
  Plus,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { dashboardApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime, formatEtb } from "@/lib/format";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d" | "1y";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => dashboardApi.summary(period),
    refetchInterval: 30_000,
  });

  const chartData = useMemo(() => data?.movementSeries ?? [], [data]);
  const hasMovement = chartData.some((d) => d.stockIn > 0 || d.stockOut > 0);

  if (isLoading) return <TableSkeleton rows={10} />;
  if (isError || !data) {
    return (
      <EmptyState
        title="Dashboard unavailable"
        body="Could not load live inventory metrics from the API."
      />
    );
  }

  const kpis = [
    {
      label: "Total inventory value",
      value: formatEtb(data.availableStockValue),
      hint: "Purchase cost of available inventory",
      icon: CircleDollarSign,
    },
    {
      label: "Available stock",
      value: String(data.availableStock),
      hint: `${data.totalSerializedUnits} serialized units total`,
      icon: Boxes,
    },
    {
      label: "Sales revenue",
      value: formatEtb(data.salesRevenue),
      hint: `Profit ${formatEtb(data.estimatedProfit)}`,
      icon: Wallet,
    },
    {
      label: "In transit",
      value: String(data.dispatchedUnits),
      hint: "Dispatched, not yet received",
      icon: Truck,
    },
    {
      label: "Pending receipts",
      value: String(data.pendingReceipts),
      hint: `${data.receivedTransfers} received transfers`,
      icon: ArrowRightLeft,
    },
    {
      label: "Sold units",
      value: String(data.soldUnits),
      hint: `${data.totalProducts} active products`,
      icon: Package,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Inventory Command Center"
        description="Monitor SWK inventory, movements, sales and regional operations."
        actions={
          <>
            <div className="flex rounded-md border border-line bg-surface p-0.5">
              {(["7d", "30d", "90d", "1y"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-8 rounded px-2.5 text-xs font-medium",
                    period === p ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
            <Link
              href="/stock-in"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Stock In
            </Link>
            <Link
              href="/stock-out"
              className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2"
            >
              Stock Out
            </Link>
            <Link
              href="/stock-out/transfer"
              className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2"
            >
              New Transfer
            </Link>
          </>
        }
      />

      <section className="grid gap-3 lg:grid-cols-12">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={cn("panel p-5", i === 0 ? "lg:col-span-4" : "lg:col-span-2")}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-medium text-ink-muted">{k.label}</p>
                <Icon className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
              </div>
              <p className={cn("metric-value mt-3 text-ink", i === 0 ? "text-3xl" : "text-2xl")}>
                {k.value}
              </p>
              <p className="mt-2 text-xs text-ink-muted">{k.hint}</p>
            </div>
          );
        })}
      </section>

      {(data.pendingReceipts > 0 || data.failedVerifications > 0 || data.maintenanceUnits > 0) && (
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-sm font-semibold">Attention required</h2>
          </div>
          <div className="grid divide-y divide-[var(--line)] md:grid-cols-3 md:divide-x md:divide-y-0">
            <AttentionItem
              href="/transfers?status=AWAITING_RECEIPT"
              icon={ArrowRightLeft}
              tone="warn"
              title={`${data.pendingReceipts} transfers awaiting receipt`}
              body="Receiver confirmation still pending"
            />
            <AttentionItem
              href="/audit-logs"
              icon={AlertTriangle}
              tone="danger"
              title={`${data.failedVerifications} failed serial verifications`}
              body="Mismatch attempts logged by receivers"
            />
            <AttentionItem
              href="/inventory?status=IN_MAINTENANCE"
              icon={Wrench}
              tone="info"
              title={`${data.maintenanceUnits} items in maintenance`}
              body="Units currently marked for service"
            />
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="panel p-5">
          <div className="mb-4">
            <h2 className="display text-lg font-semibold">Inventory movement</h2>
            <p className="text-xs text-ink-muted">Stock in vs stock out for selected period</p>
          </div>
          {hasMovement ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1b5f51" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#1b5f51" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9a6416" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#9a6416" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => String(v).slice(5)}
                    stroke="var(--ink-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--ink-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="stockIn"
                    name="Stock In"
                    stroke="#1b5f51"
                    fill="url(#inFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="stockOut"
                    name="Stock Out"
                    stroke="#9a6416"
                    fill="url(#outFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              className="min-h-72 border-0 bg-transparent"
              title="No inventory data yet"
              body="Inventory analytics will appear here after stock is received."
              action={{ label: "Receive stock", onClick: () => (window.location.href = "/stock-in") }}
            />
          )}
        </div>

        <div className="panel p-5">
          <h2 className="display text-lg font-semibold">Inventory by location</h2>
          <p className="mb-4 text-xs text-ink-muted">Available units and purchase-cost stock value</p>
          {data.stockByRegion.length ? (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.stockByRegion} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid stroke="var(--line)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--ink-muted)" />
                    <YAxis
                      type="category"
                      dataKey="code"
                      width={64}
                      fontSize={11}
                      stroke="var(--ink-muted)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="available" name="Units" fill="#1b5f51" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
                {data.stockByRegion.map((r) => (
                  <li key={r.locationId} className="flex justify-between gap-3">
                    <span>{r.name}</span>
                    <span>
                      {r.available} units · {formatEtb(r.stockValue)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-16 text-center text-sm text-ink-muted">No location stock yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="panel p-5">
          <h2 className="display text-lg font-semibold">Inventory by category</h2>
          <p className="mb-4 text-xs text-ink-muted">Available units by product category</p>
          {data.stockByCategory.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stockByCategory}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="code" fontSize={11} stroke="var(--ink-muted)" tickLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} stroke="var(--ink-muted)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="units" fill="#2f5f8a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-ink-muted">No category inventory yet.</p>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="display text-lg font-semibold">Financial summary</h2>
          <p className="mb-4 text-xs text-ink-muted">Purchase cost is never mixed with selling price</p>
          <dl className="space-y-3 text-sm">
            <FinRow label="Available stock value" value={formatEtb(data.availableStockValue)} />
            <FinRow label="Owned inventory cost" value={formatEtb(data.stockValue)} />
            <FinRow label="Sales purchase cost" value={formatEtb(data.salesPurchaseCost)} />
            <FinRow label="Sales revenue" value={formatEtb(data.salesRevenue)} />
            <FinRow label="Estimated profit" value={formatEtb(data.estimatedProfit)} emphasize />
          </dl>
        </div>

        <div className="panel p-5">
          <h2 className="display text-lg font-semibold">Top products</h2>
          <p className="mb-4 text-xs text-ink-muted">Highest available quantity</p>
          {data.topProducts.length ? (
            <ul className="space-y-3">
              {data.topProducts.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/products/${p.productId}`} className="font-medium hover:text-accent">
                      {p.itemName} {p.model}
                    </Link>
                    <p className="text-xs text-ink-muted">BC {p.bcNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="metric-value text-base">{p.units}</p>
                    <p className="text-xs text-ink-muted">{formatEtb(p.stockValue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center text-sm text-ink-muted">No product stock yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-5">
          <h2 className="display text-lg font-semibold">Recent activity</h2>
          {data.recentStockMovements.length ? (
            <ol className="mt-4 space-y-4">
              {data.recentStockMovements.map((m) => (
                <li key={m.id} className="border-l border-line pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={m.movementType} />
                    <span className="font-mono text-xs">{m.inventoryUnit?.serialNumber}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {m.product?.itemName} {m.product?.model}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {m.destinationLocation?.name || m.sourceLocation?.name || m.referenceNumber}
                    {" · "}
                    {formatDateTime(m.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-6 text-sm text-ink-muted">No stock movements recorded yet.</p>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="display text-lg font-semibold">Recent inventory</h2>
              <p className="text-xs text-ink-muted">Latest unit updates across locations</p>
            </div>
            <Link href="/inventory" className="text-xs font-medium text-accent">
              View all
            </Link>
          </div>
          {data.recentInventory.length ? (
            <TableWrap minWidth="640px">
              <THead>
                <tr>
                  <Th>Serial</Th>
                  <Th>Product</Th>
                  <Th>Location</Th>
                  <Th>Status</Th>
                  <Th>Cost</Th>
                  <Th>Last movement</Th>
                </tr>
              </THead>
              <tbody>
                {data.recentInventory.map((u) => (
                  <tr key={u.id} className="border-t border-line hover:bg-surface-2/60">
                    <Td className="font-mono">
                      <Link href={`/inventory/${u.id}`} className="hover:text-accent">
                        {u.serialNumber}
                      </Link>
                    </Td>
                    <Td>
                      {u.product?.itemName} {u.product?.model}
                    </Td>
                    <Td>{u.currentLocation?.name}</Td>
                    <Td>
                      <StatusBadge value={u.status} />
                    </Td>
                    <Td>{formatEtb(u.purchasePrice)}</Td>
                    <Td className="text-ink-muted">
                      {u.lastMovement
                        ? `${u.lastMovement.movementType.replaceAll("_", " ")} · ${formatDate(u.lastMovement.createdAt)}`
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No inventory units"
              body="Serialized units will appear here after stock-in."
              action={{ label: "Receive stock", onClick: () => (window.location.href = "/stock-in") }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function AttentionItem({
  href,
  icon: Icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: "warn" | "danger" | "info";
}) {
  const toneClass =
    tone === "warn" ? "text-[var(--warn)]" : tone === "danger" ? "text-danger" : "text-info";
  return (
    <Link href={href} className="flex gap-3 px-5 py-4 transition-colors hover:bg-surface-2/70">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{body}</span>
      </span>
    </Link>
  );
}

function FinRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("metric-value", emphasize ? "text-base text-accent" : "text-sm")}>{value}</dd>
    </div>
  );
}
