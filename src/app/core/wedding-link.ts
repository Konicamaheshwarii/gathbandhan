import { COVER_PRESETS, CoverPreset, Goal, MAX_GOALS, Wedding } from './models';
import { isValidVpa } from './upi';
import { uid } from './util';

/**
 * The app is static (GitHub Pages), so a guest on another phone has no server to load the
 * wedding from. Share links therefore carry the wedding page itself: packed into a positional
 * array, deflated with CompressionStream and base64url-encoded into the `d` query parameter.
 * Uploaded photos are left out to keep links (and venue QR codes) short.
 */

const VERSION = 1;
const MAX_ENCODED = 8_000;
const MAX_JSON = 40_000;

type PackedGoal = [string, string, number, string, string];

export function packWedding(w: Wedding): unknown[] {
  return [
    VERSION, w.slug, w.partner1, w.partner2, w.date, w.venue, w.city,
    COVER_PRESETS.indexOf(w.cover.preset), w.story.slice(0, 1200), w.upiId, w.payeeName, w.showAmounts ? 1 : 0,
    w.goals.map((g): PackedGoal => [g.id, g.title, g.target, g.emoji, g.description ?? '']),
  ];
}

const fail = (): never => { throw new Error('This wedding link is damaged or incomplete.'); };
const asStr = (v: unknown, max = 2000) => (typeof v === 'string' && v.length <= max ? v : fail());
const asNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : fail());
const asArr = (v: unknown) => (Array.isArray(v) ? v : fail());

export function unpackWedding(data: unknown): Wedding {
  const [version, slug, p1, p2, date, venue, city, preset, story, upiId, payee, showAmounts, goals] = asArr(data);
  if (version !== VERSION) fail();
  const upi = asStr(upiId, 300);
  if (!isValidVpa(upi)) fail();
  const goalList = asArr(goals).slice(0, MAX_GOALS).map((g): Goal => {
    const [id, title, target, emoji, description] = asArr(g);
    const t = asNum(target);
    if (t <= 0) fail();
    return { id: asStr(id, 40), title: asStr(title, 80), target: t, emoji: asStr(emoji, 16), description: asStr(description, 300) || undefined };
  });
  if (!goalList.length) fail();
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
export function appBaseUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function weddingUrl(slug: string, encoded?: string, base = appBaseUrl()): string {
  return `${base}#/w/${slug}${encoded ? `?d=${encoded}` : ''}`;
}
