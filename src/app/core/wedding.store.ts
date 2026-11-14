import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WeddingRepository } from './data/wedding.repository';
import { recalledGuestToken } from './guests';
import { Contribution, Guest, GuestMark, NewContribution, NewRsvp, PublicActivity, Rsvp, WallEntry, Wedding } from './models';
import { computeTotals, totalsFromActivity } from './totals';
import { decodeWedding, encodeWedding, weddingUrl } from './wedding-link';

export type LoadState = 'loading' | 'ready' | 'missing';

export interface LoadOptions {
  /** Wedding packed into a share link (`?d=`), used in demo mode only. */
  payload?: string | null;
  /** Couple pages (dashboard): load every contribution and RSVP, if the visitor owns the wedding. */
  manage?: boolean;
}

const EMPTY_ACTIVITY: PublicActivity = { goals: {}, raised: 0, contributors: 0, wall: [] };

/**
 * State for one wedding page. Provided per route component, so every page gets its own copy
 * that follows repository changes (other tabs, other devices, the guest flow) and is torn down
 * with the page.
 *
 * Guests get the public view (totals and the blessing wall); the couple's dashboard gets the
 * full contribution list. With the backend, Row Level Security enforces the same split.
 */
@Injectable()
export class WeddingStore {
  private readonly repo = inject(WeddingRepository);
  private stopWatching: () => void = () => undefined;
  private manageMode = false;

  readonly state = signal<LoadState>('loading');
  readonly wedding = signal<Wedding | null>(null);
  /** The visitor may manage this wedding (always true in demo mode). */
  readonly owner = signal(false);
  readonly contributions = signal<Contribution[]>([]);
  readonly rsvps = signal<Rsvp[]>([]);
  readonly guests = signal<Guest[]>([]);
  readonly activity = signal<PublicActivity>(EMPTY_ACTIVITY);
  readonly error = signal<string | null>(null);
  /** Public link: just `#/w/slug` with the backend; in demo mode it carries the wedding page. */
  readonly shareUrl = signal('');
  readonly backend = this.repo.mode === 'supabase';

  readonly totals = computed(() => {
    const w = this.wedding();
    if (!w) return null;
    return this.manageMode && this.owner() ? computeTotals(w, this.contributions()) : totalsFromActivity(w, this.activity());
  });
  readonly blessings = computed<WallEntry[]>(() =>
    this.manageMode && this.owner() ? this.contributions().filter((c) => c.message.trim()) : this.activity().wall,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.stopWatching());
    this.repo
      .changes()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((change) => {
        const w = this.wedding();
        if (w && (change.weddingId === null || change.weddingId === w.id)) void this.refresh();
      });
  }

  /**
   * Loads by slug. In demo mode, when this browser has never seen the wedding but the link
   * carries it (`?d=`), the wedding is imported so a guest on another phone can still give shagun.
   */
  async load(slug: string, options: LoadOptions = {}): Promise<Wedding | null> {
    this.state.set('loading');
    this.manageMode = !!options.manage;
    this.error.set(null);
    let wedding: Wedding | null = null;
    try {
      wedding = await this.repo.getWeddingBySlug(slug);
      if (!wedding && options.payload && this.repo.mode === 'local') {
        const shared = await decodeWedding(options.payload);
        wedding = await this.repo.saveWedding({ ...shared, slug, imported: true });
      }
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.wedding.set(wedding);
    if (wedding) {
      await this.loadData(wedding);
      this.stopWatching();
      this.stopWatching = this.repo.watch(wedding.id);
      this.shareUrl.set(await this.buildShareUrl(wedding));
    }
    this.state.set(wedding ? 'ready' : 'missing');
    return wedding;
  }

  async refresh(): Promise<void> {
    const current = this.wedding();
    if (!current) return;
    try {
      const fresh = await this.repo.getWeddingBySlug(current.slug);
      this.wedding.set(fresh);
      if (fresh) await this.loadData(fresh);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async contribute(input: Omit<NewContribution, 'weddingId'>): Promise<Contribution> {
    const w = this.wedding();
    if (!w) throw new Error('Wedding not loaded.');
    const saved = await this.repo.addContribution({ ...input, weddingId: w.id });
    await this.markGuest('gave');
    await this.refresh();
    return saved;
  }

  async rsvp(input: Omit<NewRsvp, 'weddingId'>): Promise<Rsvp> {
    const w = this.wedding();
    if (!w) throw new Error('Wedding not loaded.');
    const saved = await this.repo.addRsvp({ ...input, weddingId: w.id });
    await this.markGuest('rsvp');
    return saved;
  }

  /** Ticks off the guest whose personal invite was opened in this browser (best effort). */
  private async markGuest(mark: GuestMark): Promise<void> {
    const w = this.wedding();
    const token = w ? recalledGuestToken(w.id) : null;
    if (w && token) await this.repo.markGuest(w.id, token, mark).catch(() => undefined);
  }

  async saveGuests(guests: Guest[]): Promise<void> {
    await this.repo.saveGuests(guests);
    await this.refresh();
  }

  async removeGuest(g: Guest): Promise<void> {
    await this.repo.deleteGuest(g.id);
    await this.refresh();
  }

  /** Saves the whole wedding (goal updates, photos) and reloads it. */
  async saveWedding(next: Wedding): Promise<Wedding> {
    const saved = await this.repo.saveWedding(next);
    this.wedding.set(saved);
    return saved;
  }

  async setVerified(c: Contribution, verified: boolean): Promise<void> {
    await this.patch(c.id, { status: verified ? 'verified' : 'guest-confirmed' });
  }

  async markThanked(c: Contribution, thanked = true): Promise<void> {
    await this.patch(c.id, { thankedAt: thanked ? Date.now() : undefined });
  }

  async remove(c: Contribution): Promise<void> {
    await this.repo.deleteContribution(c.id);
    await this.refresh();
  }

  async removeRsvp(r: Rsvp): Promise<void> {
    await this.repo.deleteRsvp(r.id);
    await this.refresh();
  }

  private async loadData(w: Wedding): Promise<void> {
    const owner = await this.repo.isOwner(w.id).catch(() => false);
    this.owner.set(owner);
    if (this.manageMode && owner) {
      const [contributions, rsvps, guests] = await Promise.all([
        this.repo.listContributions(w.id), this.repo.listRsvps(w.id), this.repo.listGuests(w.id),
      ]);
      this.contributions.set(contributions);
      this.rsvps.set(rsvps);
      this.guests.set(guests);
    } else {
      this.activity.set(await this.repo.getPublicActivity(w.id));
    }
  }

  private async patch(id: string, patch: Partial<Pick<Contribution, 'status' | 'thankedAt'>>): Promise<void> {
    // Optimistic: the toggle flips at once, then the repository confirms.
    this.contributions.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try {
      await this.repo.updateContribution(id, patch);
    } finally {
      await this.refresh();
    }
  }

  private async buildShareUrl(w: Wedding): Promise<string> {
    // With a backend any phone can look the wedding up; the sample exists in every browser.
    if (this.repo.mode === 'supabase' || w.demo) return weddingUrl(w.slug);
    try {
      return weddingUrl(w.slug, await encodeWedding(w));
    } catch {
      return weddingUrl(w.slug);
    }
  }
}
