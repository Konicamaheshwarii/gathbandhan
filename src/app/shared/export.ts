import { buildPdf, jpegSize } from '../core/pdf';

export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1920;

/** 1x1 transparent PNG used when an image (for example an AI background) cannot be fetched. */
const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let fontCss: Promise<string> | null = null;

/** Draws a page element at WhatsApp-story size (1080×1920). html-to-image is loaded only when needed. */
export async function renderPage(node: HTMLElement): Promise<HTMLCanvasElement> {
  const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
  await document.fonts?.ready;
  fontCss ??= getFontEmbedCSS(node).catch(() => '');
  const css = await fontCss;
  const scale = EXPORT_WIDTH / node.offsetWidth;
  return toCanvas(node, {
    pixelRatio: scale,
    width: node.offsetWidth,
    height: node.offsetHeight,
    canvasWidth: node.offsetWidth,
    canvasHeight: node.offsetHeight,
    fontEmbedCSS: css,
    imagePlaceholder: PLACEHOLDER,
    cacheBust: false,
    filter: (n) => !(n instanceof HTMLElement && n.dataset['noExport'] !== undefined),
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the page.'))), type, quality));
}

export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function pagePng(node: HTMLElement): Promise<Blob> {
  return toBlob(await renderPage(node), 'image/png');
}

/** Every page as one PDF (JPEG pages keep it small enough for WhatsApp). */
export async function pagesPdf(nodes: HTMLElement[], title: string): Promise<Blob> {
  const images = [];
  for (const node of nodes) {
    const blob = await toBlob(await renderPage(node), 'image/jpeg', 0.9);
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const size = jpegSize(jpeg) ?? { width: EXPORT_WIDTH, height: EXPORT_HEIGHT };
    images.push({ jpeg, ...size });
  }
  return new Blob([buildPdf(images, title) as BlobPart], { type: 'application/pdf' });
}
