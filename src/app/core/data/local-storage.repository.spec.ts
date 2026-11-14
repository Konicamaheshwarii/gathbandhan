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

  it('reports a full storage instead of losing data silently', async () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    await expectAsync(repo.saveWedding(wedding())).toBeRejectedWithError(/out of storage/);
  });

  it('survives corrupted storage', async () => {
    localStorage.setItem(KEYS.weddings, '{not json');
    expect(await repo.listWeddings()).toEqual([]);
  });
});
