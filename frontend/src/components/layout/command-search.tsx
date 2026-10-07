"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inventoryApi, productsApi, transfersApi } from "@/lib/api/endpoints";
import type { InventoryUnit, Product, Transfer } from "@/types/api";

export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setProducts([]);
        setUnits([]);
        setTransfers([]);
        return;
      }
      const [p, u, tr] = await Promise.all([
        productsApi.list({ search: q, limit: 5 }),
        inventoryApi.list({ search: q, limit: 5 }),
        transfersApi.list({ search: q, limit: 5 }),
      ]);
      setProducts(p.data);
      setUnits(u.data);
      setTransfers(tr.data);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Serial, product, model, BC, transfer reference…"
          className="h-14 w-full border-b border-line bg-transparent px-4 text-base outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-2 text-sm">
          {!q ? (
            <p className="px-3 py-6 text-ink-muted">Search live inventory from the SWK database.</p>
          ) : (
            <>
              {units.map((u) => (
                <button
                  key={u.id}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface-2"
                  onClick={() => go(`/inventory/${u.id}`)}
                >
                  <span className="font-mono">{u.serialNumber}</span>
                  <span className="ml-2 text-ink-muted">
                    {u.product?.itemName} · {u.status}
                  </span>
                </button>
              ))}
              {products.map((p) => (
                <button
                  key={p.id}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface-2"
                  onClick={() => go(`/products/${p.id}`)}
                >
                  {p.itemName} {p.model}
                  <span className="ml-2 text-ink-muted">BC {p.bcNumber}</span>
                </button>
              ))}
              {transfers.map((t) => (
                <button
                  key={t.id}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface-2"
                  onClick={() => go(`/transfers/${t.id}`)}
                >
                  {t.referenceNumber}
                  <span className="ml-2 text-ink-muted">{t.status}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
