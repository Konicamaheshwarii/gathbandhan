import { MAX_UPI_AMOUNT } from './models';
import { truncateText } from './text';

/**
 * UPI deep links (NPCI "UPI Linking Specification").
 * upi://pay?pa=<vpa>&pn=<payee>&am=<amount>&cu=INR&tn=<note>
 * The guest's UPI app opens with everything filled in and pays the couple directly:
 * no gateway, no backend, no money passes through this app.
 */

/** handle@psp, e.g. riya.arjun@okhdfcbank, 9876543210@ybl */
const VPA = /^[a-zA-Z0-9][a-zA-Z0-9.\-_]{0,255}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA.test((vpa ?? '').trim());
}

export function normalizeVpa(vpa: string): string {
  return (vpa ?? '').trim().toLowerCase();
}

export interface UpiPayment {
  vpa: string;
  payeeName: string;
  amount?: number;
  note?: string;
}

/** Many UPI apps reject notes longer than about 50 characters or containing odd symbols. */
export function upiNote(text: string, max = 50): string {
  const clean = (text ?? '').replace(/[^\p{L}\p{N} .,&'!-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return truncateText(clean, max, '…');
}

export function upiAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_UPI_AMOUNT) {
    throw new Error(`Amount must be between ₹1 and ₹${MAX_UPI_AMOUNT.toLocaleString('en-IN')}.`);
  }
  return amount.toFixed(2);
}

/**
 * Builds the intent URL. The VPA keeps its "@" unescaped because several UPI apps
 * fail to resolve a percent-encoded payee address; everything else is URI-encoded.
 */
export function buildUpiLink(p: UpiPayment): string {
  const vpa = normalizeVpa(p.vpa);
  if (!isValidVpa(vpa)) throw new Error('That does not look like a UPI ID (name@bank).');
  const params = [
    `pa=${vpa}`,
    `pn=${encodeURIComponent(truncateText(p.payeeName.trim(), 50) || vpa)}`,
  ];
  if (p.amount !== undefined) params.push(`am=${upiAmount(p.amount)}`);
  params.push('cu=INR');
  const note = p.note ? upiNote(p.note) : '';
  if (note) params.push(`tn=${encodeURIComponent(note)}`);
  return `upi://pay?${params.join('&')}`;
}

/** Reads a upi:// link back (used by tests and to show what the QR contains). */
export function parseUpiLink(link: string): Record<string, string> {
  const m = /^upi:\/\/pay\?(.*)$/i.exec(link);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const part of m[1].split('&')) {
    const [k, v = ''] = part.split('=');
    out[k] = decodeURIComponent(v);
  }
  return out;
}

/** True on phones and tablets, where upi:// opens an installed UPI app. */
export function canOpenUpiApps(ua = globalThis.navigator?.userAgent ?? ''): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(ua);
}
