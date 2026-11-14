import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Contribution, NewContribution, Wedding } from '../models';
import { readJson, writeJson } from '../storage';
import { uid } from '../util';
import { DEMO_SEED_VERSION, demoContributions, demoWedding } from './seed';
import { RepositoryChange, WeddingRepository } from './wedding.repository';

export const KEYS = {
  weddings: 'sg.weddings',
  contributions: 'sg.contributions',
  seed: 'sg.seedVersion',
} as const;

/**
 * Browser-only repository. Writes are synchronous under the hood, but the API is async so a
 * network implementation is a drop-in replacement. Other tabs are notified through the
 * `storage` event and a BroadcastChannel, which keeps the blessing wall live.
 */
@Injectable()
export class LocalStorageWeddingRepository extends WeddingRepository implements OnDestroy {
  private readonly changes$ = new Subject<RepositoryChange>();
  private readonly channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sg.changes') : null;
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.weddings || e.key === KEYS.contributions) this.changes$.next({ weddingId: null });
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
    this.write(KEYS.weddings, this.weddings().filter((w) => w.id !== id), id);
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

  async resetDemo(): Promise<void> {
    const demo = demoWedding();
    writeJson(KEYS.contributions, [
      ...this.contributions().filter((c) => !this.isDemoWedding(c.weddingId)),
      ...demoContributions(demo),
    ]);
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
    const list = readJson<Wedding[]>(KEYS.weddings, []);
    return Array.isArray(list) ? list : [];
  }

  private contributions(): Contribution[] {
    const list = readJson<Contribution[]>(KEYS.contributions, []);
    return Array.isArray(list) ? list : [];
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
