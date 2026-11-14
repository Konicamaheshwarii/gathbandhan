/**
 * A minimal PDF writer: one full-bleed JPEG per page. Enough for a WhatsApp-ready invite PDF
 * without shipping a 300 kB PDF library. JPEG data is embedded as-is (DCTDecode).
 */
export interface PdfImage {
  jpeg: Uint8Array;
  /** Pixel size of the JPEG. */
  width: number;
  height: number;
}

const enc = new TextEncoder();

export function jpegSize(jpeg: Uint8Array): { width: number; height: number } | null {
  // Walk the JPEG markers to the start-of-frame segment.
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    const marker = jpeg[i + 1];
    const length = (jpeg[i + 2] << 8) | jpeg[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (jpeg[i + 5] << 8) | jpeg[i + 6], width: (jpeg[i + 7] << 8) | jpeg[i + 8] };
    }
    i += 2 + length;
  }
  return null;
}

/** Builds the PDF. Page size in points keeps the images' aspect ratio, 720 pt (10 in) tall. */
export function buildPdf(images: PdfImage[], title = 'Wedding invitation'): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = images.length;
  // ids: 1 catalog, 2 pages, 3 info, then per page: page, content, image
  const pageId = (i: number) => 4 + i * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${images.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${n} >>`);
  const safeTitle = title.replace(/[\\()]/g, '').replace(/[^\x20-\x7e]/g, '');
  object(3, `<< /Title (${safeTitle}) /Producer (Gathbandhan) >>`);
  images.forEach((img, i) => {
    const h = 720;
    const w = Math.round((img.width / img.height) * h * 100) / 100;
    const content = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    object(pageId(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${pageId(i) + 2} 0 R >> >> /Contents ${pageId(i) + 1} 0 R >>`);
    object(pageId(i) + 1, `<< /Length ${content.length} >>`, content);
    object(
      pageId(i) + 2,
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`,
      img.jpeg,
    );
  });
  const count = 4 + n * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
