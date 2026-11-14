import { EVENT_META, Wedding, WeddingEvent } from './models';

/**
 * Calendar entries for the wedding functions. India has no daylight saving, so IST is always
 * UTC+05:30 and times can be written in UTC, which every calendar app understands.
 */

const IST_OFFSET_MIN = 330;
const DEFAULT_HOURS = 3;

/** "2026-12-12" + "19:30" (IST) -> Date in UTC, or null when either part is malformed. */
export function istToDate(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time || '00:00');
  if (!d || !t) return null;
  return new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - IST_OFFSET_MIN * 60_000);
}

export function eventRange(e: WeddingEvent): { start: Date; end: Date } | null {
  const start = istToDate(e.date, e.time);
  if (!start) return null;
  let end = e.endTime ? istToDate(e.date, e.endTime) : null;
  // An end time earlier than the start means the function runs past midnight.
  if (end && end <= start) end = new Date(end.getTime() + 86_400_000);
  return { start, end: end ?? new Date(start.getTime() + DEFAULT_HOURS * 3_600_000) };
}

/** 20261212T140000Z */
export function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 TEXT escaping. */
export function icsEscape(text: string): string {
  return (text ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds content lines at 75 octets, as RFC 5545 requires (multi-byte characters are kept whole). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function eventName(e: WeddingEvent): string {
  return e.name?.trim() || EVENT_META[e.kind]?.label || 'Wedding function';
}

export function eventTitle(w: Wedding, e: WeddingEvent): string {
  return `${eventName(e)}: ${w.partner1.split(' ')[0]} & ${w.partner2.split(' ')[0]}`;
}

function eventDetails(e: WeddingEvent, pageUrl: string): string {
  return [e.dressCode ? `Dress code: ${e.dressCode}` : '', safeUrl(e.mapsUrl) ? `Map: ${e.mapsUrl}` : '', pageUrl ? `Wedding page: ${pageUrl}` : '']
    .filter(Boolean)
    .join('\n');
}

export function eventLocation(e: WeddingEvent): string {
  return [e.venue, e.address].map((s) => s?.trim()).filter(Boolean).join(', ');
}

/** An .ics file with one VEVENT per function. */
export function weddingIcs(w: Wedding, events: readonly WeddingEvent[], pageUrl = '', now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shagun//Wedding functions//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    const range = eventRange(e);
    if (!range) continue;
    const location = eventLocation(e);
    const details = eventDetails(e, pageUrl);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}.${w.id}@shagun`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsStamp(range.start)}`,
      `DTEND:${icsStamp(range.end)}`,
      `SUMMARY:${icsEscape(eventTitle(w, e))}`,
      ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
      ...(details ? [`DESCRIPTION:${icsEscape(details)}`] : []),
      ...(pageUrl ? [`URL:${pageUrl}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** "Add to Google Calendar" link for one function. */
export function googleCalendarUrl(w: Wedding, e: WeddingEvent, pageUrl = ''): string {
  const range = eventRange(e);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: eventTitle(w, e) });
  if (range) params.set('dates', `${icsStamp(range.start)}/${icsStamp(range.end)}`);
  const details = eventDetails(e, pageUrl);
  if (details) params.set('details', details);
  if (eventLocation(e)) params.set('location', eventLocation(e));
  params.set('ctz', 'Asia/Kolkata');
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Events sorted by date and time. */
export function sortEvents(events: readonly WeddingEvent[] = []): WeddingEvent[] {
  return [...events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

/** "19:30" -> "7:30 pm" */
export function formatTime(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  if (!m) return time ?? '';
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

/** Only http(s) links are rendered (guards against javascript: URLs in shared data). */
export function safeUrl(url: string | undefined): string {
  const u = (url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(u) ? u : '';
}

/** The couple's map link, or a Google Maps search for the venue and address. */
export function mapsUrl(e: WeddingEvent): string {
  const q = eventLocation(e);
  return safeUrl(e.mapsUrl) || (q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '');
}
