import type { Transfer } from "@/types/api";

export type ReceiveStage = "pending" | "done" | "closed";
export type MaintenanceStage = "locked" | "pending" | "finished" | "na";

export function visitCount(t: Pick<Transfer, "maintenanceVisitCount" | "_count" | "fieldEvents">) {
  return t.maintenanceVisitCount ?? t._count?.fieldEvents ?? t.fieldEvents?.length ?? 0;
}

export function receiveStage(status: string): ReceiveStage {
  if (["CANCELLED", "REJECTED", "EXPIRED"].includes(status)) return "closed";
  if (status === "RECEIVED") return "done";
  return "pending";
}

export function maintenanceStage(status: string, visits: number): MaintenanceStage {
  if (["CANCELLED", "REJECTED", "EXPIRED"].includes(status)) return "na";
  if (status !== "RECEIVED") return "locked";
  return visits > 0 ? "finished" : "pending";
}

export function receiveChipLabel(stage: ReceiveStage) {
  if (stage === "done") return "Received";
  if (stage === "closed") return "Closed";
  return "Receive pending";
}

export function maintenanceChipLabel(stage: MaintenanceStage, visits = 0) {
  if (stage === "locked") return "Maint locked";
  if (stage === "pending") return "Maint pending";
  if (stage === "finished") return `Maint done · ${visits}`;
  return "—";
}

export function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function appReceiveUrl(token?: string, url?: string | null) {
  if (url) return url;
  if (!token) return null;
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/receive/${token}`;
}

export function appMaintainUrl(token?: string, url?: string | null) {
  if (url) return url;
  if (!token) return null;
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/maintain/${token}`;
}
