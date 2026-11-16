import { COVER_PRESETS, CoverPreset, EVENT_KINDS, EventKind, Goal, MAX_EVENTS, MAX_GOALS, MAX_MILESTONES, Milestone, Wedding, WeddingEvent } from './models';
import { isValidVpa } from './upi';
import { uid } from './util';
import { truncateText } from './text';

/**
 * The app is static (GitHub Pages), so a guest on another phone has no server to load the
 * wedding from. Share links therefore carry the wedding page itself: packed into a positional
 * array, deflated with CompressionStream and base64url-encoded into the `d` query parameter.
 * Uploaded photos are left out to keep links (and venue QR codes) short.
 */

const VERSION = 2;
const MAX_ENCODED = 8_000;
const MAX_JSON = 40_000;

type PackedGoal = [string, string, number, string, string];
type PackedEvent = [string, number, string, string, string, string, string, string, string, string];
type PackedMilestone = [string, string, string, string, string];

export function packWedding(w: Wedding): unknown[] {
  return [
    VERSION, w.slug, w.partner1, w.partner2, w.date, w.venue, w.city,
    COVER_PRESETS.indexOf(w.cover.preset), truncateText(w.story, 1200), w.upiId, w.payeeName, w.showAmounts ? 1 : 0,
    w.goals.map((g): PackedGoal => [g.id, g.title, g.target, g.emoji, g.description ?? '']),
    (w.events ?? []).slice(0, MAX_EVENTS).map((e): PackedEvent => [
      e.id, EVENT_KINDS.indexOf(e.kind), e.name, e.date, e.time, e.endTime ?? '', e.venue, e.address ?? '', e.mapsUrl ?? '', e.dressCode ?? '',
    ]),
    [w.families?.bride ?? '', w.families?.groom ?? ''],
    (w.milestones ?? []).slice(0, MAX_MILESTONES).map((m): PackedMilestone => [m.id, m.when, m.title, truncateText(m.text, 300), m.emoji]),
  ];
}

const fail = (): never => { throw new Error('This wedding link is damaged or incomplete.'); };
const asStr = (v: unknown, max = 2000) => (typeof v === 'string' && v.length <= max ? v : fail());
const asNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : fail());
const asArr = (v: unknown) => (Array.isArray(v) ? v : fail());

export function unpackWedding(data: unknown): Wedding {
  const [version, slug, p1, p2, date, venue, city, preset, story, upiId, payee, showAmounts, goals, events, families, milestones] = asArr(data);
  if (version !== 1 && version !== VERSION) fail();
  const upi = asStr(upiId, 300);
  if (!isValidVpa(upi)) fail();
  const goalList = asArr(goals).slice(0, MAX_GOALS).map((g): Goal => {
    const [id, title, target, emoji, description] = asArr(g);
    const t = asNum(target);
    if (t <= 0) fail();
    return { id: asStr(id, 40), title: asStr(title, 80), target: t, emoji: asStr(emoji, 16), description: asStr(description, 300) || undefined };
  });
  if (!goalList.length) fail();
  const eventList = (events === undefined ? [] : asArr(events)).slice(0, MAX_EVENTS).map((e): WeddingEvent => {
    const [id, kind, name, d, time, endTime, place, address, maps, dress] = asArr(e);
    const ev: WeddingEvent = {
      id: asStr(id, 40),
      kind: (EVENT_KINDS[asNum(kind)] ?? 'custom') as EventKind,
      name: asStr(name, 60),
      date: /^\d{4}-\d{2}-\d{2}$/.test(asStr(d, 10)) ? (d as string) : fail(),
      time: /^\d{2}:\d{2}$/.test(asStr(time, 5)) ? (time as string) : fail(),
      venue: asStr(place, 120),
    };
    if (asStr(endTime, 5)) ev.endTime = endTime as string;
    if (asStr(address, 200)) ev.address = address as string;
    if (asStr(maps, 500)) ev.mapsUrl = maps as string;
    if (asStr(dress, 120)) ev.dressCode = dress as string;
    return ev;
  });
  const [bride, groom] = families === undefined ? ['', ''] : asArr(families);
  const milestoneList = (milestones === undefined ? [] : asArr(milestones)).slice(0, MAX_MILESTONES).map((m): Milestone => {
    const [id, when, title, text, emoji] = asArr(m);
    return { id: asStr(id, 40), when: asStr(when, 40), title: asStr(title, 80), text: asStr(text, 300), emoji: asStr(emoji, 16) };
  });
  return {
    id: uid('w'),
    slug: asStr(slug, 60).replace(/[^a-z0-9-]/g, '') || fail(),
    partner1: asStr(p1, 60),
    partner2: asStr(p2, 60),
    date: /^\d{4}-\d{2}-\d{2}$/.test(asStr(date, 10)) ? (date as string) : fail(),
    venue: asStr(venue, 120),
    city: asStr(city, 60),
    cover: { preset: (COVER_PRESETS[asNum(preset)] ?? 'marigold') as CoverPreset },
    story: asStr(story, 1200),
    goals: goalList,
    upiId: upi,
    payeeName: asStr(payee, 60),
    showAmounts: showAmounts === 1,
    events: eventList,
    families: { bride: asStr(bride ?? '', 120), groom: asStr(groom ?? '', 120) },
    milestones: milestoneList,
    createdAt: Date.now(),
  };
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) fail();
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeWedding(w: Wedding): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(packWedding(w)));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeWedding(encoded: string): Promise<Wedding> {
  if (!encoded || encoded.length > MAX_ENCODED) fail();
  let data: unknown;
  try {
    const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
    if (bytes.length > MAX_JSON) fail();
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return fail();
  }
  return unpackWedding(data);
}

/** App base URL (works under a GitHub Pages sub-path) for building hash-routed links. */
/**
 * The site's own address for links in messages: https://konicamaheshwarii.github.io/gathbandhan/
 * on the live site (localhost while developing). A trailing index.html is dropped.
 */
export function appBaseUrl(loc: Pick<Location, 'origin' | 'pathname'> = location): string {
  return `${loc.origin}${loc.pathname.replace(/index\.html$/, '')}`;
}

export function weddingUrl(slug: string, encoded?: string, base = appBaseUrl()): string {
  return `${base}#/w/${slug}${encoded ? `?d=${encoded}` : ''}`;
}
