import { contribution, wedding } from '../testing';
import { KEYS, LocalStorageWeddingRepository } from './local-storage.repository';
import { DEMO_SLUG } from './seed';
import { RepositoryChange } from './wedding.repository';

describe('LocalStorageWeddingRepository', () => {
  let repo: LocalStorageWeddingRepository;

  beforeEach(() => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    repo = new LocalStorageWeddingRepository();
  });

  afterEach(() => {
    repo.ngOnDestroy();
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  });

  it('seeds the sample wedding with contributions on first run', async () => {
    const demo = await repo.getWeddingBySlug(DEMO_SLUG);
    expect(demo?.demo).toBeTrue();
    expect(demo!.goals.length).toBe(4);
    const list = await repo.listContributions(demo!.id);
    expect(list.length).toBe(16);
    expect(list[0].createdAt).toBeGreaterThan(list[list.length - 1].createdAt);
  });

  it('does not re-seed over the user’s edits', async () => {
    const demo = (await repo.getWeddingBySlug(DEMO_SLUG))!;
    await repo.saveWedding({ ...demo, partner1: 'Edited' });
    const again = new LocalStorageWeddingRepository();
    expect((await again.getWeddingBySlug(DEMO_SLUG))!.partner1).toBe('Edited');
    again.ngOnDestroy();
  });

  it('creates, updates and keeps slugs unique', async () => {
    const a = await repo.saveWedding(wedding({ id: 'a' }));
    const b = await repo.saveWedding(wedding({ id: 'b' }));
    expect(a.slug).toBe('asha-weds-dev');
    expect(b.slug).toBe('asha-weds-dev-2');
    await repo.saveWedding({ ...a, venue: 'New venue' });
    expect((await repo.getWeddingBySlug('asha-weds-dev'))!.venue).toBe('New venue');
    expect((await repo.listWeddings()).filter((w) => !w.demo).length).toBe(2);
  });

  it('records guest contributions as guest-confirmed and lets the couple verify them', async () => {
    await repo.saveWedding(wedding());
    const c = await repo.addContribution({ weddingId: 'w1', goalId: 'g1', guestName: 'Kabir', amount: 2100, message: 'Blessings' });
    expect(c.status).toBe('guest-confirmed');
    const verified = await repo.updateContribution(c.id, { status: 'verified' });
    expect(verified.status).toBe('verified');
    expect((await repo.listContributions('w1'))[0].status).toBe('verified');
    await repo.deleteContribution(c.id);
    expect(await repo.listContributions('w1')).toEqual([]);
  });

  it('emits a change for every write', async () => {
    const seen: RepositoryChange[] = [];
    const sub = repo.changes().subscribe((c) => seen.push(c));
    await repo.saveWedding(wedding());
    await repo.addContribution({ weddingId: 'w1', goalId: 'g1', guestName: 'A', amount: 501, message: '' });
    sub.unsubscribe();
    expect(seen).toEqual([{ weddingId: 'w1' }, { weddingId: 'w1' }]);
  });

  it('deletes a wedding together with its contributions', async () => {
    await repo.saveWedding(wedding());
    await repo.addContribution({ ...contribution('g1', 1100), weddingId: 'w1' });
    await repo.deleteWedding('w1');
    expect(await repo.getWeddingBySlug('asha-weds-dev')).toBeNull();
    expect(await repo.listContributions('w1')).toEqual([]);
  });

  it('restores the sample without touching the user’s own pages', async () => {
    await repo.saveWedding(wedding());
    const demo = (await repo.getWeddingBySlug(DEMO_SLUG))!;
    await repo.addContribution({ weddingId: demo.id, goalId: 'g-trees', guestName: 'Test', amount: 1, message: '' });
    await repo.resetDemo();
    expect((await repo.listContributions(demo.id)).length).toBe(16);
    expect(await repo.getWeddingBySlug('asha-weds-dev')).not.toBeNull();
  });

  it('seeds a sample with functions, families, story, photos, goal updates and RSVPs', async () => {
    const demo = (await repo.getWeddingBySlug(DEMO_SLUG))!;
    expect(demo.events!.map((e) => e.kind)).toEqual(['haldi', 'mehndi', 'sangeet', 'wedding', 'reception']);
    expect(demo.families!.bride).toContain('Sharma');
    expect(demo.milestones!.length).toBe(4);
    expect(demo.gallery!.length).toBe(4);
    expect(demo.goals[0].updates![0].text).toContain('Flights booked');
    expect((await repo.listRsvps(demo.id)).length).toBe(10);
  });

  it('records RSVPs and shows guests only the public view of contributions', async () => {
    await repo.saveWedding(wedding());
    expect(await repo.isOwner('w1')).toBeTrue();
    expect(await repo.isOwner('nope')).toBeFalse();
    const r = await repo.addRsvp({ weddingId: 'w1', guestName: 'Sharma Parivar', eventIds: ['e1'], partySize: 4, note: '' });
    expect((await repo.listRsvps('w1'))[0].id).toBe(r.id);
    await repo.deleteRsvp(r.id);
    expect(await repo.listRsvps('w1')).toEqual([]);

    await repo.addContribution({ weddingId: 'w1', goalId: 'g1', guestName: 'Kabir', amount: 2100, message: 'Hi', phone: '919876543210' });
    const pub = await repo.getPublicActivity('w1');
    expect(pub.raised).toBe(2100);
    expect(pub.wall[0]).toEqual(jasmine.objectContaining({ guestName: 'Kabir', message: 'Hi' }));
    expect(JSON.stringify(pub)).not.toContain('9876543210');
  });

  it('keeps a private guest list; a personal link reveals only that guest and ticks off their progress', async () => {
    const demo = (await repo.getWeddingBySlug(DEMO_SLUG))!;
    const guests = await repo.listGuests(demo.id);
    expect(guests.length).toBe(25);
    expect(demo.invite?.template).toBe('rajasthani');
    const fresh = guests.find((g) => !g.sentAt)!;
    expect(await repo.getGuestInvite(demo.id, fresh.token)).toEqual({ name: fresh.name, greeting: fresh.greeting ?? fresh.name });
    expect(await repo.getGuestInvite(demo.id, 'nope12345')).toBeNull();
    await repo.markGuest(demo.id, fresh.token, 'rsvp');
    const after = (await repo.listGuests(demo.id)).find((g) => g.id === fresh.id)!;
    expect(after.rsvpAt).toBeDefined();
    expect(after.openedAt).toBeDefined();
    await repo.saveGuests([{ ...after, sentAt: 5 }]);
    expect((await repo.listGuests(demo.id)).find((g) => g.id === fresh.id)!.sentAt).toBe(5);
    await repo.deleteGuest(fresh.id);
    expect((await repo.listGuests(demo.id)).length).toBe(24);
  });

  it('has no co-owners in demo mode', async () => {
    expect(await repo.listOwners()).toEqual([]);
    await expectAsync(repo.addOwner()).toBeRejectedWithError(/backend/);
  });

  it('reports a full storage instead of losing data silently', async () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    await expectAsync(repo.saveWedding(wedding())).toBeRejectedWithError(/out of storage/);
  });

  it('survives corrupted storage', async () => {
    localStorage.setItem(KEYS.weddings, '{not json');
    expect(await repo.listWeddings()).toEqual([]);
  });
});
