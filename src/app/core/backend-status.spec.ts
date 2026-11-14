import { BackendNotReady, backendProblem } from './backend-status';
import { probeBackend } from './data/supabase/supabase-backend';
import { T } from './data/supabase/supabase.token';

type Result = { data: unknown; error: { code?: string; message?: string } | null };

function client(result: Promise<Result> | (() => never)) {
  const tables: string[] = [];
  return {
    tables,
    from(table: string) {
      tables.push(table);
      return { select: () => ({ limit: () => (typeof result === 'function' ? result() : result) }) };
    },
  };
}

describe('backend start-up check', () => {
  it('passes when the shagun_ tables answer', async () => {
    const c = client(Promise.resolve({ data: [], error: null }));
    await expectAsync(probeBackend(c as never)).toBeResolved();
    expect(c.tables).toEqual([T.weddings]);
    expect(T.weddings).toBe('shagun_weddings');
  });

  it('falls back when schema.sql has not been run (missing table)', async () => {
    const c = client(Promise.resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.shagun_weddings' in the schema cache" } }));
    await expectAsync(probeBackend(c as never)).toBeRejectedWith(jasmine.any(BackendNotReady));
    await expectAsync(probeBackend(c as never)).toBeRejectedWithError(/not set up yet/);
  });

  it('falls back on network errors and timeouts', async () => {
    const thrown = client(() => { throw new TypeError('Failed to fetch'); });
    await expectAsync(probeBackend(thrown as never)).toBeRejectedWithError(/could not be reached/);
    const hanging = client(new Promise<Result>(() => undefined));
    await expectAsync(probeBackend(hanging as never, 20)).toBeRejectedWithError(/could not be reached/);
  });

  it('explains other problems in plain words', () => {
    expect(backendProblem({ code: '42P01', message: 'relation does not exist' })).toMatch(/schema\.sql/);
    expect(backendProblem({ message: 'Invalid API key' })).toMatch(/key/);
    expect(backendProblem({ code: '500', message: 'boom' })).toMatch(/problem/);
  });
});
