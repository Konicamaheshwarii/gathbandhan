import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { take } from 'rxjs';
import { wedding } from '../../testing';
import { KEYS } from '../local-storage.repository';
import { DEMO_SLUG } from '../seed';
import { SupabaseWeddingRepository, WEDDING_COLUMNS, dataUrlToBlob, friendlyError, fromContributionRow, fromWeddingRow, toWeddingRow } from './supabase.repository';
import { SUPABASE_CLIENT, T } from './supabase.token';

type Step = [string, unknown[]];
type Result = { data: unknown; error: { code?: string; message?: string } | null };
type Handler = (table: string, chain: Step[]) => Result | undefined;

/** A tiny stand-in for the supabase-js query builder: records each chained call, resolves through `handler`. */
class FakeQuery implements PromiseLike<Result> {
  readonly chain: Step[] = [];
  constructor(readonly table: string, private readonly fake: FakeSupabase) {}
  private add(name: string, args: unknown[]): this {
    this.chain.push([name, args]);
    return this;
  }
  select(...a: unknown[]) { return this.add('select', a); }
  insert(...a: unknown[]) { return this.add('insert', a); }
  update(...a: unknown[]) { return this.add('update', a); }
  delete(...a: unknown[]) { return this.add('delete', a); }
  eq(...a: unknown[]) { return this.add('eq', a); }
  in(...a: unknown[]) { return this.add('in', a); }
  like(...a: unknown[]) { return this.add('like', a); }
  order(...a: unknown[]) { return this.add('order', a); }
  limit(...a: unknown[]) { return this.add('limit', a); }
  maybeSingle() { return this.add('maybeSingle', []); }
  single() { return this.add('single', []); }
  then<A, B>(ok?: ((r: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    this.fake.queries.push(this);
    const result = this.fake.handler(this.table, this.chain) ?? { data: [], error: null };
    return Promise.resolve(result).then(ok, fail);
  }
  has(name: string): Step | undefined {
    return this.chain.find(([n]) => n === name);
  }
}

class FakeSupabase {
  queries: FakeQuery[] = [];
  handler: Handler = () => undefined;
  session: unknown = null;
  uploads: { path: string; type: string }[] = [];
  removed: string[][] = [];
  channels: { name: string; tables: string[] }[] = [];
  removedChannels = 0;

  from(table: string) { return new FakeQuery(table, this); }
  rpc(name: string, args: unknown) {
    const q = new FakeQuery(`rpc:${name}`, this);
    q.chain.push(['rpc', [args]]);
    return q;
  }
  auth = { getSession: async () => ({ data: { session: this.session } }) };
  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, blob: Blob) => {
        this.uploads.push({ path, type: blob.type });
        return { error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://p.supabase.co/storage/v1/object/public/shagun-photos/${path}` } }),
      list: async () => ({ data: [] }),
      remove: async (paths: string[]) => {
        this.removed.push(paths);
        return { error: null };
      },
    }),
  };
  channel(name: string) {
    const entry = { name, tables: [] as string[] };
    this.channels.push(entry);
    const ch = {
      on: (_type: string, filter: { table: string }) => {
        entry.tables.push(filter.table);
        return ch;
      },
      subscribe: () => ch,
    };
    return ch;
  }
  removeChannel() {
    this.removedChannels++;
    return Promise.resolve('ok');
  }
  last(table: string): FakeQuery {
    return [...this.queries].reverse().find((q) => q.table === table)!;
  }
}

describe('SupabaseWeddingRepository (mocked client)', () => {
  let fake: FakeSupabase;
  let repo: SupabaseWeddingRepository;
  const row = (patch = {}) => ({ ...toWeddingRow(wedding()), created_at: '2026-11-01T10:00:00Z', ...patch });

  beforeEach(() => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    fake = new FakeSupabase();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: SUPABASE_CLIENT, useValue: fake }, SupabaseWeddingRepository] });
    repo = TestBed.inject(SupabaseWeddingRepository);
  });

  afterEach(() => {
    repo.ngOnDestroy();
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  });

  it('maps rows to weddings and back', () => {
    const w = wedding({ events: [], families: { bride: 'Raos' }, gallery: [], milestones: [], paymentMode: 'razorpay', feeBearer: 'guest', razorpayActive: false });
    expect(fromWeddingRow({ ...toWeddingRow(w), created_at: new Date(1).toISOString() })).toEqual({ ...w, createdAt: 1 });
    expect(toWeddingRow(w).wedding_date).toBe('2026-12-12');
    // The server owns razorpay_active: the app never writes it.
    expect('razorpay_active' in toWeddingRow({ ...w, razorpayActive: true })).toBeFalse();
    expect(fromWeddingRow({ ...toWeddingRow(w), razorpay_active: true }).razorpayActive).toBeTrue();
  });

  it('maps Razorpay payment columns on contributions', () => {
    const c = fromContributionRow({
      id: 'x', wedding_id: 'w1', goal_id: 'g1', guest_name: 'Meera', amount: 2100, message: '', phone: null, side: null,
      status: 'paid', thanked_at: null, created_at: '2026-11-01T10:00:00Z', provider: 'razorpay',
      razorpay_order_id: 'order_Test12345', razorpay_payment_id: 'pay_Test67890', charged_amount: '2150.75', guest_fee: '50.75', fee_amount: '50.75',
      paid_at: '2026-11-01T10:01:00Z',
    });
    expect(c).toEqual(jasmine.objectContaining({ provider: 'razorpay', razorpayPaymentId: 'pay_Test67890', chargedAmount: 2150.75, fee: 50.75, guestFee: 50.75, status: 'paid' }));
  });

  it('looks a wedding up by slug, reading only the public columns', async () => {
    fake.handler = (t) => (t === T.weddings ? { data: row(), error: null } : undefined);
    const w = await repo.getWeddingBySlug('asha-weds-dev');
    expect(w?.partner1).toBe('Asha Rao');
    const q = fake.last(T.weddings);
    expect(q.has('select')![1]).toEqual([WEDDING_COLUMNS]);
    expect(q.has('eq')![1]).toEqual(['slug', 'asha-weds-dev']);
    expect(WEDDING_COLUMNS).not.toContain('created_by');
  });

  it('serves the bundled sample from this browser without touching the backend', async () => {
    const demo = await repo.getWeddingBySlug(DEMO_SLUG);
    expect(demo?.demo).toBeTrue();
    expect((await repo.listContributions(demo!.id)).length).toBe(16);
    expect(fake.queries.length).toBe(0);
  });

  it('lets a guest give shagun as an insert only (no read-back), always guest-confirmed', async () => {
    const c = await repo.addContribution({ weddingId: 'w1', goalId: 'g1', guestName: 'Kabir', amount: 2100, message: 'Enjoy', side: 'groom' });
    const q = fake.last(T.contributions);
    expect(q.has('select')).toBeUndefined();
    expect(q.has('insert')![1][0]).toEqual(jasmine.objectContaining({
      id: c.id, wedding_id: 'w1', goal_id: 'g1', guest_name: 'Kabir', amount: 2100, phone: null, side: 'groom',
    }));
    expect((q.has('insert')![1][0] as object)).not.toEqual(jasmine.objectContaining({ status: jasmine.anything() }));
    expect(c.status).toBe('guest-confirmed');
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reads the public wall through the public_activity function', async () => {
    fake.handler = (t) =>
      t === 'rpc:shagun_public_activity'
        ? { data: { raised: 7200, contributors: 2, goals: { g1: { raised: 7200, count: 2 } }, wall: [{ id: 'x', goalId: 'g1', guestName: 'Zoya', message: 'Hi', createdAt: '1700000000000' }] }, error: null }
        : undefined;
    const a = await repo.getPublicActivity('w1');
    expect(fake.last('rpc:shagun_public_activity').chain[0][1]).toEqual([{ p_wedding_id: 'w1' }]);
    expect(a.raised).toBe(7200);
    expect(a.wall[0].createdAt).toBe(1_700_000_000_000);
    expect(a.wall[0].amount).toBeUndefined();
  });

  it('lists only the sample when signed out, and owned weddings when signed in', async () => {
    expect((await repo.listWeddings()).map((w) => w.slug)).toEqual([DEMO_SLUG]);
    expect(fake.queries.length).toBe(0);

    fake.session = { user: { id: 'u1', email: 'asha@example.com' } };
    fake.handler = (t) =>
      t === T.owners ? { data: [{ wedding_id: 'w1' }], error: null } : t === T.weddings ? { data: [row()], error: null } : undefined;
    const list = await repo.listWeddings();
    expect(list.map((w) => w.slug)).toEqual(['asha-weds-dev', DEMO_SLUG]);
    expect(fake.last(T.weddings).has('in')![1]).toEqual(['id', ['w1']]);
  });

  it('refuses to save when signed out', async () => {
    await expectAsync(repo.saveWedding(wedding())).toBeRejectedWithError(/sign in/i);
  });

  it('creates a new wedding: unique slug, row first, then photos uploaded to storage', async () => {
    fake.session = { user: { id: 'u1', email: 'asha@example.com' } };
    fake.handler = (t, chain) => {
      if (t !== T.weddings) return undefined;
      if (chain.some(([n]) => n === 'like')) return { data: [{ id: 'other', slug: 'asha-weds-dev' }], error: null };
      if (chain.some(([n]) => n === 'maybeSingle')) return { data: null, error: null };
      return { data: null, error: null };
    };
    const photo = 'data:image/jpeg;base64,/9j/AAAA';
    const saved = await repo.saveWedding(wedding({ cover: { preset: 'rose', imageUrl: photo }, gallery: [{ id: 'p1', url: photo }] }));

    expect(saved.slug).toBe('asha-weds-dev-2');
    const writes = fake.queries.filter((q) => q.table === T.weddings && (q.has('insert') || q.has('update')));
    const inserted = writes[0].has('insert')![1][0] as ReturnType<typeof toWeddingRow>;
    expect(inserted.details.cover!.imageUrl).toBe('');
    expect(fake.uploads.length).toBe(2);
    expect(fake.uploads[0].path).toMatch(/^w1\/[0-9a-f-]{36}\.jpg$/);
    expect(fake.uploads[0].type).toBe('image/jpeg');
    const updated = writes[1].has('update')![1][0] as Record<string, unknown>;
    expect(updated['id']).toBeUndefined();
    expect(saved.cover.imageUrl).toContain('/storage/v1/object/public/shagun-photos/w1/');
    expect(saved.gallery![0].url).toContain('/shagun-photos/w1/');
  });

  it('removes stored photos the couple replaced', async () => {
    fake.session = { user: { id: 'u1', email: 'asha@example.com' } };
    const old = 'https://p.supabase.co/storage/v1/object/public/shagun-photos/w1/old.jpg';
    fake.handler = (t, chain) => {
      if (t === T.weddings && chain.some(([n]) => n === 'maybeSingle')) return { data: row({ details: { ...toWeddingRow(wedding()).details, cover: { preset: 'rose', imageUrl: old } } }), error: null };
      return undefined;
    };
    await repo.saveWedding(wedding({ cover: { preset: 'rose' } }));
    expect(fake.removed).toEqual([['w1/old.jpg']]);
  });

  it('stores thank-you times as ISO timestamps when the couple updates a contribution', async () => {
    const id = '3f2b8a6c-1111-4222-8333-444455556666';
    fake.handler = (t) =>
      t === T.contributions
        ? { data: { id, wedding_id: 'w1', goal_id: 'g1', guest_name: 'K', amount: 501, message: '', phone: '919876543210', side: null, status: 'verified', thanked_at: '2026-11-02T00:00:00Z', created_at: '2026-11-01T00:00:00Z' }, error: null }
        : undefined;
    const c = await repo.updateContribution(id, { status: 'verified', thankedAt: Date.UTC(2026, 10, 2) });
    expect(fake.last(T.contributions).has('update')![1][0]).toEqual({ status: 'verified', thanked_at: '2026-11-02T00:00:00.000Z' });
    expect(c.phone).toBe('919876543210');
    expect(c.thankedAt).toBe(Date.UTC(2026, 10, 2));
  });

  it('turns row-level security refusals into a sign-in hint', async () => {
    fake.handler = () => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } });
    await expectAsync(repo.listContributions('w1')).toBeRejectedWithError(/Only the couple/);
    expect(friendlyError({ code: '23514', message: 'violates check constraint' }).message).toMatch(/not accepted/);
    expect(friendlyError({ message: 'Failed to fetch' }).message).toMatch(/internet/);
  });

  it('says whether the visitor owns a wedding', async () => {
    expect(await repo.isOwner('w1')).toBeFalse();
    fake.session = { user: { id: 'u1', email: 'a@b.co' } };
    fake.handler = (t) => (t === T.owners ? { data: [{ email: 'a@b.co' }], error: null } : undefined);
    expect(await repo.isOwner('w1')).toBeTrue();
  });

  it('adds co-owners by lower-cased email and inserts RSVPs', async () => {
    await repo.addOwner('w1', ' Partner@Example.COM ');
    expect(fake.last(T.owners).has('insert')![1][0]).toEqual({ wedding_id: 'w1', email: 'partner@example.com' });
    await repo.addRsvp({ weddingId: 'w1', guestName: 'Sharma Parivar', eventIds: ['e1'], partySize: 4, note: '' });
    expect(fake.last(T.rsvps).has('insert')![1][0]).toEqual(jasmine.objectContaining({ event_ids: ['e1'], party_size: 4 }));
  });

  it('subscribes to realtime changes for one wedding and emits them', async () => {
    const stop = repo.watch('w1');
    expect(fake.channels[0].tables).toEqual([T.weddings, T.contributions, T.rsvps, T.guests]);
    const seen = new Promise((resolve) => repo.changes().pipe(take(1)).subscribe(resolve));
    await repo.addContribution({ weddingId: 'w1', goalId: 'g1', guestName: 'Kabir', amount: 501, message: '' });
    expect(await seen).toEqual({ weddingId: 'w1' });
    stop();
    expect(fake.removedChannels).toBe(1);
    repo.watch('w-demo')();
    expect(fake.channels.length).toBe(1);
  });

  it('decodes data URLs into blobs for upload', () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(8);
  });
});
