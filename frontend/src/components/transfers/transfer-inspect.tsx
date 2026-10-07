"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { transfersApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime } from "@/lib/format";
import { ApiRequestError, fetchAuthenticatedBlob } from "@/lib/api/client";
import type { Transfer, TransferFieldEvent } from "@/types/api";
import { cn } from "@/lib/utils";
import {
  appMaintainUrl,
  appReceiveUrl,
  maintenanceChipLabel,
  maintenanceStage,
  mapsUrl,
  receiveChipLabel,
  receiveStage,
  visitCount,
} from "@/lib/transfer-lifecycle";

function StagePill({
  label,
  tone,
}: {
  label: string;
  tone: "pending" | "done" | "locked" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium tracking-[0.02em]",
        tone === "done" && "bg-[var(--success-soft)] text-[var(--success)]",
        tone === "pending" && "bg-[var(--warn-soft)] text-[var(--warn)]",
        tone === "locked" && "bg-surface-2 text-ink-muted",
        tone === "muted" && "bg-surface-2 text-ink-soft",
      )}
    >
      {label}
    </span>
  );
}

export function DualStageChips({ transfer }: { transfer: Transfer }) {
  const visits = visitCount(transfer);
  const recv = receiveStage(transfer.status);
  const maint = maintenanceStage(transfer.status, visits);
  return (
    <div className="flex flex-wrap gap-1.5">
      <StagePill
        label={receiveChipLabel(recv)}
        tone={recv === "done" ? "done" : recv === "closed" ? "muted" : "pending"}
      />
      <StagePill
        label={maintenanceChipLabel(maint, visits)}
        tone={
          maint === "finished" ? "done" : maint === "pending" ? "pending" : "locked"
        }
      />
    </div>
  );
}

function LinkCard({
  title,
  description,
  url,
  disabled,
  locked,
  busy,
  onRefresh,
  compact,
}: {
  title: string;
  description: string;
  url: string | null;
  disabled?: boolean;
  locked?: boolean;
  busy: boolean;
  onRefresh: () => Promise<string | null>;
  compact?: boolean;
}) {
  return (
    <div className={cn("panel space-y-3", compact ? "p-4" : "p-5")}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {disabled || locked ? (
        <p className="text-sm text-ink-muted">{description}</p>
      ) : (
        <>
          <p className="text-xs text-ink-muted">{description}</p>
          {url ? (
            <>
              <div className="inline-block border border-line bg-white p-2">
                <QRCodeSVG value={url} size={compact ? 100 : 120} />
              </div>
              <p className="break-all font-mono text-[11px] text-ink-soft">{url}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    toast.success("Copied");
                  }}
                >
                  Copy
                </Button>
                {"share" in navigator ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigator.share({ title: "SWK transfer link", url })}
                  >
                    Share
                  </Button>
                ) : null}
                <Button variant="secondary" loading={busy} onClick={() => void onRefresh()}>
                  Refresh
                </Button>
              </div>
            </>
          ) : (
            <Button loading={busy} onClick={() => void onRefresh()}>
              Show link
            </Button>
          )}
        </>
      )}
    </div>
  );
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

  if (!src) return <div className="h-20 w-28 animate-pulse rounded bg-surface-2" />;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={`Maintenance ${event.serialNumber}`}
      className="h-20 w-28 rounded object-cover"
    />
  );
}

export function TransferInspect({
  transfer,
  compact = false,
  showCancel = false,
  showFullPageLink = false,
}: {
  transfer: Transfer;
  compact?: boolean;
  showCancel?: boolean;
  showFullPageLink?: boolean;
}) {
  const id = transfer.id;
  const qc = useQueryClient();
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [maintBusy, setMaintBusy] = useState(false);
  const [receiveLink, setReceiveLink] = useState<string | null>(null);
  const [maintLink, setMaintLink] = useState<string | null>(null);

  const visits = visitCount(transfer);
  const recv = receiveStage(transfer.status);
  const maint = maintenanceStage(transfer.status, visits);
  const pending = recv === "pending";
  const received = recv === "done";
  const closed = recv === "closed";

  const receiveUrl =
    receiveLink || appReceiveUrl(transfer.receivingToken, transfer.receivingUrl);
  const maintUrl =
    maintLink || appMaintainUrl(transfer.maintenanceToken, transfer.maintenanceUrl);

  const loadReceive = async () => {
    setReceiveBusy(true);
    try {
      const res = await transfersApi.receivingLink(id);
      const url = appReceiveUrl(res.receivingToken, res.receivingUrl);
      setReceiveLink(url);
      await qc.invalidateQueries({ queryKey: ["transfer", id] });
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Receiving link ready");
      return url;
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Could not load receiving link");
      return null;
    } finally {
      setReceiveBusy(false);
    }
  };

  const loadMaint = async () => {
    setMaintBusy(true);
    try {
      const res = await transfersApi.maintenanceLink(id);
      const url = appMaintainUrl(res.maintenanceToken, res.maintenanceUrl);
      setMaintLink(url);
      await qc.invalidateQueries({ queryKey: ["transfer", id] });
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Maintenance link ready");
      return url;
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Could not load maintenance link");
      return null;
    } finally {
      setMaintBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DualStageChips transfer={transfer} />
        <StatusBadge value={transfer.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-md border border-line p-3",
            recv === "done" && "border-[var(--success)]/30 bg-[var(--success-soft)]/40",
            recv === "pending" && "border-[var(--warn)]/30 bg-[var(--warn-soft)]/40",
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">1 · Receive</p>
          <p className="mt-1 text-sm font-semibold">{receiveChipLabel(recv)}</p>
          {received && transfer.receivedAt ? (
            <p className="mt-1 text-xs text-ink-muted">{formatDateTime(transfer.receivedAt)}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "rounded-md border border-line p-3",
            maint === "finished" && "border-[var(--success)]/30 bg-[var(--success-soft)]/40",
            maint === "pending" && "border-[var(--warn)]/30 bg-[var(--warn-soft)]/40",
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">2 · Maintenance</p>
          <p className="mt-1 text-sm font-semibold">
            {maintenanceChipLabel(maint, visits)}
          </p>
          {maint === "finished" ? (
            <p className="mt-1 text-xs text-ink-muted">
              {visits} visit{visits === 1 ? "" : "s"} logged — more visits still allowed
            </p>
          ) : maint === "locked" ? (
            <p className="mt-1 text-xs text-ink-muted">Unlocks after receive</p>
          ) : null}
        </div>
      </div>

      <div className="panel space-y-2 p-4 text-sm">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Route</p>
        <p className="font-medium">
          {transfer.sourceLocation?.name ?? "—"} → {transfer.destinationLocation?.name ?? "—"}
        </p>
        <p className="text-ink-muted">
          FS {transfer.fsNumber ?? "—"} · Year {transfer.stockYear ?? "—"} ·{" "}
          {transfer.reason?.name ?? "—"}
        </p>
        <p className="text-ink-muted">Dispatched {formatDate(transfer.dispatchDate)}</p>
        <p>
          Receiver{" "}
          {transfer.receiverName && transfer.receiverName !== "Awaiting receiver"
            ? `${transfer.receiverName}${transfer.receiverPhone ? ` · ${transfer.receiverPhone}` : ""}`
            : "Not confirmed yet"}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
          Units
        </p>
        <ul className="space-y-2 text-sm">
          {transfer.items?.map((i) => (
            <li key={i.id} className="rounded-md border border-line px-3 py-2">
              <p className="font-mono text-xs">{i.expectedSerialNumber}</p>
              {i.product ? (
                <p className="text-ink-muted">
                  {i.product.itemName} · {i.product.model}
                </p>
              ) : null}
              <StatusBadge value={i.status} />
            </li>
          ))}
        </ul>
      </div>

      {!closed ? (
        <div className={cn("grid gap-3", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
          <LinkCard
            title="Receive link"
            description={
              received
                ? "Receive confirmed. Link disabled."
                : pending
                  ? "Share while pending. GPS required on submit."
                  : "Not available."
            }
            url={pending ? receiveUrl : null}
            disabled={!pending}
            busy={receiveBusy}
            onRefresh={loadReceive}
            compact={compact}
          />
          <LinkCard
            title="Maintenance link"
            description={
              received
                ? maint === "finished"
                  ? "Finished visits logged — share again for another visit."
                  : "Pending first maintenance visit (scan + photo + GPS)."
                : "Locked until the item is received."
            }
            url={received ? maintUrl : null}
            locked={!received}
            busy={maintBusy}
            onRefresh={loadMaint}
            compact={compact}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">This transfer is closed. Links are unavailable.</p>
      )}

      {received && transfer.receivedLat != null && transfer.receivedLng != null ? (
        <div className="panel space-y-2 p-4">
          <h3 className="text-sm font-semibold">Receive location</h3>
          <p className="font-mono text-sm">
            {transfer.receivedLat.toFixed(6)}, {transfer.receivedLng.toFixed(6)}
            {transfer.receivedAccuracyM != null
              ? ` · ±${Math.round(transfer.receivedAccuracyM)}m`
              : ""}
          </p>
          <a
            className="text-sm text-accent underline"
            href={mapsUrl(transfer.receivedLat, transfer.receivedLng)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>
        </div>
      ) : null}

      {transfer.fieldEvents?.length ? (
        <div>
          <h3 className="display text-xl">Maintenance timeline</h3>
          <ul className="mt-3 space-y-3">
            {transfer.fieldEvents.map((ev) => (
              <li key={ev.id} className="panel flex flex-wrap gap-3 p-3">
                <FieldEventPhoto transferId={id} event={ev} />
                <div className="min-w-[10rem] flex-1 space-y-1 text-sm">
                  <p className="font-mono text-xs">{ev.serialNumber}</p>
                  <p>
                    {ev.performedByName} · {ev.performedByPhone}
                  </p>
                  <p className="text-ink-muted">{formatDateTime(ev.createdAt)}</p>
                  <a
                    className="text-accent underline"
                    href={mapsUrl(ev.lat, ev.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ev.lat.toFixed(5)}, {ev.lng.toFixed(5)}
                    {ev.accuracyM != null ? ` (±${Math.round(ev.accuracyM)}m)` : ""}
                  </a>
                  {ev.notes ? <p className="mt-1">{ev.notes}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : received && maint === "pending" ? (
        <p className="text-sm text-ink-muted">
          No maintenance visits yet. Share the maintenance link to collect the first proof.
        </p>
      ) : null}

      {transfer.verificationLogs?.length ? (
        <div>
          <h3 className="text-sm font-semibold">Verification attempts</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {transfer.verificationLogs.map((l) => (
              <li key={l.id}>
                <StatusBadge value={l.result} /> {l.scannedSerialNumber} ·{" "}
                {formatDateTime(l.attemptedAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {showFullPageLink ? (
          <Link href={`/transfers/${id}`} className="text-sm text-accent underline">
            Open full page
          </Link>
        ) : null}
        {showCancel && pending ? (
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await transfersApi.cancel(id);
                toast.success("Transfer cancelled");
                await qc.invalidateQueries({ queryKey: ["transfer", id] });
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
    </div>
  );
}
