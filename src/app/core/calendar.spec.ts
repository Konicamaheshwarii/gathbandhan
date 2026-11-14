import { eventRange, foldLine, formatTime, googleCalendarUrl, icsEscape, istToDate, mapsUrl, safeUrl, sortEvents, weddingIcs } from './calendar';
import { rsvpsCsv, headcount } from './csv';
import { Rsvp, WeddingEvent } from './models';
import { wedding } from './testing';

const sangeet: WeddingEvent = {
  id: 'e1', kind: 'sangeet', name: 'Sangeet', date: '2026-12-11', time: '19:30', endTime: '01:00',
  venue: 'Durbar Hall', address: 'City Palace, Udaipur', dressCode: 'Indo-western; bring dancing shoes',
};
const haldi: WeddingEvent = { id: 'e0', kind: 'haldi', name: '', date: '2026-12-11', time: '10:00', venue: 'Lawns' };

describe('calendar', () => {
  it('converts Indian time to UTC (IST is always +05:30)', () => {
    expect(istToDate('2026-12-12', '19:30')!.toISOString()).toBe('2026-12-12T14:00:00.000Z');
    expect(istToDate('2026-12-12', '03:00')!.toISOString()).toBe('2026-12-11T21:30:00.000Z');
    expect(istToDate('2026-12-12', '25:00')).toBeNull();
    expect(istToDate('12/12/2026', '10:00')).toBeNull();
  });

  it('runs past midnight when the end time is earlier, and defaults to three hours', () => {
    const r = eventRange(sangeet)!;
    expect(r.end.toISOString()).toBe('2026-12-11T19:30:00.000Z');
    const h = eventRange(haldi)!;
    expect(h.end.getTime() - h.start.getTime()).toBe(3 * 3_600_000);
  });

  it('writes a valid .ics with escaped text and folded lines', () => {
    const ics = weddingIcs(wedding({ events: [sangeet] }), [sangeet], 'https://x.github.io/s/#/w/asha-weds-dev', new Date(Date.UTC(2026, 0, 1)));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBeTrue();
    expect(ics).toContain('DTSTART:20261211T140000Z');
    expect(ics).toContain('DTEND:20261211T193000Z');
    expect(ics).toContain('SUMMARY:Sangeet: Asha & Dev');
    expect(ics).toContain('LOCATION:Durbar Hall\\, City Palace\\, Udaipur');
    expect(ics).toContain('Indo-western\\; bring dancing shoes');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBeTrue();
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('escapes and folds per RFC 5545', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const folded = foldLine('X'.repeat(80) + 'शगुन');
    expect(folded.split('\r\n ').length).toBe(2);
  });

  it('builds a Google Calendar link in IST', () => {
    const url = new URL(googleCalendarUrl(wedding(), sangeet));
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261211T140000Z/20261211T193000Z');
    expect(url.searchParams.get('ctz')).toBe('Asia/Kolkata');
    expect(url.searchParams.get('location')).toBe('Durbar Hall, City Palace, Udaipur');
  });

  it('sorts events and formats times the Indian way', () => {
    expect(sortEvents([sangeet, haldi]).map((e) => e.id)).toEqual(['e0', 'e1']);
    expect(formatTime('19:30')).toBe('7:30 pm');
    expect(formatTime('00:15')).toBe('12:15 am');
  });

  it('only renders http(s) map links and falls back to a maps search', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(mapsUrl({ ...haldi, mapsUrl: 'javascript:alert(1)' })).toContain('google.com/maps/search');
    expect(mapsUrl({ ...haldi, mapsUrl: 'https://maps.app.goo.gl/x' })).toBe('https://maps.app.goo.gl/x');
  });
});

describe('RSVP export', () => {
  const rsvp = (id: string, eventIds: string[], partySize: number, patch: Partial<Rsvp> = {}): Rsvp =>
    ({ id, weddingId: 'w1', guestName: `Guest ${id}`, eventIds, partySize, note: '', createdAt: new Date(2026, 10, +id.slice(1)).getTime(), ...patch });

  it('counts people per function', () => {
    const list = [rsvp('r1', ['e0', 'e1'], 4), rsvp('r2', ['e1'], 2), rsvp('r3', [], 1)];
    expect(headcount(list, 'e1')).toBe(6);
    expect(headcount(list, 'e0')).toBe(4);
  });

  it('writes one row per reply and a total per function', () => {
    const w = wedding({ events: [haldi, sangeet] });
    const csv = rsvpsCsv(w, [rsvp('r2', ['e1'], 2, { side: 'bride', note: '=cmd' }), rsvp('r1', ['e0', 'e1'], 4)]);
    const rows = csv.slice(1).trim().split('\r\n');
    expect(rows[0]).toBe('Date,Guest,Side,People,Attending,Phone,Note');
    expect(rows[1]).toBe('01/11/2026,Guest r1,,4,Haldi; Sangeet,,');
    expect(rows[2]).toBe("02/11/2026,Guest r2,Bride's side,2,Sangeet,,'=cmd");
    expect(rows).toContain(',Total: Sangeet,,6,,,');
  });
});
