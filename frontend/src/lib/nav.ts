export const PAGE_META: Record<string, { title: string; crumbs: { href: string; label: string }[] }> = {
  "/dashboard": { title: "Control", crumbs: [{ href: "/dashboard", label: "Control" }] },
  "/products": { title: "Products", crumbs: [{ href: "/products", label: "Products" }] },
  "/inventory": { title: "Inventory", crumbs: [{ href: "/inventory", label: "Inventory" }] },
  "/stock-in": { title: "Stock In", crumbs: [{ href: "/stock-in", label: "Stock In" }] },
  "/stock-out": { title: "Stock Out", crumbs: [{ href: "/stock-out", label: "Stock Out" }] },
  "/stock-out/sale": {
    title: "Direct sale",
    crumbs: [
      { href: "/stock-out", label: "Stock Out" },
      { href: "/stock-out/sale", label: "Direct sale" },
    ],
  },
  "/stock-out/transfer": {
    title: "Regional transfer",
    crumbs: [
      { href: "/stock-out", label: "Stock Out" },
      { href: "/stock-out/transfer", label: "Transfer" },
    ],
  },
  "/transfers": { title: "Transfers", crumbs: [{ href: "/transfers", label: "Transfers" }] },
  "/sales": { title: "Sales", crumbs: [{ href: "/sales", label: "Sales" }] },
  "/reports": { title: "Reports", crumbs: [{ href: "/reports", label: "Reports" }] },
  "/users": { title: "Users", crumbs: [{ href: "/users", label: "Users" }] },
  "/locations": { title: "Locations", crumbs: [{ href: "/locations", label: "Locations" }] },
  "/categories": { title: "Categories", crumbs: [{ href: "/categories", label: "Categories" }] },
  "/audit-logs": { title: "Audit log", crumbs: [{ href: "/audit-logs", label: "Audit log" }] },
};

export function pageMeta(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  if (pathname.startsWith("/products/")) {
    return {
      title: "Product",
      crumbs: [
        { href: "/products", label: "Products" },
        { href: pathname, label: "Detail" },
      ],
    };
  }
  if (pathname.startsWith("/inventory/")) {
    return {
      title: "Serial",
      crumbs: [
        { href: "/inventory", label: "Inventory" },
        { href: pathname, label: "Unit" },
      ],
    };
  }
  if (pathname.startsWith("/transfers/")) {
    return {
      title: "Transfer",
      crumbs: [
        { href: "/transfers", label: "Transfers" },
        { href: pathname, label: "Detail" },
      ],
    };
  }
  return { title: "SWK", crumbs: [{ href: pathname, label: "SWK" }] };
}
