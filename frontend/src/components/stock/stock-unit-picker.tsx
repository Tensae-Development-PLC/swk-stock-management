"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/field";
import { inventoryApi, productsApi } from "@/lib/api/endpoints";
import { Scanner } from "@/components/scanner/scanner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Product } from "@/types/api";

export type PickMode = "scan" | "select";

const AVAILABLE = new Set(["IN_STOCK", "RECEIVED"]);

function productLabel(p: Product) {
  return `${p.itemName} · ${p.model}`;
}

function serialCount(p: Product) {
  return p.serializedAvailable ?? 0;
}

export function StockUnitPicker({
  mode,
  onModeChange,
  productId,
  onProductChange,
  selectedSerials,
  onToggleSerial,
  onScanSerial,
  multi = false,
  /** When true, prefer products that already have scanned serial units in stock. */
  preferSerialized = false,
}: {
  mode: PickMode;
  onModeChange: (mode: PickMode) => void;
  productId: string;
  onProductChange: (id: string) => void;
  selectedSerials: string[];
  onToggleSerial: (serial: string) => void;
  onScanSerial: (serial: string) => void;
  multi?: boolean;
  preferSerialized?: boolean;
}) {
  const [productSearch, setProductSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounced = useDebouncedValue(productSearch, 200);

  const products = useQuery({
    queryKey: ["products-catalog", debounced],
    queryFn: () => productsApi.catalog(debounced || undefined),
  });

  const units = useQuery({
    queryKey: ["inventory-by-product", productId],
    queryFn: () =>
      inventoryApi.list({
        productId,
        limit: 500,
        sortOrder: "asc",
      }),
    enabled: mode === "select" && !!productId,
  });

  const available = (units.data?.data ?? []).filter((u) => AVAILABLE.has(u.status));

  const catalog = useMemo(() => {
    const rows = products.data?.data ?? [];
    if (!preferSerialized) return rows;
    return [...rows].sort((a, b) => serialCount(b) - serialCount(a));
  }, [products.data?.data, preferSerialized]);

  const selectedProduct = useMemo(
    () => catalog.find((p) => p.id === productId) ?? null,
    [catalog, productId],
  );

  useEffect(() => {
    if (selectedProduct) {
      setSelectedLabel(productLabel(selectedProduct));
    }
  }, [selectedProduct]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickProduct = (p: Product) => {
    onProductChange(p.id);
    setSelectedLabel(productLabel(p));
    setProductSearch("");
    setOpen(false);
  };

  const showDropdown = mode === "select" && open;

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border border-line bg-surface p-1">
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded text-sm font-medium",
            mode === "select" ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
          )}
          onClick={() => onModeChange("select")}
        >
          Select product
        </button>
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded text-sm font-medium",
            mode === "scan" ? "bg-accent text-white" : "text-ink-muted hover:text-ink",
          )}
          onClick={() => onModeChange("scan")}
        >
          Scan barcode
        </button>
      </div>

      {mode === "scan" ? (
        <Scanner onDecode={onScanSerial} />
      ) : (
        <div className="space-y-3">
          <div ref={wrapRef} className="relative">
            <Label>Search products</Label>
            <Input
              placeholder="Type name, model, or BC number…"
              value={open || !productId ? productSearch : selectedLabel}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setOpen(true);
                if (productId) onProductChange("");
              }}
              onFocus={() => {
                setOpen(true);
                if (productId && !productSearch) {
                  setProductSearch("");
                }
              }}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
            />
            {productId && !open ? (
              <button
                type="button"
                className="mt-1 text-xs text-accent"
                onClick={() => {
                  setProductSearch("");
                  setOpen(true);
                }}
              >
                Change product
              </button>
            ) : null}

            {showDropdown ? (
              <div className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface shadow-[var(--shadow)]">
                {products.isLoading ? (
                  <p className="px-3 py-3 text-sm text-ink-muted">Searching…</p>
                ) : products.isError ? (
                  <p className="px-3 py-3 text-sm text-danger">Could not load products.</p>
                ) : !catalog.length ? (
                  <p className="px-3 py-3 text-sm text-ink-muted">No products match that search.</p>
                ) : (
                  <ul role="listbox">
                    {catalog.slice(0, 80).map((p) => {
                      const serials = serialCount(p);
                      const opening = p.openingBalance ?? 0;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            role="option"
                            className={cn(
                              "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-2",
                              p.id === productId && "bg-surface-2",
                            )}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickProduct(p)}
                          >
                            <span className="font-medium">{p.itemName}</span>
                            <span className="text-xs text-ink-muted">
                              {p.model}
                              {p.brand ? ` · ${p.brand}` : ""}
                              {p.bcNumber ? ` · BC ${p.bcNumber}` : ""}
                            </span>
                            <span className="text-xs text-ink-soft">
                              {serials > 0 ? (
                                <span className="text-accent">{serials} serial available</span>
                              ) : (
                                <span>No serials yet</span>
                              )}
                              {opening > 0 ? ` · opening qty ${opening}` : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {catalog.length > 80 ? (
                      <li className="border-t border-line px-3 py-2 text-xs text-ink-muted">
                        Showing 80 of {catalog.length} — refine your search
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {productId ? (
            <div>
              <Label>{multi ? "Available serials" : "Serial"}</Label>
              {units.isLoading ? (
                <p className="mt-2 text-sm text-ink-muted">Loading serials…</p>
              ) : !available.length ? (
                <p className="mt-2 text-sm text-ink-muted">
                  No scanned serials for this product yet. Opening Excel stock has quantity but no
                  serial — use Stock In to add serials, or scan a barcode.
                </p>
              ) : (
                <ul className="mt-2 max-h-56 space-y-1 overflow-auto border border-line p-2">
                  {available.map((u) => {
                    const checked = selectedSerials.includes(u.serialNumber);
                    return (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                          <input
                            type={multi ? "checkbox" : "radio"}
                            name="stock-serial"
                            checked={checked}
                            onChange={() => onToggleSerial(u.serialNumber)}
                          />
                          <span className="font-mono">{u.serialNumber}</span>
                          <span className="text-ink-muted">
                            · {u.currentLocation?.name ?? "—"} · {u.status.replaceAll("_", " ")}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-muted">
              Pick a product from the dropdown. Products with scanned serials are listed first when
              transferring.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
