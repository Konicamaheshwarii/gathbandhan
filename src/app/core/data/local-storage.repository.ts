import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Contribution, Guest, GuestInvite, GuestMark, NewContribution, NewRsvp, PublicActivity, Rsvp, Wedding } from '../models';
import { guestGreeting } from '../guests';
import { readJson, writeJson } from '../storage';
import { publicActivity } from '../totals';
import { uid } from '../util';
import { DEMO_SEED_VERSION, demoContributions, demoGuests, demoRsvps, demoWedding } from './seed';
import { DemoPayment, RepositoryChange, WeddingRepository } from './wedding.repository';

export const KEYS = {
  weddings: 'sg.weddings',
  contributions: 'sg.contributions',
  rsvps: 'sg.rsvps',
  guests: 'sg.guests',
  seed: 'sg.seedVersion',
} as const;

const NO_ACCOUNTS = 'Co-owners need the online backend. In demo mode everything stays in this browser.';

/**
 * Browser-only repository (demo mode). Writes are synchronous under the hood, but the API is
 * async so the Supabase implementation is a drop-in replacement. Other tabs are notified through
 * the `storage` event and a BroadcastChannel, which keeps the blessing wall live.
 */
@Injectable()
export class LocalStorageWeddingRepository extends WeddingRepository implements OnDestroy {
  readonly mode = 'local' as const;

  private readonly changes$ = new Subject<RepositoryChange>();
  private readonly channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sg.changes') : null;
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.weddings || e.key === KEYS.contributions || e.key === KEYS.rsvps || e.key === KEYS.guests) this.changes$.next({ weddingId: null });
  };

  constructor() {
    super();
    this.seedIfNeeded();
    this.channel?.addEventListener('message', (e: MessageEvent<RepositoryChange>) => this.changes$.next(e.data));
    globalThis.addEventListener?.('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    this.channel?.close();
    globalThis.removeEventListener?.('storage', this.onStorage);
  }

  changes(): Observable<RepositoryChange> {
    return this.changes$.asObservable();
  }

  async listWeddings(): Promise<Wedding[]> {
    return this.weddings().sort((a, b) => b.createdAt - a.createdAt);
  }

  async getWeddingBySlug(slug: string): Promise<Wedding | null> {
    return this.weddings().find((w) => w.slug === slug) ?? null;
  }

  async saveWedding(wedding: Wedding): Promise<Wedding> {
    const all = this.weddings();
    const taken = new Set(all.filter((w) => w.id !== wedding.id).map((w) => w.slug));
    let slug = wedding.slug;
    for (let n = 2; taken.has(slug); n++) slug = `${wedding.slug}-${n}`;
    const saved: Wedding = { ...wedding, slug };
    const i = all.findIndex((w) => w.id === wedding.id);
    if (i >= 0) all[i] = saved;
    else all.push(saved);
    this.write(KEYS.weddings, all, saved.id);
    return saved;
  }

  async deleteWedding(id: string): Promise<void> {
    writeJson(KEYS.contributions, this.contributions().filter((c) => c.weddingId !== id));
    writeJson(KEYS.rsvps, this.rsvps().filter((r) => r.weddingId !== id));
    writeJson(KEYS.guests, this.guests().filter((g) => g.weddingId !== id));
    this.write(KEYS.weddings, this.weddings().filter((w) => w.id !== id), id);
  }

  /** Everything in this browser was made (or opened) here, so this browser manages it. */
  async isOwner(weddingId: string): Promise<boolean> {
    return this.weddings().some((w) => w.id === weddingId);
  }

  async getPublicActivity(weddingId: string): Promise<PublicActivity> {
    const w = this.weddings().find((x) => x.id === weddingId);
    const list = this.contributions().filter((c) => c.weddingId === weddingId);
    return w ? publicActivity(w, list) : { goals: {}, raised: 0, contributors: 0, wall: [] };
  }

  async listContributions(weddingId: string): Promise<Contribution[]> {
    return this.contributions()
      .filter((c) => c.weddingId === weddingId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async addContribution(input: NewContribution): Promise<Contribution> {
    const contribution: Contribution = { ...input, id: uid('c'), createdAt: Date.now(), status: 'guest-confirmed' };
    this.write(KEYS.contributions, [...this.contributions(), contribution], input.weddingId);
    return contribution;
  }

  async recordDemoPayment(input: NewContribution, payment: DemoPayment): Promise<Contribution> {
    const now = Date.now();
    const contribution: Contribution = { ...input, ...payment, id: uid('c'), createdAt: now, paidAt: now, status: 'paid', provider: 'razorpay' };
    this.write(KEYS.contributions, [...this.contributions(), contribution], input.weddingId);
    return contribution;
  }

  async updateContribution(id: string, patch: Partial<Pick<Contribution, 'status' | 'thankedAt'>>): Promise<Contribution> {
    const all = this.contributions();
    const i = all.findIndex((c) => c.id === id);
    if (i < 0) throw new Error('Contribution not found.');
    all[i] = { ...all[i], ...patch };
    this.write(KEYS.contributions, all, all[i].weddingId);
    return all[i];
  }

  async deleteContribution(id: string): Promise<void> {
    const all = this.contributions();
    const target = all.find((c) => c.id === id);
    this.write(KEYS.contributions, all.filter((c) => c.id !== id), target?.weddingId ?? null);
  }

  async listRsvps(weddingId: string): Promise<Rsvp[]> {
    return this.rsvps()
      .filter((r) => r.weddingId === weddingId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async addRsvp(input: NewRsvp): Promise<Rsvp> {
    const rsvp: Rsvp = { ...input, id: uid('r'), createdAt: Date.now() };
    this.write(KEYS.rsvps, [...this.rsvps(), rsvp], input.weddingId);
    return rsvp;
  }

  async deleteRsvp(id: string): Promise<void> {
    const all = this.rsvps();
    const target = all.find((r) => r.id === id);
    this.write(KEYS.rsvps, all.filter((r) => r.id !== id), target?.weddingId ?? null);
  }

  async listGuests(weddingId: string): Promise<Guest[]> {
    return this.guests()
      .filter((g) => g.weddingId === weddingId)
      .sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  }

  async saveGuests(guests: Guest[]): Promise<void> {
    if (!guests.length) return;
    const byId = new Map(this.guests().map((g) => [g.id, g]));
    for (const g of guests) byId.set(g.id, g);
    this.write(KEYS.guests, [...byId.values()], guests[0].weddingId);
  }

  async deleteGuest(id: string): Promise<void> {
    const all = this.guests();
    const target = all.find((g) => g.id === id);
    this.write(KEYS.guests, all.filter((g) => g.id !== id), target?.weddingId ?? null);
  }

  async getGuestInvite(weddingId: string, token: string): Promise<GuestInvite | null> {
    const g = this.guests().find((x) => x.weddingId === weddingId && x.token === token);
    return g ? { name: g.name, greeting: guestGreeting(g) } : null;
  }

  /** Demo mode can only see opens from this browser; the backend sees them from every phone. */
  async markGuest(weddingId: string, token: string, mark: GuestMark): Promise<void> {
    const all = this.guests();
    const i = all.findIndex((g) => g.weddingId === weddingId && g.token === token);
    if (i < 0) return;
    const field = mark === 'opened' ? 'openedAt' : mark === 'rsvp' ? 'rsvpAt' : 'gaveAt';
    if (all[i][field]) return;
    all[i] = { ...all[i], [field]: Date.now(), ...(mark !== 'opened' && !all[i].openedAt ? { openedAt: Date.now() } : {}) };
    this.write(KEYS.guests, all, weddingId);
  }

  async listOwners(): Promise<string[]> {
    return [];
  }

  async addOwner(): Promise<void> {
    throw new Error(NO_ACCOUNTS);
  }

  async removeOwner(): Promise<void> {
    throw new Error(NO_ACCOUNTS);
  }

  async resetDemo(): Promise<void> {
    const demo = demoWedding();
    const isDemo = (id: string) => id === demo.id || this.isDemoWedding(id);
    writeJson(KEYS.contributions, [...this.contributions().filter((c) => !isDemo(c.weddingId)), ...demoContributions(demo)]);
    writeJson(KEYS.rsvps, [...this.rsvps().filter((r) => !isDemo(r.weddingId)), ...demoRsvps(demo)]);
    writeJson(KEYS.guests, [...this.guests().filter((g) => !isDemo(g.weddingId)), ...demoGuests(demo)]);
    this.write(KEYS.weddings, [...this.weddings().filter((w) => !w.demo && w.slug !== demo.slug), demo], null);
    writeJson(KEYS.seed, DEMO_SEED_VERSION);
  }

  private isDemoWedding(id: string): boolean {
    return this.weddings().some((w) => w.id === id && w.demo);
  }

  private seedIfNeeded(): void {
    if (readJson<number>(KEYS.seed, 0) >= DEMO_SEED_VERSION) return;
    void this.resetDemo();
  }

  private weddings(): Wedding[] {
    return list<Wedding>(KEYS.weddings);
  }

  private contributions(): Contribution[] {
    return list<Contribution>(KEYS.contributions);
  }

  private rsvps(): Rsvp[] {
    return list<Rsvp>(KEYS.rsvps);
  }

  private guests(): Guest[] {
    return list<Guest>(KEYS.guests);
  }

  private write(key: string, value: unknown, weddingId: string | null): void {
    if (!writeJson(key, value)) {
      throw new Error('This browser is out of storage space. Try a smaller photo or remove an old wedding page.');
    }
    const change: RepositoryChange = { weddingId };
    this.changes$.next(change);
    this.channel?.postMessage(change);
  }
}

function list<T>(key: string): T[] {
  const value = readJson<T[]>(key, []);
  return Array.isArray(value) ? value : [];
}
