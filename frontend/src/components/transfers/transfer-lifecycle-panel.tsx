"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, MapPin, Share2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { transfersApi } from "@/lib/api/endpoints";
import { ApiRequestError, fetchAuthenticatedBlob } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transfer, TransferFieldEvent, TransferLifecycleStage } from "@/types/api";

function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function appBase() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

function resolveStage(t: Transfer): TransferLifecycleStage {
  if (t.lifecycleStage) return t.lifecycleStage;
  const visits = t.maintenanceVisitCount ?? t.fieldEvents?.length ?? 0;
  if (["CANCELLED", "REJECTED", "EXPIRED"].includes(t.status)) return "CLOSED";
  if (t.status === "RECEIVED") return visits > 0 ? "MAINTENANCE_DONE" : "PENDING_MAINTENANCE";
  if (["AWAITING_RECEIPT", "DISPATCHED", "CREATED"].includes(t.status)) return "AWAITING_RECEIVE";
  return t.status;
}

function FieldEventPhoto({ transferId, event }: { transferId: string; event: TransferFieldEvent }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    void (async () => {
      try {
        const blob = await fetchAuthenticatedBlob(
          transfersApi.fieldEventPhotoPath(transferId, event.id),
        );
        revoked = URL.createObjectURL(blob);
        setSrc(revoked);
      } catch {
        setSrc(null);
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [transferId, event.id]);

  if (!src) return <div className="h-28 w-36 animate-pulse rounded-md bg-surface-2" />;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={`Maintenance ${event.serialNumber}`}
      className="h-28 w-36 rounded-md object-cover"
    />
  );
}

function ShareLinkBlock({
  title,
  hint,
  url,
  locked,
  done,
  busy,
  onRefresh,
}: {
  title: string;
  hint: string;
  url: string | null;
  locked?: boolean;
  done?: boolean;
  busy: boolean;
  onRefresh: () => Promise<string | null>;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        done ? "border-[var(--success)]/30 bg-[var(--success-soft)]/40" : "border-line bg-surface",
        locked && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-ink-muted">{hint}</p>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--success)]">
            <Check className="h-3 w-3" /> Done
          </span>
        ) : locked ? (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
            Locked
          </span>
        ) : (
          <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[11px] text-[var(--warn)]">
            Active
          </span>
        )}
      </div>

      {locked ? null : url ? (
        <div className="mt-4 space-y-3">
          <div className="inline-block border border-line bg-white p-2">
            <QRCodeSVG value={url} size={104} />
          </div>
          <p className="break-all font-mono text-[11px] text-ink-soft">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                toast.success("Copied");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
            {"share" in navigator ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.share({ title, url })}
              >
                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                Share
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void onRefresh()}>
              Refresh
            </Button>
          </div>
        </div>
      ) : !done ? (
        <Button className="mt-4" size="sm" loading={busy} onClick={() => void onRefresh()}>
          Show link
        </Button>
      ) : null}
    </div>
  );
}

function StageRail({ stage }: { stage: TransferLifecycleStage }) {
  const steps = [
    { key: "AWAITING_RECEIVE", label: "Receive" },
    { key: "PENDING_MAINTENANCE", label: "Maintenance" },
    { key: "MAINTENANCE_DONE", label: "Finished" },
  ] as const;

  const activeIndex =
    stage === "MAINTENANCE_DONE"
      ? 2
      : stage === "PENDING_MAINTENANCE"
        ? 1
        : stage === "CLOSED"
          ? -1
          : 0;

  return (
    <ol className="grid grid-cols-3 gap-2">
      {steps.map((s, i) => {
        const done = activeIndex > i || (stage === "MAINTENANCE_DONE" && i <= 2);
        const current = activeIndex === i;
        return (
          <li
            key={s.key}
            className={cn(
              "rounded-md border px-3 py-2",
              done || current
                ? "border-accent/40 bg-[var(--accent-soft)]"
                : "border-line bg-surface",
            )}
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Step {i + 1}</p>
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                current || done ? "text-accent" : "text-ink-muted",
              )}
            >
              {s.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function TransferLifecyclePanel({
  transferId,
  compact = false,
  showCancel = false,
}: {
  transferId: string;
  compact?: boolean;
  showCancel?: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["transfer", transferId],
    queryFn: () => transfersApi.one(transferId),
  });
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [maintBusy, setMaintBusy] = useState(false);
  const [receiveLink, setReceiveLink] = useState<string | null>(null);
  const [maintLink, setMaintLink] = useState<string | null>(null);

  const stage = data ? resolveStage(data) : "AWAITING_RECEIVE";
  const pendingReceive = data
    ? data.status === "AWAITING_RECEIPT" || data.status === "DISPATCHED"
    : false;
  const received = data?.status === "RECEIVED";
  const visits = data?.fieldEvents?.length ?? data?.maintenanceVisitCount ?? 0;

  const receiveUrl = useMemo(() => {
    if (!data) return null;
    return (
      receiveLink ||
      data.receivingUrl ||
      (data.receivingToken ? `${appBase()}/receive/${data.receivingToken}` : null)
    );
  }, [data, receiveLink]);

  const maintUrl = useMemo(() => {
    if (!data) return null;
    return (
      maintLink ||
      data.maintenanceUrl ||
      (data.maintenanceToken ? `${appBase()}/maintain/${data.maintenanceToken}` : null)
    );
  }, [data, maintLink]);

  const loadReceive = async () => {
    setReceiveBusy(true);
    try {
      const res = await transfersApi.receivingLink(transferId);
      const url =
        res.receivingUrl || `${appBase()}/receive/${res.receivingToken}`;
      setReceiveLink(url);
      await qc.invalidateQueries({ queryKey: ["transfer", transferId] });
      toast.success("Receive link ready");
      return url;
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Could not load receive link");
      return null;
    } finally {
      setReceiveBusy(false);
    }
  };

  const loadMaint = async () => {
    setMaintBusy(true);
    try {
      const res = await transfersApi.maintenanceLink(transferId);
      const url =
        res.maintenanceUrl || `${appBase()}/maintain/${res.maintenanceToken}`;
      setMaintLink(url);
      await qc.invalidateQueries({ queryKey: ["transfer", transferId] });
      toast.success("Maintenance link ready");
      return url;
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Could not load maintenance link");
      return null;
    } finally {
      setMaintBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-16 animate-pulse rounded-md bg-surface-2" />
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="p-4 text-sm text-danger">
        {error instanceof ApiRequestError ? error.message : "Could not load transfer details."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-6", compact ? "p-4 md:p-5" : "p-1")}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={String(stage)} />
        <StatusBadge value={data.status} />
        {visits > 0 ? (
          <span className="text-xs text-ink-muted">
            {visits} maintenance visit{visits === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <StageRail stage={stage} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">Route</p>
          <p className="mt-1 text-sm">
            {data.sourceLocation?.name} → {data.destinationLocation?.name}
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">Receiver</p>
          <p className="mt-1 text-sm">
            {data.receiverName && data.receiverName !== "Awaiting receiver"
              ? `${data.receiverName}${data.receiverPhone ? ` · ${data.receiverPhone}` : ""}`
              : "Not confirmed"}
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">FS / Year</p>
          <p className="mt-1 text-sm">
            {data.fsNumber ?? "—"} · {data.stockYear ?? "—"}
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">Serials</p>
          <p className="mt-1 font-mono text-xs">
            {data.items?.map((i) => i.expectedSerialNumber).join(", ") || "—"}
          </p>
        </div>
      </div>

      {/* State-aware messaging */}
      {stage === "AWAITING_RECEIVE" ? (
        <div className="rounded-lg border border-[var(--warn)]/25 bg-[var(--warn-soft)]/50 px-4 py-3 text-sm">
          Both links are ready to share. Receive must be completed before maintenance unlocks.
        </div>
      ) : null}
      {stage === "PENDING_MAINTENANCE" ? (
        <div className="rounded-lg border border-[var(--info)]/25 bg-[var(--info-soft)]/60 px-4 py-3 text-sm">
          Item received. Maintenance is still pending — share the maintenance link for the field
          visit.
        </div>
      ) : null}
      {stage === "MAINTENANCE_DONE" ? (
        <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success-soft)]/50 px-4 py-3 text-sm">
          Maintenance finished ({visits} visit{visits === 1 ? "" : "s"}). You can still log another
          visit with the same maintenance link.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ShareLinkBlock
          title="Receive link"
          hint={
            pendingReceive
              ? "Scan serial + GPS required on the phone."
              : received
                ? "Receive completed — link disabled."
                : "Not available for this status."
          }
          url={pendingReceive ? receiveUrl : null}
          done={received}
          locked={!pendingReceive && !received}
          busy={receiveBusy}
          onRefresh={loadReceive}
        />
        <ShareLinkBlock
          title="Maintenance link"
          hint={
            received
              ? "Scan + photo + GPS. Multiple visits allowed."
              : "Unlocks automatically after receive."
          }
          url={received ? maintUrl : null}
          locked={!received}
          done={stage === "MAINTENANCE_DONE"}
          busy={maintBusy}
          onRefresh={loadMaint}
        />
      </div>

      {received && data.receivedLat != null && data.receivedLng != null ? (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">Receive location</h3>
          </div>
          <p className="mt-2 font-mono text-sm">
            {data.receivedLat.toFixed(6)}, {data.receivedLng.toFixed(6)}
            {data.receivedAccuracyM != null
              ? ` · ±${Math.round(data.receivedAccuracyM)}m`
              : ""}
          </p>
          <a
            className="mt-2 inline-block text-sm text-accent underline"
            href={mapsUrl(data.receivedLat, data.receivedLng)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>
          {data.receivedAt ? (
            <p className="mt-1 text-xs text-ink-muted">{formatDateTime(data.receivedAt)}</p>
          ) : null}
        </section>
      ) : null}

      {data.fieldEvents?.length ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">Maintenance timeline</h3>
          </div>
          <ul className="space-y-3">
            {data.fieldEvents.map((ev, idx) => (
              <li
                key={ev.id}
                className="flex flex-wrap gap-4 rounded-lg border border-line bg-surface p-3"
              >
                <FieldEventPhoto transferId={transferId} event={ev} />
                <div className="min-w-[14rem] flex-1 space-y-1 text-sm">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                    Visit {data.fieldEvents!.length - idx}
                  </p>
                  <p className="font-mono text-xs">{ev.serialNumber}</p>
                  <p>
                    {ev.performedByName} · {ev.performedByPhone}
                  </p>
                  <p className="text-ink-muted">{formatDateTime(ev.createdAt)}</p>
                  <a
                    className="inline-flex items-center gap-1 text-accent underline"
                    href={mapsUrl(ev.lat, ev.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {ev.lat.toFixed(5)}, {ev.lng.toFixed(5)}
                    {ev.accuracyM != null ? ` (±${Math.round(ev.accuracyM)}m)` : ""}
                  </a>
                  {ev.notes ? <p className="mt-1 text-ink-muted">{ev.notes}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : received ? (
        <p className="text-sm text-ink-muted">No maintenance visits logged yet.</p>
      ) : null}

      {data.verificationLogs?.length ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Verification attempts</h3>
          <ul className="space-y-1.5 text-sm">
            {data.verificationLogs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge value={l.result} />
                <span className="font-mono text-xs">{l.scannedSerialNumber}</span>
                <span className="text-ink-muted">{formatDateTime(l.attemptedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showCancel && pendingReceive ? (
        <Button
          variant="danger"
          onClick={async () => {
            try {
              await transfersApi.cancel(transferId);
              toast.success("Transfer cancelled");
              await qc.invalidateQueries({ queryKey: ["transfer", transferId] });
              await qc.invalidateQueries({ queryKey: ["transfers"] });
            } catch (e) {
              toast.error(e instanceof ApiRequestError ? e.message : "Cancel failed");
            }
          }}
        >
          Cancel transfer
        </Button>
      ) : null}
    </div>
  );
}
