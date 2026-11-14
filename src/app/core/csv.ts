import { formatDateNumeric } from './format';
import { Contribution, Wedding } from './models';

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection from guest-typed text. */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function contributionsCsv(wedding: Wedding, contributions: readonly Contribution[]): string {
  const goalTitle = new Map(wedding.goals.map((g) => [g.id, g.title]));
  const header = ['Date', 'Guest', 'Goal', 'Amount (INR)', 'Status', 'Message', 'Phone', 'Thanked'];
  const rows = [...contributions]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => [
      formatDateNumeric(c.createdAt),
      c.guestName,
      goalTitle.get(c.goalId) ?? '(removed goal)',
      c.amount,
      c.status === 'verified' ? 'Verified' : 'Guest confirmed',
      c.message,
      c.phone ?? '',
      c.thankedAt ? 'Yes' : 'No',
    ]);
  // BOM so Excel opens ₹ and Devanagari text as UTF-8.
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
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
