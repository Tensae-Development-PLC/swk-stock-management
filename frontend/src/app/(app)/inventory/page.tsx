"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, TableWrap, Td, Th, THead } from "@/components/ui/table";
import { inventoryApi, locationsApi, reportsApi } from "@/lib/api/endpoints";
import { formatDate, formatEtb } from "@/lib/format";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const statuses = [
  "",
  "IN_STOCK",
  "SOLD",
  "DISPATCHED",
  "AWAITING_RECEIPT",
  "RECEIVED",
  "IN_MAINTENANCE",
  "DAMAGED",
  "LOST",
];

type View = "serials" | "opening";

function InventoryInner() {
  const params = useSearchParams();
  const [view, setView] = useState<View>("opening");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [locationId, setLocationId] = useState("");
  const [stockYear, setStockYear] = useState("2018");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const locs = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });

  const serials = useQuery({
    queryKey: ["inventory", debounced, status, locationId, page],
    queryFn: () =>
      inventoryApi.list({ search: debounced, status, locationId, page, limit: 20, sortBy: "createdAt" }),
    enabled: view === "serials",
  });

  const balances = useQuery({
    queryKey: ["inventory-balances", debounced, locationId, stockYear, page],
    queryFn: () =>
      inventoryApi.balances({
        search: debounced,
        locationId,
        stockYear: stockYear || undefined,
        page,
        limit: 20,
      }),
    enabled: view === "opening",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Inventory"
        description="Serialized units (scanned) and opening stock from Excel (quantity, no serial)."
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await reportsApi.exportStock("xlsx");
                toast.success("Export started");
              } catch {
                toast.error("Export failed.");
              }
            }}
          >
            Export current stock
          </Button>
        }
      />

      <div className="mb-4 flex max-w-md rounded-md border border-line bg-surface p-1">
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded text-sm font-medium",
            view === "opening" ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
          )}
          onClick={() => {
            setView("opening");
            setPage(1);
          }}
        >
          Opening stock (Excel)
        </button>
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded text-sm font-medium",
            view === "serials" ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
          )}
          onClick={() => {
            setView("serials");
            setPage(1);
          }}
        >
          Scanned serials
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder={view === "serials" ? "Serial, product, model…" : "Product, model, BC…"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        {view === "serials" ? (
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs">
            {statuses.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All statuses"}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            type="number"
            placeholder="Year"
            value={stockYear}
            onChange={(e) => {
              setStockYear(e.target.value);
              setPage(1);
            }}
            className="max-w-[120px]"
          />
        )}
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="max-w-xs">
          <option value="">All locations</option>
          {locs.data?.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      {view === "opening" ? (
        balances.isLoading ? (
          <TableSkeleton />
        ) : !balances.data?.data.length ? (
          <EmptyState
            title="No opening stock rows"
            body="Excel opening balances appear here after import. Quantity only — no serial numbers."
          />
        ) : (
          <>
            <TableWrap minWidth="860px">
              <THead>
                <tr>
                  <Th>BC</Th>
                  <Th>Product</Th>
                  <Th>Model</Th>
                  <Th>Year</Th>
                  <Th>Qty</Th>
                  <Th>Location</Th>
                  <Th>Remark</Th>
                </tr>
              </THead>
              <tbody>
                {balances.data.data.map((b) => (
                  <tr key={b.id} className="border-t border-line hover:bg-surface-2/60">
                    <Td className="font-mono">{b.product?.bcNumber}</Td>
                    <Td>
                      <Link href={`/products/${b.product?.id}`} className="hover:text-accent">
                        {b.product?.itemName}
                      </Link>
                    </Td>
                    <Td>{b.product?.model}</Td>
                    <Td>{b.stockYear}</Td>
                    <Td className="font-medium">{b.quantity}</Td>
                    <Td>{b.location?.name}</Td>
                    <Td className="max-w-[200px] truncate text-ink-muted">
                      {b.product?.catalogRemark ?? "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination
              page={page}
              totalPages={balances.data?.meta?.totalPages ?? 1}
              onPage={setPage}
            />
          </>
        )
      ) : serials.isLoading ? (
        <TableSkeleton />
      ) : !serials.data?.data.length ? (
        <EmptyState
          title="No scanned serials yet"
          body="Units appear here after Stock In with barcode scan. Excel opening stock is under the Opening stock tab."
          action={{ label: "Go to Stock In", onClick: () => (window.location.href = "/stock-in") }}
        />
      ) : (
        <>
          <TableWrap minWidth="860px">
            <THead>
              <tr>
                <Th>Serial</Th>
                <Th>Product</Th>
                <Th>Cost</Th>
                <Th>Location</Th>
                <Th>Status</Th>
                <Th>Purchased</Th>
              </tr>
            </THead>
            <tbody>
              {serials.data.data.map((u) => (
                <tr key={u.id} className="border-t border-line hover:bg-surface-2/60">
                  <Td className="font-mono">
                    <Link href={`/inventory/${u.id}`} className="hover:text-accent">
                      {u.serialNumber}
                    </Link>
                  </Td>
                  <Td>
                    {u.product?.itemName} {u.product?.model}
                  </Td>
                  <Td>{formatEtb(u.purchasePrice)}</Td>
                  <Td>{u.currentLocation?.name}</Td>
                  <Td>
                    <StatusBadge value={u.status} />
                  </Td>
                  <Td>{formatDate(u.purchaseDate)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} totalPages={serials.data?.meta?.totalPages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <InventoryInner />
    </Suspense>
  );
}
