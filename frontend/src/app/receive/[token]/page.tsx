"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Scanner } from "@/components/scanner/scanner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { receivingApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useGeolocation } from "@/hooks/use-geolocation";

export default function ReceivePage() {
  const { token } = useParams<{ token: string }>();
  const preview = useQuery({
    queryKey: ["receive", token],
    queryFn: () => receivingApi.preview(token),
    retry: false,
  });
  const { geo, retry } = useGeolocation(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [scanned, setScanned] = useState("");
  const [result, setResult] = useState<"ok" | "bad" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (preview.isError) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-16">
        <BrandMark />
        <h1 className="display mt-10 text-3xl font-semibold">Invalid receiving link</h1>
        <p className="mt-3 text-sm text-ink-muted">This link is invalid, expired, or already used.</p>
      </main>
    );
  }

  const data = preview.data;
  const item = data?.items[0];
  const expected = item?.serialNumber ?? "";
  const gpsReady = geo.status === "ready";
  const canScan = name.trim().length >= 2 && phone.trim().length >= 7 && gpsReady;

  const verify = async (serial: string) => {
    if (!canScan || geo.status !== "ready") {
      toast.error(
        geo.status !== "ready"
          ? "Location is required before you can submit."
          : "Enter your name and phone before scanning.",
      );
      return;
    }
    setBusy(true);
    setScanned(serial);
    try {
      const res = await receivingApi.verify(token, {
        serialNumber: serial,
        receiverName: name.trim(),
        receiverPhone: phone.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
      });
      setResult("ok");
      setMessage(res.message);
    } catch (e) {
      setResult("bad");
      setMessage(e instanceof ApiRequestError ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-10">
      <BrandMark />
      <p className="mt-10 text-xs font-medium text-ink-muted">SWK-HVACR · Inventory receipt</p>
      <h1 className="display mt-2 text-3xl font-semibold leading-tight">
        You have been requested to receive an inventory item.
      </h1>

      {data ? (
        <div className="panel mt-8 space-y-3 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-ink-muted">Item</span>
            <span className="text-right font-medium">
              {item?.itemName}
              <span className="block text-ink-muted">{item?.model}</span>
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-muted">Destination</span>
            <span>{data.destination}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-muted">Reference</span>
            <span className="font-mono text-xs">{data.referenceNumber}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-muted">Dispatch</span>
            <span>{formatDate(data.dispatchDate)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-8 h-36 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      )}

      <div className="panel mt-4 p-4 text-sm">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Location</p>
        {geo.status === "loading" ? (
          <p className="mt-2 text-ink-muted">Getting your GPS position…</p>
        ) : geo.status === "ready" ? (
          <p className="mt-2 text-accent">
            Ready · {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)} (±{Math.round(geo.accuracy)}m)
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-danger">{geo.message}</p>
            <Button variant="secondary" onClick={retry}>
              Retry location
            </Button>
          </div>
        )}
      </div>

      {result === "ok" ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-accent bg-[var(--accent-soft)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            Serial verified
          </p>
          <p className="mt-2 text-xl font-semibold">Inventory successfully received.</p>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <p className="mt-4 text-sm">
            Received by {name.trim()} · {phone.trim()} · {data?.destination}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="receiver-name">Your name</Label>
            <Input
              id="receiver-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="receiver-phone">Your phone</Label>
            <Input
              id="receiver-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              autoComplete="tel"
              inputMode="tel"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Name, phone, and location are required. You do not need an SWK account.
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Scan product</p>
            <Scanner disabled={busy || !canScan} onDecode={verify} />
            {!gpsReady ? (
              <p className="mt-2 text-xs text-ink-muted">Scanner unlocks after location is ready.</p>
            ) : null}
          </div>
          {result === "bad" ? (
            <div className="rounded-[var(--radius-lg)] border border-danger bg-[var(--danger-soft)] p-4 text-sm">
              <p className="font-semibold text-danger">Serial number mismatch</p>
              <div className="mt-3 space-y-1">
                <p>
                  Expected: <span className="font-mono">{expected}</span>
                </p>
                <p>
                  Scanned: <span className="font-mono">{scanned}</span>
                </p>
              </div>
              <p className="mt-3 text-ink-muted">{message || "Please scan the correct product."}</p>
              <Button className="mt-4" variant="secondary" onClick={() => setResult(null)}>
                Scan again
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
