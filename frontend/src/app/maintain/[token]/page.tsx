"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Scanner } from "@/components/scanner/scanner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { receivingApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/client";
import { useGeolocation } from "@/hooks/use-geolocation";

export default function MaintainPage() {
  const { token } = useParams<{ token: string }>();
  const preview = useQuery({
    queryKey: ["maintain", token],
    queryFn: () => receivingApi.previewMaintenance(token),
    retry: false,
  });
  const { geo, retry } = useGeolocation(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanned, setScanned] = useState("");
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (preview.isError) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-16">
        <BrandMark />
        <h1 className="display mt-10 text-3xl font-semibold">Maintenance unavailable</h1>
        <p className="mt-3 text-sm text-ink-muted">
          {preview.error instanceof ApiRequestError
            ? preview.error.message
            : "This link is invalid, expired, or the transfer has not been received yet."}
        </p>
      </main>
    );
  }

  const data = preview.data;
  const item = data?.items[0];
  const gpsReady = geo.status === "ready";
  const canSubmit =
    name.trim().length >= 2 &&
    phone.trim().length >= 7 &&
    gpsReady &&
    !!photo &&
    !!scanned;

  const onPhoto = (file: File | null) => {
    setPhoto(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const submit = async (serial?: string) => {
    const serialNumber = (serial ?? scanned).trim();
    if (!serialNumber) {
      toast.error("Scan the product serial first.");
      return;
    }
    if (geo.status !== "ready") {
      toast.error("Location is required before you can submit.");
      return;
    }
    if (!photo) {
      toast.error("Take or upload a photo of the visit.");
      return;
    }
    if (name.trim().length < 2 || phone.trim().length < 7) {
      toast.error("Enter your name and phone.");
      return;
    }
    setBusy(true);
    setScanned(serialNumber);
    try {
      const form = new FormData();
      form.append("serialNumber", serialNumber);
      form.append("performedByName", name.trim());
      form.append("performedByPhone", phone.trim());
      form.append("latitude", String(geo.latitude));
      form.append("longitude", String(geo.longitude));
      form.append("accuracy", String(geo.accuracy));
      if (notes.trim()) form.append("notes", notes.trim());
      form.append("photo", photo);
      const res = await receivingApi.submitMaintenance(token, form);
      setDone(true);
      setMessage(res.message);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-10">
      <BrandMark />
      <p className="mt-10 text-xs font-medium text-ink-muted">SWK-HVACR · Field maintenance</p>
      <h1 className="display mt-2 text-3xl font-semibold leading-tight">
        Log a maintenance visit
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Scan the unit, capture a photo, and share your location.
      </p>

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
            <span className="text-ink-muted">Reference</span>
            <span className="font-mono text-xs">{data.referenceNumber}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-muted">Site</span>
            <span>{data.destination}</span>
          </div>
        </div>
      ) : (
        <div className="mt-8 h-28 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
      )}

      <div className="panel mt-4 p-4 text-sm">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Location</p>
        {geo.status === "loading" ? (
          <p className="mt-2 text-ink-muted">Getting your GPS position…</p>
        ) : geo.status === "ready" ? (
          <p className="mt-2 text-accent">
            Ready · {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)} (±
            {Math.round(geo.accuracy)}m)
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

      {done ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-accent bg-[var(--accent-soft)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Recorded</p>
          <p className="mt-2 text-xl font-semibold">Maintenance visit saved.</p>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              setDone(false);
              setScanned("");
              setNotes("");
              onPhoto(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Log another visit
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="tech-name">Your name</Label>
            <Input
              id="tech-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="tech-phone">Your phone</Label>
            <Input
              id="tech-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Work performed, findings…"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="photo">Visit photo</Label>
            <input
              ref={fileRef}
              id="photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-sm"
              onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Visit preview"
                className="mt-3 max-h-48 w-full rounded-[var(--radius-lg)] object-cover"
              />
            ) : null}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Scan product serial</p>
            <Scanner
              disabled={busy || !gpsReady}
              onDecode={(serial) => {
                setScanned(serial);
                toast.success(`Serial captured: ${serial}`);
              }}
            />
            {scanned ? (
              <p className="mt-2 font-mono text-xs text-ink-muted">Scanned: {scanned}</p>
            ) : null}
          </div>
          <Button loading={busy} disabled={!canSubmit} onClick={() => void submit()}>
            Submit maintenance
          </Button>
        </div>
      )}
    </main>
  );
}
