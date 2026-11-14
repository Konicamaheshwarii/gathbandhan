/** Indian formatting: rupees with lakh grouping and dates in day-month-year order. */

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 300000 -> "₹3,00,000" */
export function formatInr(amount: number): string {
  return inr.format(Math.round(amount || 0));
}

/** 300000 -> "3,00,000" */
export function groupIndian(amount: number): string {
  return grouped.format(Math.round(amount || 0));
}

/** Short form for tight spaces: ₹4.5 L, ₹1.2 Cr, ₹75K. */
export function formatInrShort(amount: number): string {
  const n = Math.round(amount || 0);
  const trim = (v: number) => String(Number(v.toFixed(v < 10 ? 2 : 1)));
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  if (n >= 1e3) return `₹${trim(n / 1e3)}K`;
  return `₹${n}`;
}

/** Parses "2,100", "₹ 2100", "2100.00". Returns NaN for anything that is not a positive number. */
export function parseAmount(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  if (typeof input !== 'string') return NaN;
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}

/** "2026-12-12" -> "12 Dec 2026" */
export function formatDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso;
}

/** "2026-12-12" -> "Saturday, 12 December 2026" */
export function formatDateLong(iso: string): string {
  const d = parseIsoDate(iso);
  return d
    ? new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
    : iso;
}

/** dd/mm/yyyy, the format Indian spreadsheets expect. */
export function formatDateNumeric(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Days from today (local) to the wedding. Negative once it is over. */
export function daysUntil(iso: string, now = new Date()): number {
  const d = parseIsoDate(iso);
  if (!d) return NaN;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today) / 86_400_000);
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return formatDateNumeric(ms);
}
