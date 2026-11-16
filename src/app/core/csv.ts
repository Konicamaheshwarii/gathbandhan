import { formatDateNumeric } from './format';
import { Contribution, ContributionStatus, EVENT_META, Rsvp, SIDES, Side, Wedding } from './models';

export const STATUS_LABEL: Record<ContributionStatus, string> = {
  'guest-confirmed': 'Guest confirmed',
  verified: 'Verified',
  pending: 'Payment pending',
  paid: 'Paid (Razorpay)',
  failed: 'Payment failed',
};

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection from guest-typed text. */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sideLabel(side: Side | undefined): string {
  return SIDES.find((s) => s.id === side)?.label ?? '';
}

export function contributionsCsv(wedding: Wedding, contributions: readonly Contribution[]): string {
  const goalTitle = new Map(wedding.goals.map((g) => [g.id, g.title]));
  const header = ['Date', 'Guest', 'Side', 'Goal', 'Amount (INR)', 'Status', 'Paid via', 'Payment ID', 'Order ID', 'Guest paid (INR)', 'Fees (INR)', 'Message', 'Phone', 'Thanked'];
  const rows = [...contributions]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => [
      formatDateNumeric(c.createdAt),
      c.guestName,
      sideLabel(c.side),
      goalTitle.get(c.goalId) ?? '(removed goal)',
      c.amount,
      STATUS_LABEL[c.status],
      c.provider === 'razorpay' ? 'Razorpay' : 'UPI direct',
      c.razorpayPaymentId ?? '',
      c.razorpayOrderId ?? '',
      c.chargedAmount !== undefined ? c.chargedAmount.toFixed(2) : c.amount,
      (c.fee ?? 0).toFixed(2),
      c.message,
      c.phone ?? '',
      c.thankedAt ? 'Yes' : 'No',
    ]);
  return toCsv([header, ...rows]);
}

/** People attending one function (the sum of party sizes). */
export function headcount(rsvps: readonly Rsvp[], eventId: string): number {
  return rsvps.filter((r) => r.eventIds.includes(eventId)).reduce((t, r) => t + r.partySize, 0);
}

/** One row per RSVP with the functions spelled out, then a headcount row per function. */
export function rsvpsCsv(wedding: Wedding, rsvps: readonly Rsvp[]): string {
  const events = wedding.events ?? [];
  const name = new Map(events.map((e) => [e.id, e.name || EVENT_META[e.kind].label]));
  const header = ['Date', 'Guest', 'Side', 'People', 'Attending', 'Phone', 'Note'];
  const rows: unknown[][] = [...rsvps]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => [
      formatDateNumeric(r.createdAt),
      r.guestName,
      sideLabel(r.side),
      r.partySize,
      r.eventIds.map((id) => name.get(id) ?? '(removed function)').join('; '),
      r.phone ?? '',
      r.note,
    ]);
  const totals = events.map((e) => ['', `Total: ${name.get(e.id)}`, '', headcount(rsvps, e.id), '', '', '']);
  return toCsv([header, ...rows, ...(totals.length ? [[], ...totals] : [])]);
}

function toCsv(rows: unknown[][]): string {
  // BOM so Excel opens ₹ and Devanagari text as UTF-8.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
