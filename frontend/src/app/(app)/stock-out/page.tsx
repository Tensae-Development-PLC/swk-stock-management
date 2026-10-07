"use client";

import Link from "next/link";
import { ArrowRight, MapPinned, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function StockOutPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock Out"
        description="Choose how this unit leaves the warehouse."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/stock-out/sale"
          className="group panel block p-8 transition-colors hover:border-[var(--line-strong)]"
        >
          <ShoppingBag className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <h2 className="display mt-5 text-2xl font-semibold">Direct sale</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
            Sell a serialized unit to a customer. Selling price is stored separately from purchase
            cost, and profit is calculated automatically.
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            Continue <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          href="/stock-out/transfer"
          className="group panel block p-8 transition-colors hover:border-[var(--line-strong)]"
        >
          <MapPinned className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <h2 className="display mt-5 text-2xl font-semibold">Regional transfer</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
            Dispatch inventory to another SWK location. Receipt stays pending until the receiver
            scans the physical serial.
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            Continue <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
