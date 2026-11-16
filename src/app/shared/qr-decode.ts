/**
 * Finds and reads a QR code in an image, entirely on this device: the image is never uploaded
 * or stored. Uses the browser's BarcodeDetector where it exists (Android Chrome, macOS), and
 * otherwise a small decoder (jsQR) that is downloaded only the first time it is needed.
 */

type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (opts: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

export class QrImageError extends Error {
  constructor(readonly kind: 'no-qr' | 'unreadable') {
    super(kind);
  }
}

/** Longest side the image is scaled to; large phone photos decode faster and no worse. */
const SIZES = [1400, 800];

async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
    return formats.includes('qr_code') ? new Ctor({ formats: ['qr_code'] }) : null;
  } catch {
    return null;
  }
}

function pixels(bitmap: ImageBitmap, maxSide: number): ImageData {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // White behind transparent PNGs, so dark modules stay dark.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Returns the QR's text, or throws QrImageError('no-qr' | 'unreadable'). */
export async function decodeQrImage(file: Blob, opts: { native?: boolean } = {}): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new QrImageError('unreadable');
  }
  try {
    const detector = opts.native === false ? null : await nativeDetector();
    if (detector) {
      try {
        const found = await detector.detect(bitmap);
        if (found[0]?.rawValue) return found[0].rawValue;
      } catch {
        // fall through to jsQR
      }
    }
    const { default: jsQR } = await import('jsqr');
    for (const size of SIZES) {
      const img = pixels(bitmap, size);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) return code.data;
    }
    throw new QrImageError('no-qr');
  } finally {
    bitmap.close();
  }
}
