import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthUser } from '../../auth/auth.service';
import { ProfilesUnavailable } from '../../profile/profile.repository';
import { DELETE_ACCOUNT_FN, PROFILE_COLUMNS, ProfileRow, SupabaseProfileRepository, fromProfileRow, toProfileRow } from './supabase-profile.repository';
import { SUPABASE_CLIENT, T } from './supabase.token';

type Step = [string, unknown[]];
type Result = { data: unknown; error: { code?: string; message?: string } | null };

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
  order(...a: unknown[]) { return this.add('order', a); }
  maybeSingle() { return this.add('maybeSingle', []); }
  single() { return this.add('single', []); }
  then<A, B>(ok?: ((r: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    this.fake.queries.push(this);
    return Promise.resolve(this.fake.handler(this) ?? { data: [], error: null }).then(ok, fail);
  }
  op(): string {
    return this.chain.find(([n]) => ['insert', 'update', 'delete'].includes(n))?.[0] ?? 'select';
  }
  arg(name: string): unknown[] | undefined {
    return this.chain.find(([n]) => n === name)?.[1];
  }
}

class FakeSupabase {
  queries: FakeQuery[] = [];
  handler: (q: FakeQuery) => Result | undefined = () => undefined;
  uploads: { path: string; type: string }[] = [];
  removed: string[][] = [];
  listed: string[] = ['old.jpg'];
  invoked: { name: string; body: unknown }[] = [];
  invokeResult: { data: unknown; error: unknown } = { data: { deleted: true, weddingsDeleted: 1, weddingsLeft: 1 }, error: null };

  from(table: string) { return new FakeQuery(table, this); }
  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, blob: Blob) => {
        this.uploads.push({ path, type: blob.type });
        return { error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } }),
      list: async (folder: string) => ({ data: this.listed.map((name) => ({ name, folder })) }),
      remove: async (paths: string[]) => {
        this.removed.push(paths);
        return { error: null };
      },
    }),
  };
  functions = {
    invoke: async (name: string, opts: { body: unknown }) => {
      this.invoked.push({ name, body: opts.body });
      return this.invokeResult;
    },
  };
}

const USER: AuthUser = { id: '11111111-1111-4111-8111-111111111111', email: 'riya@example.com' };
const ROW: ProfileRow = {
  id: USER.id, full_name: 'Riya Sharma', display_name: '', phone: '+919876543210', city: 'Jaipur', avatar_path: `avatars/${USER.id}/a.jpg`,
  wedding_role: 'bride', language: 'hi', upi_id: 'riya@okaxis', payee_name: 'Riya Sharma', notify_shagun: true, notify_rsvp: false,
  created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z',
};

describe('SupabaseProfileRepository', () => {
  let fake: FakeSupabase;
  let repo: SupabaseProfileRepository;

  beforeEach(() => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: SUPABASE_CLIENT, useValue: fake }, SupabaseProfileRepository],
    });
    repo = TestBed.inject(SupabaseProfileRepository);
  });

  it('maps rows both ways, storing empty optional text as null', () => {
    const p = fromProfileRow(ROW, (path) => `https://cdn/${path}`);
    expect(p).toEqual(jasmine.objectContaining({ fullName: 'Riya Sharma', role: 'bride', language: 'hi', notifyRsvp: false, avatarUrl: `https://cdn/avatars/${USER.id}/a.jpg` }));
    expect(p.createdAt).toBe(Date.parse('2026-11-01T10:00:00Z'));
    expect(toProfileRow({ fullName: 'A', phone: '', upiId: '', payeeName: '' })).toEqual({ full_name: 'A', phone: null, upi_id: null, payee_name: null });
    expect(toProfileRow({ city: 'Pune' })).toEqual({ city: 'Pune' });
  });

  it('reads only the signed-in person\'s row', async () => {
    fake.handler = () => ({ data: ROW, error: null });
    const p = await repo.get(USER);
    const q = fake.queries[0];
    expect(q.table).toBe(T.profiles);
    expect(q.arg('select')).toEqual([PROFILE_COLUMNS]);
    expect(q.arg('eq')).toEqual(['id', USER.id]);
    expect(p!.avatarUrl).toBe(`https://cdn.example/avatars/${USER.id}/a.jpg`);
  });

  it('returns null before the first save, and ProfilesUnavailable when the table is missing', async () => {
    fake.handler = () => ({ data: null, error: null });
    expect(await repo.get(USER)).toBeNull();
    fake.handler = () => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.shagun_profiles'" } });
    await expectAsync(repo.get(USER)).toBeRejectedWithError(ProfilesUnavailable);
  });

  it('updates an existing row without an upsert', async () => {
    fake.handler = (q) => (q.op() === 'update' ? { data: [{ ...ROW, city: 'Pune' }], error: null } : undefined);
    const p = await repo.save(USER, { city: 'Pune' });
    expect(p.city).toBe('Pune');
    expect(fake.queries.length).toBe(1);
    expect(fake.queries[0].arg('update')).toEqual([{ city: 'Pune' }]);
    expect(fake.queries[0].arg('eq')).toEqual(['id', USER.id]);
  });

  it('inserts the first time, with the user id', async () => {
    fake.handler = (q) => (q.op() === 'update' ? { data: [], error: null } : { data: ROW, error: null });
    await repo.save(USER, { fullName: 'Riya Sharma' });
    expect(fake.queries.map((q) => q.op())).toEqual(['update', 'insert']);
    expect(fake.queries[1].arg('insert')).toEqual([{ full_name: 'Riya Sharma', id: USER.id }]);
  });

  it('explains rejected details kindly', async () => {
    fake.handler = () => ({ data: null, error: { code: '23514', message: 'violates check constraint "shagun_profiles_phone_check"' } });
    await expectAsync(repo.save(USER, { phone: '+1' })).toBeRejectedWithError(/phone number and UPI ID/);
  });

  it('uploads the avatar into avatars/<uid>/, saves the path, and removes the old file', async () => {
    fake.handler = (q) => (q.op() === 'update' ? { data: [ROW], error: null } : undefined);
    await repo.uploadAvatar(USER, 'data:image/jpeg;base64,/9j/AAAA');
    expect(fake.uploads.length).toBe(1);
    expect(fake.uploads[0].path).toMatch(new RegExp(`^avatars/${USER.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(fake.uploads[0].type).toBe('image/jpeg');
    const update = fake.queries.find((q) => q.op() === 'update')!;
    expect((update.arg('update')![0] as { avatar_path: string }).avatar_path).toBe(fake.uploads[0].path);
    expect(fake.removed).toEqual([[`avatars/${USER.id}/old.jpg`]]);
  });

  it('works out owner and co-owner from who was added first', async () => {
    fake.handler = () => ({
      data: [
        { wedding_id: 'w1', email: 'riya@example.com', added_at: '2026-01-01' },
        { wedding_id: 'w2', email: 'arjun@example.com', added_at: '2026-01-01' },
        { wedding_id: 'w1', email: 'arjun@example.com', added_at: '2026-02-01' },
        { wedding_id: 'w2', email: 'riya@example.com', added_at: '2026-02-01' },
      ],
      error: null,
    });
    expect(await repo.weddingAccess(USER, ['w1', 'w2'])).toEqual({ w1: 'owner', w2: 'co-owner' });
    expect(fake.queries[0].table).toBe(T.owners);
    expect(await repo.weddingAccess(USER, [])).toEqual({});
  });

  it('deletes the account through the Edge Function', async () => {
    const r = await repo.deleteAccount(USER, { deleteWeddings: true });
    expect(fake.invoked).toEqual([{ name: DELETE_ACCOUNT_FN, body: { deleteWeddings: true } }]);
    expect(r).toEqual({ weddingsDeleted: 1, weddingsLeft: 1 });
  });

  it('says clearly when the Edge Function is not deployed yet', async () => {
    fake.invokeResult = { data: null, error: { context: new Response('Not found', { status: 404 }) } };
    await expectAsync(repo.deleteAccount(USER, { deleteWeddings: false })).toBeRejectedWithError(/not switched on yet/);
  });
});
