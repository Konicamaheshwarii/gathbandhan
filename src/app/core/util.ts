let counter = 0;

/** Short unique id. Uses crypto when available, with a counter so ids are unique even in fast loops. */
export function uid(prefix = ''): string {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}${random}${(counter++).toString(36)}`;
}

/** FNV-1a hash, for deterministic choices in demo mode. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickBy<T>(list: readonly T[], seed: string, salt = ''): T {
  return list[hashString(seed + salt) % list.length];
}

/** "Riya & Arjun" -> "riya-weds-arjun" style slugs, ASCII only so links survive WhatsApp. */
export function slugify(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' weds ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

export function weddingSlug(partner1: string, partner2: string): string {
  const a = slugify(firstName(partner1));
  const b = slugify(firstName(partner2));
  return a && b ? `${a}-weds-${b}` : a || b || 'our-wedding';
}

/** First name for friendly copy ("Thank you, Sunita"). */
export function firstName(name: string): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
