"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { categoriesApi, locationsApi, productsApi, reportsApi } from "@/lib/api/endpoints";
import { formatEtb } from "@/lib/format";

const reports = [
  { id: "current-stock", label: "Current stock", group: "Inventory" },
  { id: "inventory-by-region", label: "By region", group: "Inventory" },
  { id: "inventory-by-product", label: "By product", group: "Inventory" },
  { id: "inventory-by-model", label: "By model", group: "Inventory" },
  { id: "inventory-by-serial", label: "By serial", group: "Inventory" },
  { id: "stock-in", label: "Stock in", group: "Movements" },
  { id: "stock-out", label: "Stock out", group: "Movements" },
  { id: "stock-movements", label: "Movement ledger", group: "Movements" },
  { id: "sales", label: "Sales / profit", group: "Sales" },
  { id: "sales-revenue", label: "Sales revenue", group: "Financial" },
  { id: "profit", label: "Profit", group: "Financial" },
  { id: "purchase-cost", label: "Purchase cost", group: "Financial" },
  { id: "transfers", label: "Transfers", group: "Transfers" },
  { id: "pending-receipts", label: "Pending receipts", group: "Transfers" },
  { id: "received-transfers", label: "Received transfers", group: "Transfers" },
];

function flatten(row: unknown): Record<string, string> {
  if (!row || typeof row !== "object") return { value: String(row) };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (["passwordHash", "tokenHash", "receivingToken"].includes(k)) continue;
    if (v === null || v === undefined) out[k] = "";
    else if (Array.isArray(v)) out[k] = String(v.length);
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      out[k] = String(o.name ?? o.itemName ?? o.serialNumber ?? o.code ?? o.email ?? "");
    } else out[k] = String(v);
  }
  return out;
}

function downloadCsv(kind: string, rows: Record<string, string>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join(
    "\n",
  );
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${kind}.csv`;
  a.click();
}

export default function ReportsPage() {
  const [kind, setKind] = useState("current-stock");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [year, setYear] = useState("");
  const [fsNumber, setFsNumber] = useState("");
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [serialNumber, setSerial] = useState("");
  const [raw, setRaw] = useState<unknown[] | null>(null);
  const [totals, setTotals] = useState<Record<string, unknown> | undefined>();
  const [loading, setLoading] = useState(false);

  const locs = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });
  const products = useQuery({ queryKey: ["products-all"], queryFn: () => productsApi.list({ limit: 100 }) });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });

  const rows = useMemo(() => (raw ?? []).map(flatten), [raw]);
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 8) : [];
  const selected = reports.find((r) => r.id === kind);

  const filters = {
    from,
    to,
    year: year || undefined,
    fsNumber: fsNumber || undefined,
    locationId,
    productId,
    categoryId,
    status,
    serialNumber,
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Live NestJS reporting APIs. Monetary values are ETB. PDF export is not provided by the backend."
      />
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Report</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.group} — {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Stock year</Label>
          <Input
            type="number"
            placeholder="e.g. 2018"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div>
          <Label>FS number</Label>
          <Input
            placeholder="Fiscal / voucher…"
            value={fsNumber}
            onChange={(e) => setFsNumber(e.target.value)}
          />
        </div>
        <div>
          <Label>Location</Label>
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All locations</option>
            {locs.data?.data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Product</Label>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {products.data?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.itemName} {p.model}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {cats.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>
            {["IN_STOCK", "SOLD", "DISPATCHED", "AWAITING_RECEIPT", "RECEIVED", "IN_MAINTENANCE", "DAMAGED", "LOST"].map(
              (s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ),
            )}
          </Select>
        </div>
        <div>
          <Label>Serial number</Label>
          <Input value={serialNumber} onChange={(e) => setSerial(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const res = await reportsApi.fetch(kind, filters);
              setRaw(res.rows ?? []);
              setTotals(res.totals);
            } catch {
              toast.error("Could not generate report");
            } finally {
              setLoading(false);
            }
          }}
        >
          Generate report
        </Button>
        {kind === "current-stock" ? (
          <>
            <Button variant="secondary" onClick={() => reportsApi.exportStock("csv")}>
              Download CSV
            </Button>
            <Button variant="secondary" onClick={() => reportsApi.exportStock("xlsx")}>
              Download Excel
            </Button>
          </>
        ) : (
          <Button variant="secondary" disabled={!rows.length} onClick={() => downloadCsv(kind, rows)}>
            Download CSV
          </Button>
        )}
      </div>

      {raw ? (
        <div className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Preview</p>
          <h2 className="display mt-1 text-2xl">{selected?.label}</h2>
          {from || to ? (
            <p className="mt-1 text-sm text-ink-soft">
              {from || "…"} — {to || "…"}
            </p>
          ) : null}
          {totals ? (
            <p className="mt-3 text-sm">
              {Object.entries(totals)
                .map(([k, v]) => {
                  const money = typeof v === "string" && /^\d/.test(v);
                  return `${k}: ${money ? formatEtb(v) : String(v)}`;
                })
                .join(" · ")}
            </p>
          ) : null}
          {!rows.length ? (
            <EmptyState className="mt-6" title="No rows" body="This report returned no matching records." />
          ) : (
            <div className="mt-5">
              <TableWrap minWidth="640px">
                <THead>
                  <tr>
                    {keys.map((k) => (
                      <Th key={k}>{k}</Th>
                    ))}
                  </tr>
                </THead>
                <tbody>
                  {rows.slice(0, 80).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {keys.map((k) => (
                        <Td key={k}>{r[k]}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {rows.length > 80 ? (
                <p className="mt-3 text-xs text-ink-soft">Showing first 80 of {rows.length} rows. Download CSV for the full set.</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
