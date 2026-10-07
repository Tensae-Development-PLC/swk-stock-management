"use client";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { decodeBarcodeFromFile } from "@/lib/barcode-decode";
import { toast } from "sonner";

const CAMERA_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

export function Scanner({
  onDecode,
  disabled,
}: {
  onDecode: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decodingFile, setDecodingFile] = useState(false);
  const id = useRef(`scan-${Math.random().toString(36).slice(2)}`);
  const fileId = useRef(`scan-file-${Math.random().toString(36).slice(2)}`);
  const fileInput = useRef<HTMLInputElement>(null);
  const cb = useRef(onDecode);
  cb.current = onDecode;

  useEffect(() => {
    if (!open) return;
    const scanner = new Html5Qrcode(id.current, {
      formatsToSupport: CAMERA_FORMATS,
      verbose: false,
    });
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 280, height: 160 }, aspectRatio: 1.777 },
        (text) => {
          cb.current(text.trim());
          void scanner.stop();
          setOpen(false);
        },
        () => undefined,
      )
      .catch(() =>
        setError("Camera permission was denied. Enter the serial manually or upload an image."),
      );
    return () => {
      scanner.stop().catch(() => undefined);
    };
  }, [open]);

  const submitManual = () => {
    if (!manual.trim() || disabled) return;
    cb.current(manual.trim());
    setManual("");
  };

  const onFile = async (file: File | null) => {
    if (!file || disabled) return;
    setDecodingFile(true);
    setError(null);
    try {
      const text = await decodeBarcodeFromFile(file, fileId.current);
      if (!text) {
        setError(
          "Could not decode a barcode or QR from that image. Try a closer, flatter photo of the barcode, or enter the serial under the bars (e.g. SFF0…).",
        );
        toast.error("No barcode found in image");
        return;
      }
      cb.current(text);
      toast.success(`Serial decoded: ${text}`);
    } catch {
      setError("Could not read that image. Try another photo or enter the serial manually.");
      toast.error("Image decode failed");
    } finally {
      setDecodingFile(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={manual}
          disabled={disabled}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Type or paste serial number"
          onKeyDown={(e) => {
            if (e.key === "Enter") submitManual();
          }}
          className="min-w-[200px] flex-1"
        />
        <Button type="button" variant="secondary" disabled={disabled} onClick={submitManual}>
          Add
        </Button>
        <Button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}>
          {open ? "Close camera" : "Scan barcode"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || decodingFile}
          onClick={() => fileInput.current?.click()}
        >
          <ImageUp className="h-3.5 w-3.5" />
          {decodingFile ? "Reading…" : "Upload image"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <p className="text-xs text-ink-muted">
        Upload prefers the long serial under the 1D barcode. Camera and image decode locally — only the
        serial is sent to the API.
      </p>
      {open ? (
        <div className="scan-frame overflow-hidden rounded-[var(--radius-lg)] border border-line">
          <div id={id.current} className="mx-auto max-w-sm" />
        </div>
      ) : null}
      <div id={fileId.current} className="hidden" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
