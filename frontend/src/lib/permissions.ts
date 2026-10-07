export const PERMISSIONS = {
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_VIEW: "PRODUCT_VIEW",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_VIEW: "CATEGORY_VIEW",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  LOCATION_CREATE: "LOCATION_CREATE",
  LOCATION_VIEW: "LOCATION_VIEW",
  LOCATION_UPDATE: "LOCATION_UPDATE",
  STOCK_IN_CREATE: "STOCK_IN_CREATE",
  STOCK_IN_VIEW: "STOCK_IN_VIEW",
  STOCK_OUT_CREATE: "STOCK_OUT_CREATE",
  STOCK_OUT_VIEW: "STOCK_OUT_VIEW",
  SALE_CREATE: "SALE_CREATE",
  SALE_VIEW: "SALE_VIEW",
  TRANSFER_CREATE: "TRANSFER_CREATE",
  TRANSFER_VIEW: "TRANSFER_VIEW",
  TRANSFER_DISPATCH: "TRANSFER_DISPATCH",
  TRANSFER_RECEIVE: "TRANSFER_RECEIVE",
  TRANSFER_CANCEL: "TRANSFER_CANCEL",
  INVENTORY_VIEW: "INVENTORY_VIEW",
  INVENTORY_ADJUST: "INVENTORY_ADJUST",
  REPORT_VIEW: "REPORT_VIEW",
  REPORT_EXPORT: "REPORT_EXPORT",
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_VIEW: "USER_VIEW",
  AUDIT_VIEW: "AUDIT_VIEW",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const STAFF_ROLES = ["ADMIN", "STOREKEEPER"] as const;

export function isAdminRole(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function displayRole(role?: string) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "Admin";
  if (role === "STOREKEEPER") return "Storekeeper";
  return role ?? "Staff";
}

export function can(permissions: string[] | undefined, ...needed: string[]) {
  if (!permissions?.length) return false;
  return needed.every((p) => permissions.includes(p));
}
