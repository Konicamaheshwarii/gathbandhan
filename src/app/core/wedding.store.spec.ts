import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KEYS, LocalStorageWeddingRepository } from './data/local-storage.repository';
import { DEMO_SLUG, demoContributions, demoRsvps, demoWedding } from './data/seed';
import { WeddingRepository } from './data/wedding.repository';
import { WeddingStore } from './wedding.store';

describe('WeddingStore', () => {
  let store: WeddingStore;

  beforeEach(() => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: WeddingRepository, useClass: LocalStorageWeddingRepository }, WeddingStore],
    });
    store = TestBed.inject(WeddingStore);
  });

  afterEach(() => Object.values(KEYS).forEach((k) => localStorage.removeItem(k)));

  it('gives guests the public view: totals, a wall without phones, and no contribution list', async () => {
    await store.load(DEMO_SLUG);
    expect(store.state()).toBe('ready');
    expect(store.contributions()).toEqual([]);
    const seeded = demoContributions(demoWedding());
    expect(store.totals()!.raised).toBe(seeded.reduce((sum, c) => sum + c.amount, 0));
    expect(store.blessings().length).toBeGreaterThan(15);
    expect(store.blessings().length).toBeLessThanOrEqual(seeded.length);
    const phones = seeded.map((c) => c.phone).filter((p): p is string => !!p);
    expect(phones.length).toBeGreaterThan(0);
    const wall = JSON.stringify(store.blessings());
    for (const p of phones) expect(wall).not.toContain(p);
  });

  it('gives the couple every contribution and RSVP on the dashboard', async () => {
    await store.load(DEMO_SLUG, { manage: true });
    expect(store.owner()).toBeTrue();
    expect(store.contributions().length).toBe(demoContributions(demoWedding()).length);
    expect(store.rsvps().length).toBe(demoRsvps(demoWedding()).length);
    expect(store.totals()!.verified).toBeGreaterThan(0);
  });

  it('keeps share links short for the sample and records RSVPs', async () => {
    await store.load(DEMO_SLUG);
    expect(store.shareUrl()).toMatch(/#\/w\/riya-weds-arjun$/);
    await store.rsvp({ guestName: 'Sharma Parivar', eventIds: ['e-wedding'], partySize: 3, note: '' });
    await store.load(DEMO_SLUG, { manage: true });
    expect(store.rsvps().length).toBe(demoRsvps(demoWedding()).length + 1);
  });

  it('reports a missing wedding', async () => {
    await store.load('nobody-weds-nobody');
    expect(store.state()).toBe('missing');
  });
});
