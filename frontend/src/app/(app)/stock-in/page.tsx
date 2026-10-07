"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Scanner } from "@/components/scanner/scanner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { categoriesApi, locationsApi, productsApi, stockInApi } from "@/lib/api/endpoints";
import { formatEtb } from "@/lib/format";
import { ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type ProductMode = "existing" | "new";

const emptyNewProduct = {
  itemName: "",
  model: "",
  unit: "PCS",
  brand: "",
  description: "",
  categoryId: "",
  isSerialized: true,
};

const currentYear = new Date().getFullYear();

export default function StockInPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<ProductMode>("existing");
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [newProduct, setNewProduct] = useState(emptyNewProduct);
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [totalCost, setTotalCost] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [stockYear, setStockYear] = useState(currentYear);
  const [fsNumber, setFsNumber] = useState("");
  const [remark, setRemark] = useState("");
  const [serials, setSerials] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const products = useQuery({
    queryKey: ["products-catalog", productSearch],
    queryFn: () => productsApi.catalog(productSearch),
  });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });

  const selected = products.data?.data.find((p) => p.id === productId);
  const productLabel =
    mode === "existing" && selected
      ? `${selected.itemName} / ${selected.model}`
      : mode === "new"
        ? `${newProduct.itemName || "New product"} / ${newProduct.model || "—"}`
        : "";

  const unitCost = quantity > 0 ? totalCost / quantity : 0;
  const remaining = Math.max(0, quantity - serials.length);

  const canContinueProduct =
    mode === "existing"
      ? !!productId
      : !!newProduct.itemName.trim() &&
        !!newProduct.model.trim() &&
        !!newProduct.unit.trim() &&
        !!newProduct.categoryId;

  const canContinueDetails =
    !!locationId && !!fsNumber.trim() && stockYear >= 2000 && quantity >= 1;

  const addSerial = (value: string) => {
    const s = value.trim().toUpperCase();
    if (!s) return;
    if (serials.includes(s)) {
      toast.error("Duplicate serial in this batch");
      return;
    }
    if (serials.length >= quantity) {
      toast.error("All required serials are already captured");
      return;
    }
    setSerials((prev) => [...prev, s]);
  };

  const review = useMemo(
    () => ({
      product: productLabel,
      quantity,
      totalCost,
      stockYear,
      fsNumber,
      remark,
      location: locations.data?.data.find((l) => l.id === locationId)?.name,
      serials,
    }),
    [
      productLabel,
      quantity,
      totalCost,
      stockYear,
      fsNumber,
      remark,
      locations.data,
      locationId,
      serials,
    ],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock In"
        description="Select a catalog product, enter year & FS number, then scan serials for new units."
      />
      <Stepper step={step} steps={["Product", "Details", "Serials", "Review"]} />

      {step === 1 ? (
        <div className="max-w-2xl space-y-5">
          <div className="flex rounded-md border border-line bg-surface p-1">
            <button
              type="button"
              className={cn(
                "h-9 flex-1 rounded text-sm font-medium",
                mode === "existing" ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
              )}
              onClick={() => setMode("existing")}
            >
              Select catalog product
            </button>
            <button
              type="button"
              className={cn(
                "h-9 flex-1 rounded text-sm font-medium",
                mode === "new" ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
              )}
              onClick={() => {
                setMode("new");
                setProductId("");
              }}
            >
              New product
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-3">
              <div>
                <Label>Search catalog</Label>
                <Input
                  placeholder="Search name, model, BC…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div>
                <Label>Product</Label>
                <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Select product</option>
                  {products.data?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.itemName} · {p.model}
                      {typeof p.availableUnits === "number" ? ` · avail ${p.availableUnits}` : ""}
                    </option>
                  ))}
                </Select>
                {selected?.catalogRemark ? (
                  <p className="mt-2 text-xs text-ink-muted">Catalog remark: {selected.catalogRemark}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="panel space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Item name</Label>
                  <Input
                    value={newProduct.itemName}
                    onChange={(e) => setNewProduct((p) => ({ ...p, itemName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={newProduct.model}
                    onChange={(e) => setNewProduct((p) => ({ ...p, model: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct((p) => ({ ...p, unit: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct((p) => ({ ...p, brand: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={newProduct.categoryId}
                  onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">Select</option>
                  {categories.data?.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
          )}

          <Button
            disabled={!canContinueProduct || saving}
            loading={saving}
            onClick={async () => {
              if (mode === "existing") {
                if (selected?.catalogRemark && !remark) setRemark(selected.catalogRemark);
                setStep(2);
                return;
              }
              setSaving(true);
              try {
                const created = await productsApi.create({
                  bcNumber: `P${Date.now().toString(36).toUpperCase()}`,
                  itemName: newProduct.itemName.trim(),
                  model: newProduct.model.trim(),
                  unit: newProduct.unit.trim(),
                  brand: newProduct.brand.trim() || undefined,
                  description: newProduct.description.trim() || undefined,
                  categoryId: newProduct.categoryId,
                  isSerialized: true,
                });
                setProductId(created.id);
                setMode("existing");
                await qc.invalidateQueries({ queryKey: ["products-catalog"] });
                toast.success("Product saved to catalog");
                setStep(2);
              } catch (e) {
                toast.error(e instanceof ApiRequestError ? e.message : "Could not save product");
              } finally {
                setSaving(false);
              }
            }}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="max-w-xl space-y-4">
          <p className="text-sm text-ink-muted">
            Product: <span className="font-medium text-ink">{productLabel}</span>
          </p>
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
            <Label>Location</Label>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Select location</option>
              {locations.data?.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantity (serials to scan)</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Total purchase cost (ETB)</Label>
            <Input
              type="number"
              min={0}
              value={totalCost}
              onChange={(e) => setTotalCost(Number(e.target.value))}
            />
            <p className="mt-2 text-sm text-ink-muted">Estimated unit cost {formatEtb(unitCost)}</p>
          </div>
          <div>
            <Label>Purchase date</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <Label>Remark</Label>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              disabled={!canContinueDetails}
              onClick={() => {
                setSerials([]);
                setStep(3);
              }}
            >
              Scan serials
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="max-w-xl space-y-4">
          <p className="display text-3xl font-semibold">
            {serials.length} / {quantity}
          </p>
          <p className="text-sm text-ink-muted">
            Year {stockYear} · FS {fsNumber} · {remaining} remaining
          </p>
          <Scanner onDecode={addSerial} />
          <ul className="space-y-1 font-mono text-sm">
            {serials.map((s) => (
              <li key={s} className="flex items-center justify-between border-b border-line py-2">
                <span>✓ {s}</span>
                <button className="text-danger" onClick={() => setSerials((p) => p.filter((x) => x !== s))}>
                  Remove
                </button>
              </li>
            ))}
            {Array.from({ length: remaining }).map((_, i) => (
              <li key={i} className="py-2 text-ink-muted">
                ○ Waiting…
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button disabled={serials.length !== quantity} onClick={() => setStep(4)}>
              Review
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="max-w-xl space-y-3">
          <p>
            <strong>Product</strong> {review.product}
          </p>
          <p>
            <strong>Year</strong> {review.stockYear}
          </p>
          <p>
            <strong>FS</strong> {review.fsNumber}
          </p>
          <p>
            <strong>Quantity</strong> {review.quantity}
          </p>
          <p>
            <strong>Total cost</strong> {formatEtb(review.totalCost)}
          </p>
          <p>
            <strong>Location</strong> {review.location}
          </p>
          {review.remark ? (
            <p>
              <strong>Remark</strong> {review.remark}
            </p>
          ) : null}
          <p className="font-mono text-sm">{review.serials.join(" · ")}</p>
          <div className="flex gap-2 pt-4">
            <Button variant="secondary" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              loading={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await stockInApi.create({
                    productId,
                    locationId,
                    quantity,
                    totalCost,
                    purchaseDate,
                    stockYear,
                    fsNumber: fsNumber.trim(),
                    remark,
                    serials: serials.map((serialNumber) => ({ serialNumber })),
                  });
                  const ref = (res as { referenceNumber?: string }).referenceNumber;
                  toast.success(ref ? `Stock added · ${ref}` : "Stock successfully added");
                  await qc.invalidateQueries({ queryKey: ["products"] });
                  await qc.invalidateQueries({ queryKey: ["inventory"] });
                  await qc.invalidateQueries({ queryKey: ["dashboard"] });
                  router.push("/products");
                } catch (e) {
                  toast.error(e instanceof ApiRequestError ? e.message : "Stock in failed");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Confirm stock in
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
