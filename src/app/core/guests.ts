import { formatDate } from './format';
import { Guest, GuestStatus, MAX_GUESTS, Side, Wedding } from './models';
import { normalizeIndianPhone } from './share';
import { firstName, uid } from './util';
import { appBaseUrl } from './wedding-link';

const TOKEN_CHARS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 10 unambiguous characters (about 58 bits): unguessable, and short enough for WhatsApp. */
export function newGuestToken(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => TOKEN_CHARS[b % TOKEN_CHARS.length]).join('');
}

export function isGuestToken(token: string | null | undefined): token is string {
  return !!token && /^[A-Za-z0-9]{8,24}$/.test(token);
}

/** The furthest step a guest has reached. */
export function guestStatus(g: Guest): GuestStatus {
  return g.gaveAt ? 'gave' : g.rsvpAt ? 'rsvp' : g.openedAt ? 'opened' : g.sentAt ? 'sent' : 'not-sent';
}

export function guestGreeting(g: Pick<Guest, 'name' | 'greeting'>): string {
  return g.greeting?.trim() || g.name.trim();
}

export function inviteUrl(slug: string, token?: string, base = appBaseUrl()): string {
  return `${base}#/i/${slug}${token ? `/${token}` : ''}`;
}

/** The WhatsApp message each guest gets, with their personal link. */
export function inviteWhatsappText(w: Wedding, g: Pick<Guest, 'name' | 'greeting'>, url: string, language: string = w.invite?.language ?? 'english'): string {
  const couple = `${firstName(w.partner1)} & ${firstName(w.partner2)}`;
  const date = formatDate(w.date);
  const dear = guestGreeting(g);
  switch (language) {
    case 'hindi':
      return `🙏 ${dear} जी,\n\n${couple} के शुभ विवाह (${date}, ${w.city || w.venue}) में आप सपरिवार सादर आमंत्रित हैं।\n\nआपका निमंत्रण पत्र यहाँ है 💌\n${url}\n\nकृपया RSVP करें। आपके आशीर्वाद की प्रतीक्षा रहेगी।`;
    case 'gujarati':
      return `🙏 ${dear},\n\n${couple}ના શુભ લગ્ન (${date}, ${w.city || w.venue}) પ્રસંગે આપને સહપરિવાર પધારવા ભાવભર્યું આમંત્રણ છે.\n\nઆપની કંકોત્રી અહીં છે 💌\n${url}\n\nકૃપા કરીને RSVP કરશો.`;
    case 'hinglish':
      return `🙏 ${dear},\n\n${couple} ki shaadi (${date}, ${w.city || w.venue}) mein aap sabko zaroor aana hai!\n\nAapka invite yahan hai 💌\n${url}\n\nPlease RSVP kar dena. Milte hain! 🎉`;
    default:
      return `🙏 Dear ${dear},\n\nWith great joy, we invite you and your family to the wedding of ${couple} on ${date}${w.city ? ` in ${w.city}` : ''}.\n\nYour invitation is here 💌\n${url}\n\nPlease RSVP so we can plan for you. Your presence is our blessing.`;
  }
}

export interface ParsedGuests {
  guests: Pick<Guest, 'name' | 'phone' | 'side' | 'group' | 'greeting'>[];
  skipped: number;
}

const SIDE_WORDS: [RegExp, Side][] = [
  [/^(bride|bride'?s|ladkiwale|ladki|kanya|b)$/i, 'bride'],
  [/^(groom|groom'?s|ladkewale|ladka|var|g)$/i, 'groom'],
];

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === '\t' || ch === ';') { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Reads guests from a CSV file or text pasted from contacts / Excel / WhatsApp. Columns are found
 * by header (name, phone/mobile, side, group, greeting) or guessed per cell: a phone number,
 * a side word, and the rest is name then group.
 */
export function parseGuestList(text: string): ParsedGuests {
  const lines = (text ?? '').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { guests: [], skipped: 0 };
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const hasHeader = col(/^(name|guest|full name)/) >= 0;
  const idx = { name: col(/^(name|guest|full name)/), phone: col(/phone|mobile|whatsapp|number/), side: col(/side/), group: col(/group|family|circle/), greeting: col(/greeting|address as|dear/) };
  const guests: ParsedGuests['guests'] = [];
  let skipped = 0;
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCsvLine(line);
    let name = '';
    let phone: string | null = null;
    let side: Side | undefined;
    let group = '';
    let greeting = '';
    if (hasHeader) {
      name = cells[idx.name] ?? '';
      phone = idx.phone >= 0 ? normalizeIndianPhone(cells[idx.phone] ?? '') : null;
      side = idx.side >= 0 ? SIDE_WORDS.find(([re]) => re.test(cells[idx.side] ?? ''))?.[1] : undefined;
      group = idx.group >= 0 ? cells[idx.group] ?? '' : '';
      greeting = idx.greeting >= 0 ? cells[idx.greeting] ?? '' : '';
    } else {
      // "Sunita Mausi +91 98220 12345" pasted from contacts: pull the number out of the text.
      const parts = cells.length === 1 ? [cells[0].replace(/(\+?[\d][\d\s-]{8,}\d)/, '').trim(), (cells[0].match(/\+?[\d][\d\s-]{8,}\d/) ?? [''])[0]] : cells;
      const rest: string[] = [];
      for (const cell of parts.filter(Boolean)) {
        const p = normalizeIndianPhone(cell);
        const s = SIDE_WORDS.find(([re]) => re.test(cell))?.[1];
        if (p && !phone) phone = p;
        else if (s && !side) side = s;
        else rest.push(cell);
      }
      [name = '', group = ''] = rest;
    }
    name = name.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length < 2) {
      skipped++;
      continue;
    }
    guests.push({
      name,
      ...(phone ? { phone } : {}),
      ...(side ? { side } : {}),
      ...(group.trim() ? { group: group.trim().slice(0, 60) } : {}),
      ...(greeting.trim() ? { greeting: greeting.trim().slice(0, 80) } : {}),
    });
    if (guests.length >= MAX_GUESTS) break;
  }
  return { guests, skipped };
}

/** New guest records, skipping anyone already on the list (same phone, or same name without a phone). */
export function mergeGuests(weddingId: string, existing: readonly Guest[], incoming: ParsedGuests['guests'], now = Date.now()): Guest[] {
  const phones = new Set(existing.map((g) => g.phone).filter(Boolean));
  const names = new Set(existing.map((g) => g.name.toLowerCase()));
  const out: Guest[] = [];
  for (const g of incoming) {
    if (g.phone ? phones.has(g.phone) : names.has(g.name.toLowerCase())) continue;
    if (g.phone) phones.add(g.phone);
    names.add(g.name.toLowerCase());
    out.push({ ...g, id: uid('gu'), weddingId, token: newGuestToken(), createdAt: now });
  }
  return out;
}

/** Remembers which personal invite this browser opened, so RSVP and shagun can tick that guest off. */
const tokenKey = (weddingId: string) => `sg.guest.${weddingId}`;

export function rememberGuestToken(weddingId: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(weddingId), token);
  } catch {
    // storage blocked: status tracking simply stops at "opened"
  }
}

export function recalledGuestToken(weddingId: string): string | null {
  try {
    const t = localStorage.getItem(tokenKey(weddingId));
    return isGuestToken(t) ? t : null;
  } catch {
    return null;
  }
}
