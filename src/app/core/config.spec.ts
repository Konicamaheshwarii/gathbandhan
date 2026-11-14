import { hasBackend, loadRuntimeConfig, parseConfig } from './config';

describe('runtime config', () => {
  it('stays in demo mode when the keys are empty or malformed', () => {
    expect(hasBackend(parseConfig({ supabaseUrl: '', supabaseAnonKey: '' }))).toBeFalse();
    expect(hasBackend(parseConfig({ supabaseUrl: 'http://insecure.example', supabaseAnonKey: 'x'.repeat(40) }))).toBeFalse();
    expect(hasBackend(parseConfig({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'short' }))).toBeFalse();
    expect(hasBackend(parseConfig(null))).toBeFalse();
  });

  it('switches the backend on with a project URL and anon key', () => {
    const c = parseConfig({ supabaseUrl: ' https://abc.supabase.co/ ', supabaseAnonKey: 'eyJ' + 'x'.repeat(100) });
    expect(c.supabaseUrl).toBe('https://abc.supabase.co');
    expect(hasBackend(c)).toBeTrue();
  });

  it('treats a missing or broken config.json as demo mode', async () => {
    const missing = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    const broken = (async () => new Response('{oops', { status: 200 })) as unknown as typeof fetch;
    const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    for (const f of [missing, broken, offline]) expect(hasBackend(await loadRuntimeConfig(f))).toBeFalse();
  });
});
