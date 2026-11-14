import { encode } from 'uqr';

export interface QrMatrix {
  /** Modules per side, including the quiet zone. */
  size: number;
  /** One SVG path covering every dark module. */
  path: string;
  version: number;
}

/**
 * Encodes text as a QR code and returns a compact SVG path, so the component can style it
 * (colours, rounded frame) without injecting third-party HTML.
 */
export function qrMatrix(text: string, ecc: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  const qr = encode(text, { ecc, border: 2 });
  let path = '';
  qr.data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      const start = x;
      while (x < row.length && row[x]) x++;
      path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  });
  return { size: qr.size, path, version: qr.version };
}
