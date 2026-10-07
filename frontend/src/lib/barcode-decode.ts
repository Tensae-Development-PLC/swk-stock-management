import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmap | HTMLCanvasElement | HTMLImageElement) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const HINTS = (() => {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
})();

function scoreSerial(value: string) {
  const s = value.trim();
  let score = s.length;
  if (/[A-Za-z]/.test(s) && /\d/.test(s)) score += 40;
  if (/^[A-Z0-9]{12,}$/i.test(s)) score += 25;
  if (/^\d{8}$/.test(s)) score -= 30; // likely manufacture date
  if (/^\d{3}-\d+$/.test(s)) score -= 10;
  return score;
}

export function pickBestSerial(candidates: string[]) {
  const unique = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
  if (!unique.length) return null;
  unique.sort((a, b) => scoreSerial(b) - scoreSerial(a));
  return unique[0] ?? null;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasFromImage(img: HTMLImageElement, scale = 1, contrast = 1) {
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  if (contrast !== 1) {
    const data = ctx.getImageData(0, 0, w, h);
    const mid = 128;
    for (let i = 0; i < data.data.length; i += 4) {
      const g = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
      const v = Math.min(255, Math.max(0, (g - mid) * contrast + mid));
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

async function decodeNative(source: ImageBitmap | HTMLCanvasElement | HTMLImageElement) {
  if (typeof window === "undefined" || !window.BarcodeDetector) return [];
  try {
    const detector = new window.BarcodeDetector({
      formats: ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "data_matrix"],
    });
    const codes = await detector.detect(source);
    return codes.map((c) => c.rawValue).filter(Boolean);
  } catch {
    return [];
  }
}

async function decodeZxing(canvas: HTMLCanvasElement) {
  try {
    const reader = new BrowserMultiFormatReader(HINTS, {
      delayBetweenScanAttempts: 0,
      delayBetweenScanSuccess: 0,
    });
    const result = reader.decodeFromCanvas(canvas);
    const text = result?.getText?.();
    return text ? [text] : [];
  } catch {
    return [];
  }
}

async function decodeHtml5(file: File, elementId: string) {
  const scanner = new Html5Qrcode(elementId, {
    formatsToSupport: [
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
    ],
    verbose: false,
  });
  try {
    const text = await scanner.scanFile(file, /* showImage */ false);
    return text ? [String(text)] : [];
  } catch {
    return [];
  } finally {
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  }
}

/** Try native → ZXing (multi-scale/contrast) → html5-qrcode. */
export async function decodeBarcodeFromFile(file: File, html5ElementId: string) {
  const found: string[] = [];
  const push = (values: string[]) => {
    for (const v of values) {
      if (v?.trim()) found.push(v.trim());
    }
  };

  try {
    const bitmap = await createImageBitmap(file);
    push(await decodeNative(bitmap));
    bitmap.close();
  } catch {
    /* ignore */
  }

  if (!pickBestSerial(found)) {
    try {
      const img = await loadImage(file);
      push(await decodeNative(img));

      const variants: Array<[number, number]> = [
        [1, 1],
        [1.5, 1],
        [2, 1.4],
        [2.5, 1.8],
        [1.2, 2.2],
        [0.75, 1.6],
      ];
      for (const [scale, contrast] of variants) {
        if (pickBestSerial(found)) break;
        const canvas = canvasFromImage(img, scale, contrast);
        push(await decodeNative(canvas));
        push(await decodeZxing(canvas));
      }
    } catch {
      /* ignore */
    }
  }

  if (!pickBestSerial(found)) {
    push(await decodeHtml5(file, html5ElementId));
  }

  return pickBestSerial(found);
}
