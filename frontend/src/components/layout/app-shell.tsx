"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AppSidebar, SearchTrigger } from "@/components/layout/sidebar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CommandSearch } from "@/components/layout/command-search";
import { NotificationDropdown } from "@/components/layout/notifications";
import { displayRole } from "@/lib/permissions";
import { useAuth } from "@/providers/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/20 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-surface-2 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="hidden min-w-[140px] md:block">
            <Breadcrumbs pathname={pathname} />
          </div>
          <div className="mx-auto w-full max-w-xl">
            <SearchTrigger onOpen={() => setSearch(true)} />
          </div>
          <NotificationDropdown />
          <div className="hidden text-right text-sm md:block">
            <p className="font-medium leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-ink-muted">{displayRole(user.role)}</p>
          </div>
        </header>
        <main className="enter flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-7">{children}</main>
      </div>
      <CommandSearch open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
