import { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { encode } from 'uqr';

/** A square PNG for photo uploads (the app's own icon). */
export function photoFile(name = 'photo.png'): { name: string; mimeType: string; buffer: Buffer } {
  return { name, mimeType: 'image/png', buffer: readFileSync(join(__dirname, '..', '..', 'public', 'icons', 'icon-512.png')) };
}

/** A "Receive money" QR, as UPI apps show it, as a PNG screenshot (black on white, quiet zone). */
export function upiQrFile(payload: string, name = 'gpay-qr.png'): { name: string; mimeType: string; buffer: Buffer } {
  return { name, mimeType: 'image/png', buffer: qrPng(payload) };
}

function qrPng(text: string, scale = 8, border = 4): Buffer {
  const { data } = encode(text, { border });
  const n = data.length;
  const size = n * scale;
  const raw = Buffer.alloc((size + 1) * size, 255);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) if (data[Math.floor(y / scale)][Math.floor(x / scale)]) raw[y * (size + 1) + 1 + x] = 0;
  }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

/** Signs in to a local demo account and finishes (or skips) the welcome step. */
export async function demoSignIn(page: Page, opts: { email?: string; name?: string; upi?: string; language?: string; role?: string } = {}): Promise<void> {
  await page.goto('./#/login');
  await page.getByLabel('Your email').fill(opts.email ?? 'couple.demo@example.com');
  await page.getByRole('button', { name: 'Sign in to the demo' }).click();
  await page.getByRole('heading', { name: 'Namaste! Tell us about you' }).waitFor();
  if (opts.name) {
    await page.getByLabel('Your name').fill(opts.name);
    if (opts.role) await page.getByRole('radio', { name: new RegExp(opts.role) }).click();
    if (opts.language) await page.getByRole('radio', { name: opts.language }).click();
    await page.getByRole('button', { name: 'Save and continue' }).click();
  } else {
    await page.getByRole('button', { name: 'Skip for now' }).click();
  }
  await page.waitForURL(/#\/account$/);
  if (opts.upi) {
    await page.getByLabel('Default UPI ID').fill(opts.upi);
    await page.getByLabel('Payee name').fill(opts.name ?? 'Demo Couple');
    await page.getByRole('button', { name: 'Save payment details' }).click();
    await page.locator('#payments').getByText('Saved').waitFor();
  }
}

/** Creates a wedding page with "Try with sample details" and AI-suggested dreams; ends on its dashboard. */
export async function createSamplePage(page: Page): Promise<string> {
  await page.goto('./#/create');
  await page.getByRole('button', { name: 'Try with sample details' }).click();
  await page.getByRole('button', { name: 'Suggest dreams and amounts' }).click();
  await page.getByRole('button', { name: 'Replace my dreams with these' }).click();
  await page.getByRole('button', { name: 'Create my page' }).click();
  await page.waitForURL(/#\/w\/[^/]+\/dashboard$/);
  return /#\/w\/([^/]+)\/dashboard$/.exec(page.url())![1];
}
