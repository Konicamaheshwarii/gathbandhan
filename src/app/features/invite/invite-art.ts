/**
 * Geometry for the invite art, kept apart from the templates so it can be unit tested and reused.
 * Every drawing uses a 900 x 1600 canvas (the 9:16 page).
 */

/** A cusped (multifoil) Rajasthani arch from x1 to x2, springing at `spring`, peaking at `peak`, down to `bottom`. */
export function cuspedArch(x1: number, x2: number, spring: number, peak: number, bottom: number, lobes = 9): string {
  const cx = (x1 + x2) / 2;
  const rx = (x2 - x1) / 2;
  const ry = spring - peak;
  const pts: [number, number][] = [];
  for (let i = 0; i <= lobes; i++) {
    const t = Math.PI - (i * Math.PI) / lobes;
    pts.push([cx + rx * Math.cos(t), spring - ry * Math.sin(t)]);
  }
  let d = `M${x1} ${bottom} L${x1} ${spring}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const r = (Math.hypot(bx - ax, by - ay) / 2) * 1.08;
    d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  return `${d} L${x2} ${bottom} Z`;
}

/** Points spread evenly from a to b (inclusive). */
export function spread(a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
}

/** Angles 0..360 in n equal steps. */
export const ring = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => offset + (360 * i) / n);

/** A row of diamonds (phulkari bagh) centred on y. */
export function diamonds(y: number, w: number, h: number, from = 0, to = 900): { x: number; y: number; k: number }[] {
  const out: { x: number; y: number; k: number }[] = [];
  let k = 0;
  for (let x = from; x <= to + 0.1; x += w) out.push({ x, y, k: k++ });
  return out;
}

/** Points for a diamond of half-width w and half-height h around (x, y). */
export const diamond = (x: number, y: number, w: number, h: number) => `${x},${y - h} ${x + w},${y} ${x},${y + h} ${x - w},${y}`;

/** Gopuram tiers from the base up: [x1, x2, top, bottom]. */
export function gopuramTiers(cx: number, base: number, height: number, width: number, tiers = 6): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const h = height / (tiers + 0.6);
  for (let i = 0; i < tiers; i++) {
    const w = width * (1 - i * (0.62 / tiers));
    const bottom = base - i * h;
    out.push([cx - w / 2, cx + w / 2, bottom - h, bottom]);
  }
  return out;
}
