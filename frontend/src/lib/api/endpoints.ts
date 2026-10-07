import {
  apiGet,
  apiGetMeta,
  apiPatch,
  apiPost,
  apiPostForm,
  downloadAuthenticated,
} from "@/lib/api/client";
import type {
  AuditLog,
  AuthUser,
  Category,
  DashboardSummary,
  InventoryUnit,
  Location,
  Product,
  ReceivePreview,
  Role,
  Sale,
  StaffNotification,
  StaffUser,
  Transfer,
  TransferReason,
} from "@/types/api";

function q(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  });
  const str = s.toString();
  return str ? `?${str}` : "";
}

export const authApi = {
  login: (email: string, password: string) =>
    apiPost<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/login", {
      email,
      password,
    }),
  me: () => apiGet<AuthUser>("/auth/me"),
  logout: (refreshToken?: string) => apiPost("/auth/logout", { refreshToken }),
};

export const dashboardApi = {
  summary: (period: "7d" | "30d" | "90d" | "1y" = "30d") =>
    apiGet<DashboardSummary>(`/dashboard/summary?period=${period}`),
};

export const productsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<Product[]>(`/products${q(params)}`),
  /** Full catalog for dropdowns (stock-in / stock-out). */
  catalog: (search?: string) =>
    apiGetMeta<Product[]>(`/products${q({ limit: 1000, search: search || undefined, sortBy: "itemName", sortOrder: "asc" })}`),
  one: (id: string) => apiGet<Product>(`/products/${id}`),
  create: (body: unknown) => apiPost<Product>("/products", body),
  update: (id: string, body: unknown) => apiPatch<Product>(`/products/${id}`, body),
};

export const categoriesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<Category[]>(`/categories${q({ limit: 100, ...params })}`),
  create: (body: unknown) => apiPost<Category>("/categories", body),
  update: (id: string, body: unknown) => apiPatch<Category>(`/categories/${id}`, body),
};

export const locationsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<Location[]>(`/locations${q({ limit: 100, ...params })}`),
  create: (body: unknown) => apiPost<Location>("/locations", body),
  update: (id: string, body: unknown) => apiPatch<Location>(`/locations/${id}`, body),
};

export type InventoryBalanceRow = {
  id: string;
  quantity: number;
  stockYear: number;
  product?: Product;
  location?: Location;
};

export const inventoryApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<InventoryUnit[]>(`/inventory${q(params)}`),
  balances: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<InventoryBalanceRow[]>(`/inventory/balances${q(params)}`),
  bySerial: (serial: string) => apiGet<InventoryUnit>(`/inventory/serial/${encodeURIComponent(serial)}`),
  one: (id: string) => apiGet<InventoryUnit>(`/inventory/${id}`),
};

export const stockInApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<unknown[]>(`/stock-in${q(params)}`),
  create: (body: unknown) => apiPost("/stock-in", body),
};

export const salesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<Sale[]>(`/sales${q(params)}`),
  one: (id: string) => apiGet<Sale>(`/sales/${id}`),
  create: (body: unknown) => apiPost<Sale>("/sales", body),
};

export const transfersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<Transfer[]>(`/transfers${q(params)}`),
  one: (id: string) => apiGet<Transfer>(`/transfers/${id}`),
  reasons: () => apiGet<TransferReason[]>("/transfers/reasons"),
  create: (body: unknown) => apiPost<Transfer>("/transfers", body),
  receivingLink: (id: string) => apiPost<Transfer>(`/transfers/${id}/receiving-link`),
  maintenanceLink: (id: string) => apiPost<Transfer>(`/transfers/${id}/maintenance-link`),
  cancel: (id: string) => apiPatch<Transfer>(`/transfers/${id}/cancel`),
  fieldEventPhotoPath: (transferId: string, eventId: string) =>
    `/transfers/${transferId}/field-events/${eventId}/photo`,
};

export const receivingApi = {
  preview: (token: string) => apiGet<ReceivePreview>(`/receiving/${token}`),
  previewMaintenance: (token: string) =>
    apiGet<ReceivePreview>(`/receiving/${token}/maintenance`),
  verify: (
    token: string,
    body: {
      serialNumber: string;
      receiverName: string;
      receiverPhone: string;
      latitude: number;
      longitude: number;
      accuracy: number;
    },
  ) => apiPost<{ message: string; transfer: ReceivePreview }>(`/receiving/${token}/verify`, body),
  submitMaintenance: (token: string, form: FormData) =>
    apiPostForm<{ message: string }>(`/receiving/${token}/maintenance`, form),
};

export const notificationsApi = {
  list: (limit = 20) =>
    apiGet<{ items: StaffNotification[]; unreadCount: number }>(`/notifications?limit=${limit}`),
  markRead: (id: string) => apiPatch(`/notifications/${id}/read`),
  markAllRead: () => apiPatch("/notifications/read-all"),
};

export const usersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<StaffUser[]>(`/users${q(params)}`),
  create: (body: unknown) => apiPost<StaffUser>("/users", body),
  update: (id: string, body: unknown) => apiPatch<StaffUser>(`/users/${id}`, body),
  roles: () => apiGet<Role[]>("/roles"),
};

export const auditApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiGetMeta<AuditLog[]>(`/audit-logs${q(params)}`),
};

export const reportsApi = {
  fetch: (kind: string, params: Record<string, string | undefined> = {}) =>
    apiGet<{ rows: unknown[]; totals?: Record<string, unknown> }>(`/reports/${kind}${q(params)}`),
  exportStock: (format: "csv" | "xlsx") =>
    downloadAuthenticated(`/reports/current-stock/export?format=${format}`, `current-stock.${format}`),
};
