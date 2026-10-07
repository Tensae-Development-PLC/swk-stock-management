"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { locationsApi, salesApi } from "@/lib/api/endpoints";
import { formatDate, formatEtb } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [fsNumber, setFsNumber] = useState("");
  const [stockYear, setStockYear] = useState("");
  const [locationId, setLocationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debounced = useDebouncedValue(search);
  const debouncedFs = useDebouncedValue(fsNumber);
  const locs = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });
  const query = useQuery({
    queryKey: ["sales", debounced, debouncedFs, stockYear],
    queryFn: () =>
      salesApi.list({
        search: debounced,
        fsNumber: debouncedFs || undefined,
        stockYear: stockYear || undefined,
        limit: 50,
      }),
  });
  const rows = (query.data?.data ?? []).filter((s) => {
    if (locationId && s.location?.id !== locationId) return false;
    if (from && s.saleDate.slice(0, 10) < from) return false;
    if (to && s.saleDate.slice(0, 10) > to) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Sales" description="Direct sales. Filter by FS number and stock year." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Reference or serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
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
        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="max-w-xs">
          <option value="">All locations</option>
          {locs.data?.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {query.isLoading ? (
        <TableSkeleton />
      ) : !rows.length ? (
        <EmptyState title="No sales yet" body="Completed direct sales will appear here." />
      ) : (
        <TableWrap minWidth="980px">
          <THead>
            <tr>
              <Th>Reference</Th>
              <Th>FS</Th>
              <Th>Year</Th>
              <Th>Serial</Th>
              <Th>Product</Th>
              <Th>Cost</Th>
              <Th>Selling</Th>
              <Th>Profit</Th>
              <Th>Date</Th>
            </tr>
          </THead>
          <tbody>
            {rows.flatMap((s) =>
              (s.items ?? []).map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <Td className="font-mono">{s.referenceNumber}</Td>
                  <Td className="font-mono">{s.fsNumber ?? "—"}</Td>
                  <Td>{s.stockYear ?? "—"}</Td>
                  <Td className="font-mono">{i.serialNumber}</Td>
                  <Td>
                    {i.product?.itemName} {i.product?.model}
                  </Td>
                  <Td>{formatEtb(i.purchasePrice)}</Td>
                  <Td>{formatEtb(i.sellingPrice)}</Td>
                  <Td>{formatEtb(i.profit)}</Td>
                  <Td>{formatDate(s.saleDate)}</Td>
                </tr>
              )),
            )}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
