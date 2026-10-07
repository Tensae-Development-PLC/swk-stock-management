"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { TableWrap, Td, Th, THead, Pagination } from "@/components/ui/table";
import { stockInApi } from "@/lib/api/endpoints";
import { formatDate, formatEtb } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export default function StockInHistoryPage() {
  const [search, setSearch] = useState("");
  const [fsNumber, setFsNumber] = useState("");
  const [stockYear, setStockYear] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const debouncedFs = useDebouncedValue(fsNumber);
  const query = useQuery({
    queryKey: ["stock-in", debounced, debouncedFs, stockYear, page],
    queryFn: () =>
      stockInApi.list({
        search: debounced,
        fsNumber: debouncedFs || undefined,
        stockYear: stockYear || undefined,
        page,
        limit: 20,
      }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock In history"
        description="Batches filtered by FS number and stock year."
        actions={
          <Link
            href="/stock-in"
            className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            New stock in
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Reference, product, serial…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Input
          placeholder="FS number…"
          value={fsNumber}
          onChange={(e) => {
            setFsNumber(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
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
      </div>
      {query.isLoading ? (
        <TableSkeleton />
      ) : !query.data?.data.length ? (
        <EmptyState title="No stock-in batches" body="Completed stock-in batches will appear here." />
      ) : (
        <TableWrap minWidth="960px">
          <THead>
            <tr>
              <Th>Reference</Th>
              <Th>FS</Th>
              <Th>Year</Th>
              <Th>Product</Th>
              <Th>Qty</Th>
              <Th>Cost</Th>
              <Th>Location</Th>
              <Th>Remark</Th>
              <Th>Date</Th>
            </tr>
          </THead>
          <tbody>
            {(query.data.data as Array<Record<string, unknown>>).map((b) => {
              const product = b.product as { itemName?: string; model?: string } | undefined;
              const location = b.location as { name?: string } | undefined;
              return (
                <tr key={String(b.id)} className="border-t border-line">
                  <Td className="font-mono">{String(b.referenceNumber)}</Td>
                  <Td className="font-mono">{String(b.fsNumber ?? "—")}</Td>
                  <Td>{String(b.stockYear ?? "—")}</Td>
                  <Td>
                    {product?.itemName} {product?.model}
                  </Td>
                  <Td>{String(b.quantity)}</Td>
                  <Td>{formatEtb(b.totalCost as string)}</Td>
                  <Td>{location?.name}</Td>
                  <Td className="max-w-[160px] truncate">{String(b.remark ?? "—")}</Td>
                  <Td>{formatDate(b.purchaseDate as string)}</Td>
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
