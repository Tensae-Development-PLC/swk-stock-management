"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, TableWrap, Td, Th, THead } from "@/components/ui/table";
import { categoriesApi, productsApi } from "@/lib/api/endpoints";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Product } from "@/types/api";

function availableCount(p: Product) {
  if (typeof p.availableUnits === "number") return p.availableUnits;
  // Fallback when API has not been restarted with availability fields yet
  return p._count?.inventoryUnits ?? 0;
}

function totalCount(p: Product) {
  if (typeof p.totalUnits === "number") return p.totalUnits;
  return p._count?.inventoryUnits;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out">("all");
  const debounced = useDebouncedValue(search);
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const query = useQuery({
    queryKey: ["products", debounced, categoryId, page],
    queryFn: () =>
      productsApi.list({ search: debounced, categoryId, page, limit: 20, sortBy: "createdAt" }),
  });

  const rows = (query.data?.data ?? []).filter((p) => {
    const available = availableCount(p);
    if (stockFilter === "in") return available > 0;
    if (stockFilter === "out") return available <= 0;
    return true;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Products"
        description="Catalog from SWK Excel + live stock (opening balances and serialized units)."
        actions={
          <div className="flex gap-2">
            <Link
              href="/stock-in/history"
              className="inline-flex h-9 items-center rounded-md border border-line px-3.5 text-sm font-medium hover:bg-surface-2"
            >
              Stock In history
            </Link>
            <Link
              href="/stock-in"
              className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Stock In
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search name, model…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        >
          <option value="">All categories</option>
          {cats.data?.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as "all" | "in" | "out")}
          className="max-w-xs"
        >
          <option value="all">All stock states</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </Select>
      </div>
      {query.isLoading ? (
        <TableSkeleton />
      ) : !rows.length ? (
        <EmptyState
          title="No products found"
          body="Products appear here after they are created during Stock In."
          action={{ label: "Go to Stock In", onClick: () => (window.location.href = "/stock-in") }}
        />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <Th>Item</Th>
              <Th>Model</Th>
              <Th>Category</Th>
              <Th>Unit</Th>
              <Th>Serialized</Th>
              <Th>Available</Th>
              <Th>Status</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((p) => {
              const available = availableCount(p);
              const total = totalCount(p);
              const stockStatus = available > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
              return (
                <tr key={p.id} className="border-t border-line transition-colors hover:bg-surface-2/70">
                  <Td>
                    <Link href={`/products/${p.id}`} className="font-medium hover:text-accent">
                      {p.itemName}
                    </Link>
                  </Td>
                  <Td>{p.model}</Td>
                  <Td>{p.category?.name}</Td>
                  <Td>{p.unit}</Td>
                  <Td>{p.isSerialized ? "Yes" : "No"}</Td>
                  <Td>
                    {available}
                    {typeof total === "number" && total !== available ? (
                      <span className="text-ink-muted"> / {total}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusBadge value={stockStatus} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
      <Pagination page={page} totalPages={query.data?.meta?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}
