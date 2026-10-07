import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setSession,
} from "@/lib/auth/session";
import type { ApiError, ApiSuccess } from "@/types/api";

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function messageFrom(payload: ApiError | { message?: string | string[] }) {
  const m = "message" in payload ? payload.message : "Request failed";
  return Array.isArray(m) ? m.join(". ") : m || "Request failed";
}

async function parseEnvelope<T>(res: Response): Promise<{ data: T; meta?: ApiSuccess<T>["meta"] }> {
  const json = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiError | null;
  if (!res.ok) {
    const err = json as ApiError | null;
    throw new ApiRequestError(
      err ? messageFrom(err) : res.statusText,
      res.status,
      err?.error ?? "ERROR",
    );
  }
  if (json && typeof json === "object" && "success" in json && json.success === false) {
    throw new ApiRequestError(messageFrom(json), json.statusCode, json.error);
  }
  if (json && typeof json === "object" && "data" in json) {
    const ok = json as ApiSuccess<T>;
    return { data: ok.data, meta: ok.meta };
  }
  return { data: json as T };
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccess() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${baseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return false;
  }
  const { data } = await parseEnvelope<{ accessToken: string; refreshToken: string }>(res);
  const remember = Boolean(localStorage.getItem("swk_access"));
  setSession(data.accessToken, data.refreshToken, remember);
  return true;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const { data } = await apiFetchEnvelope<T>(path, init, retry);
  return data;
}

export async function apiFetchEnvelope<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<{ data: T; meta?: ApiSuccess<T>["meta"] }> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  if (res.status === 401 && retry && getRefreshToken()) {
    refreshing =
      refreshing ??
      refreshAccess().finally(() => {
        refreshing = null;
      });
    const ok = await refreshing;
    if (ok) return apiFetchEnvelope<T>(path, init, false);
  }
  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
  }
  return parseEnvelope<T>(res);
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}

export function apiPostForm<T>(path: string, form: FormData) {
  return apiFetch<T>(path, { method: "POST", body: form });
}

export async function fetchAuthenticatedBlob(path: string) {
  const token = getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiRequestError("Could not load file.", res.status);
  return res.blob();
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}

export function apiGetMeta<T>(path: string) {
  return apiFetchEnvelope<T>(path);
}

export function downloadUrl(path: string) {
  return `${baseUrl()}${path}`;
}

export async function downloadAuthenticated(path: string, filename: string) {
  const token = getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiRequestError("Export failed.", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
