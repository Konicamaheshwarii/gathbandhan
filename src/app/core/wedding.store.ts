import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WeddingRepository } from './data/wedding.repository';
import { Contribution, NewContribution, Wedding } from './models';
import { computeTotals } from './totals';
import { decodeWedding, encodeWedding, weddingUrl } from './wedding-link';

export type LoadState = 'loading' | 'ready' | 'missing';

/**
 * State for one wedding page. Provided per route component, so every page gets its own copy
 * that follows repository changes (other tabs, the guest flow) and is torn down with the page.
 */
@Injectable()
export class WeddingStore {
  private readonly repo = inject(WeddingRepository);

  readonly state = signal<LoadState>('loading');
  readonly wedding = signal<Wedding | null>(null);
  readonly contributions = signal<Contribution[]>([]);
  readonly error = signal<string | null>(null);
  /** Public link including the wedding payload, so it opens on any phone. */
  readonly shareUrl = signal('');

  readonly totals = computed(() => {
    const w = this.wedding();
    return w ? computeTotals(w, this.contributions()) : null;
  });
  readonly blessings = computed(() => this.contributions().filter((c) => c.message.trim()));

  constructor() {
    this.repo
      .changes()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((change) => {
        const w = this.wedding();
        if (w && (change.weddingId === null || change.weddingId === w.id)) void this.refresh();
      });
  }

  /**
   * Loads by slug. When this browser has never seen the wedding but the link carries it
   * (`?d=`), the wedding is imported so a guest on another phone can still give shagun.
   */
  async load(slug: string, payload?: string | null): Promise<Wedding | null> {
    this.state.set('loading');
    let wedding = await this.repo.getWeddingBySlug(slug);
    if (!wedding && payload) {
      try {
        const shared = await decodeWedding(payload);
        wedding = await this.repo.saveWedding({ ...shared, slug, imported: true });
      } catch (e) {
        this.error.set((e as Error).message);
      }
    }
    this.wedding.set(wedding);
    this.contributions.set(wedding ? await this.repo.listContributions(wedding.id) : []);
    this.state.set(wedding ? 'ready' : 'missing');
    if (wedding) this.shareUrl.set(await this.buildShareUrl(wedding));
    return wedding;
  }

  async refresh(): Promise<void> {
    const current = this.wedding();
    if (!current) return;
    const fresh = await this.repo.getWeddingBySlug(current.slug);
    this.wedding.set(fresh);
    this.contributions.set(fresh ? await this.repo.listContributions(fresh.id) : []);
  }

  async contribute(input: Omit<NewContribution, 'weddingId'>): Promise<Contribution> {
    const w = this.wedding();
    if (!w) throw new Error('Wedding not loaded.');
    const saved = await this.repo.addContribution({ ...input, weddingId: w.id });
    await this.refresh();
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
    // The seeded sample exists in every browser, so its link stays short.
    if (w.demo) return weddingUrl(w.slug);
    try {
      return weddingUrl(w.slug, await encodeWedding(w));
    } catch {
      return weddingUrl(w.slug);
    }
  }
}
