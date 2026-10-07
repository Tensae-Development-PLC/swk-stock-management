"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  Search,
  Shield,
  Tags,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/providers/auth-provider";
import { displayRole, PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const nav = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    label: "Inventory",
    items: [
      { href: "/products", label: "Products", icon: Package, perm: PERMISSIONS.PRODUCT_VIEW },
      { href: "/inventory", label: "Inventory", icon: Boxes, perm: PERMISSIONS.INVENTORY_VIEW },
      { href: "/stock-in", label: "Stock In", icon: ScanLine, perm: PERMISSIONS.STOCK_IN_VIEW },
      { href: "/stock-out", label: "Stock Out", icon: Truck, perm: PERMISSIONS.STOCK_OUT_VIEW },
      { href: "/transfers", label: "Transfers", icon: ClipboardList, perm: PERMISSIONS.TRANSFER_VIEW },
    ],
  },
  {
    label: "Sales",
    items: [{ href: "/sales", label: "Sales", icon: Wallet, perm: PERMISSIONS.SALE_VIEW }],
  },
  {
    label: "Analytics",
    items: [{ href: "/reports", label: "Reports", icon: FileBarChart, perm: PERMISSIONS.REPORT_VIEW }],
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Users", icon: Users, perm: PERMISSIONS.USER_VIEW },
      { href: "/locations", label: "Locations", icon: MapPin, perm: PERMISSIONS.LOCATION_VIEW },
      { href: "/categories", label: "Categories", icon: Tags, perm: PERMISSIONS.CATEGORY_VIEW },
      { href: "/audit-logs", label: "Audit Logs", icon: Shield, perm: PERMISSIONS.AUDIT_VIEW },
    ],
  },
];

export function AppSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-[width,transform] duration-250 lg:static",
        collapsed ? "w-[72px]" : "w-[240px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-[var(--sidebar-border)] px-3">
        {collapsed ? (
          <span className="display px-2 text-base font-semibold">S</span>
        ) : (
          <BrandMark />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="hidden h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-surface-2 lg:grid"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {nav.map((group) => {
          const items = group.items.filter((i) => hasPermission(i.perm));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-5">
              {!collapsed ? (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted/80">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] font-medium text-accent"
                            : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                        )}
                      >
                        <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                        {!collapsed ? item.label : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] p-2">
        {!collapsed ? (
          <div className="mb-2 rounded-md px-2.5 py-2">
            <p className="truncate text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-ink-muted">{displayRole(user?.role)}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Sign out" : null}
        </button>
      </div>
    </aside>
  );
}

export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-ink-muted shadow-[var(--shadow-sm)]"
    >
      <Search className="h-3.5 w-3.5" />
      Search serial, product, BC…
      <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted md:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
