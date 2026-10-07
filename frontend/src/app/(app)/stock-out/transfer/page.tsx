"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StockUnitPicker, type PickMode } from "@/components/stock/stock-unit-picker";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { inventoryApi, locationsApi, transfersApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/client";
import type { Transfer } from "@/types/api";

export default function TransferCreatePage() {
  const [mode, setMode] = useState<PickMode>("select");
  const [productId, setProductId] = useState("");
  const [serials, setSerials] = useState<string[]>([]);
  const [sourceLocationId, setSource] = useState("");
  const [destinationLocationId, setDest] = useState("");
  const [reasonId, setReason] = useState("");
  const [dispatchDate, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stockYear, setStockYear] = useState(new Date().getFullYear());
  const [fsNumber, setFsNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [created, setCreated] = useState<Transfer | null>(null);
  const locs = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });
  const reasons = useQuery({ queryKey: ["reasons"], queryFn: transfersApi.reasons });

  const add = async (value: string) => {
    try {
      const u = await inventoryApi.bySerial(value);
      if (u.status !== "IN_STOCK" && u.status !== "RECEIVED") {
        toast.error("This unit is not available for transfer");
        return;
      }
      if (serials.includes(u.serialNumber)) return;
      setSerials((s) => [...s, u.serialNumber]);
      if (!sourceLocationId) setSource(u.currentLocationId);
      if (!productId) setProductId(u.productId);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Serial not found");
    }
  };

  const toggle = (serial: string) => {
    if (serials.includes(serial)) {
      setSerials((s) => s.filter((x) => x !== serial));
      return;
    }
    void add(serial);
  };

  if (created) {
    const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const receiveUrl =
      created.receivingUrl ||
      `${app}/receive/${created.receivingToken}`;
    const maintUrl =
      created.maintenanceUrl ||
      (created.maintenanceToken ? `${app}/maintain/${created.maintenanceToken}` : null);
    return (
      <div className="max-w-2xl space-y-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-warn">Awaiting receipt</p>
          <h1 className="display mt-2 text-4xl">Transfer created</h1>
          <p className="mt-2 font-mono">{created.referenceNumber}</p>
          <p className="mt-4 text-sm">{created.destinationLocation?.name}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Receive link</p>
            <div className="mt-3 border border-line bg-white p-4">
              <QRCodeSVG value={receiveUrl} size={140} />
            </div>
            <p className="mt-3 break-all text-xs text-ink-soft">{receiveUrl}</p>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(receiveUrl);
                toast.success("Receive link copied");
              }}
            >
              Copy receive link
            </Button>
          </div>
          {maintUrl ? (
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                Maintenance link
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Unlocks after receive. Share both links now.
              </p>
              <div className="mt-3 border border-line bg-white p-4">
                <QRCodeSVG value={maintUrl} size={140} />
              </div>
              <p className="mt-3 break-all text-xs text-ink-soft">{maintUrl}</p>
              <Button
                className="mt-2"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(maintUrl);
                  toast.success("Maintenance link copied");
                }}
              >
                Copy maintenance link
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">
          You can reopen these links later under Transfers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader
        title="Regional transfer"
        description="Select a product or scan barcodes. The receiver enters their name and phone on the receive link."
      />
      <StockUnitPicker
        mode={mode}
        onModeChange={setMode}
        productId={productId}
        onProductChange={(id) => {
          setProductId(id);
          setSerials([]);
        }}
        selectedSerials={serials}
        onToggleSerial={toggle}
        onScanSerial={(s) => void add(s)}
        multi
        preferSerialized
      />
      {serials.length ? (
        <ul className="font-mono text-sm">
          {serials.map((s) => (
            <li key={s} className="flex items-center justify-between border-b border-line py-1">
              <span>{s}</span>
              <button type="button" className="text-danger" onClick={() => setSerials((p) => p.filter((x) => x !== s))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <Label>Source</Label>
        <Select value={sourceLocationId} onChange={(e) => setSource(e.target.value)}>
          <option value="">Select</option>
          {locs.data?.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Destination</Label>
        <Select value={destinationLocationId} onChange={(e) => setDest(e.target.value)}>
          <option value="">Select</option>
          {locs.data?.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Reason</Label>
        <Select value={reasonId} onChange={(e) => setReason(e.target.value)}>
          <option value="">Select</option>
          {reasons.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Stock year</Label>
          <Input
            type="number"
            min={2000}
            value={stockYear}
            onChange={(e) => setStockYear(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>FS number</Label>
          <Input
            value={fsNumber}
            onChange={(e) => setFsNumber(e.target.value)}
            placeholder="Fiscal / voucher number"
          />
        </div>
      </div>
      <div>
        <Label>Dispatch date</Label>
        <Input type="date" value={dispatchDate} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button
        disabled={
          !serials.length ||
          !destinationLocationId ||
          !reasonId ||
          !sourceLocationId ||
          !fsNumber.trim()
        }
        onClick={async () => {
          try {
            const t = await transfersApi.create({
              sourceLocationId,
              destinationLocationId,
              reasonId,
              stockYear,
              fsNumber: fsNumber.trim(),
              dispatchDate,
              notes,
              serialNumbers: serials,
            });
            toast.success("Transfer created");
            setCreated(t);
          } catch (e) {
            toast.error(e instanceof ApiRequestError ? e.message : "Transfer failed");
          }
        }}
      >
        Dispatch transfer
      </Button>
    </div>
  );
}
