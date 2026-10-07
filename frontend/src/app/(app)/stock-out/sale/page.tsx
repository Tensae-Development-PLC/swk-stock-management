"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StockUnitPicker, type PickMode } from "@/components/stock/stock-unit-picker";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { inventoryApi, locationsApi, salesApi } from "@/lib/api/endpoints";
import { formatEtb } from "@/lib/format";
import { ApiRequestError } from "@/lib/api/client";
import type { InventoryUnit } from "@/types/api";

export default function DirectSalePage() {
  const [mode, setMode] = useState<PickMode>("select");
  const [productId, setProductId] = useState("");
  const [serial, setSerial] = useState("");
  const [unit, setUnit] = useState<InventoryUnit | null>(null);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [stockYear, setStockYear] = useState(new Date().getFullYear());
  const [fsNumber, setFsNumber] = useState("");
  const [notes, setNotes] = useState("");
  const locs = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });
  const [locationId, setLocationId] = useState("");

  const profit = unit ? sellingPrice - Number(unit.purchasePrice) : 0;

  const load = async (value: string) => {
    try {
      const u = await inventoryApi.bySerial(value);
      if (u.status !== "IN_STOCK" && u.status !== "RECEIVED") {
        toast.error("This unit is not available for sale");
        return;
      }
      setUnit(u);
      setSerial(u.serialNumber);
      setLocationId(u.currentLocationId);
      setProductId(u.productId);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Serial not found");
    }
  };

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Direct sale"
        description="Select a product or scan a barcode. Purchase cost is preserved; profit is selling price minus cost."
      />
      <StockUnitPicker
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setUnit(null);
          setSerial("");
        }}
        productId={productId}
        onProductChange={(id) => {
          setProductId(id);
          setUnit(null);
          setSerial("");
        }}
        selectedSerials={serial ? [serial] : []}
        onToggleSerial={(s) => void load(s)}
        onScanSerial={(s) => void load(s)}
        preferSerialized
      />
      {unit ? (
        <div className="mt-8 space-y-4">
          <p className="font-mono text-lg">{unit.serialNumber}</p>
          <p>
            {unit.product?.itemName} {unit.product?.model} · {unit.currentLocation?.name}
          </p>
          <p className="text-sm text-ink-soft">Purchase cost {formatEtb(unit.purchasePrice)}</p>
          <div>
            <Label>Sale location</Label>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locs.data?.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Selling price (ETB)</Label>
            <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} />
          </div>
          <div>
            <Label>Sale date</Label>
            <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
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
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3 border border-line p-4 text-sm">
            <div>
              Cost
              <div className="display text-xl">{formatEtb(unit.purchasePrice)}</div>
            </div>
            <div>
              Selling
              <div className="display text-xl">{formatEtb(sellingPrice)}</div>
            </div>
            <div>
              Profit
              <div className="display text-xl">{formatEtb(profit)}</div>
            </div>
          </div>
          <Button
            disabled={!fsNumber.trim()}
            onClick={async () => {
              try {
                await salesApi.create({
                  locationId,
                  saleDate,
                  stockYear,
                  fsNumber: fsNumber.trim(),
                  notes,
                  items: [{ serialNumber: serial, sellingPrice }],
                });
                toast.success("Sale completed");
                setUnit(null);
                setSerial("");
              } catch (e) {
                toast.error(e instanceof ApiRequestError ? e.message : "Sale failed");
              }
            }}
          >
            Confirm sale
          </Button>
        </div>
      ) : null}
    </div>
  );
}
