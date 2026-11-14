import { Provider } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AUTH_ERROR_KEY, AUTH_NEXT_KEY, AuthService } from '../../auth/auth.service';
import { BACKEND_STATUS, BackendNotReady, backendProblem } from '../../backend-status';
import { RuntimeConfig } from '../../config';
import { WeddingRepository } from '../wedding.repository';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseWeddingRepository } from './supabase.repository';
import { SUPABASE_CLIENT, T } from './supabase.token';

const PROBE_TIMEOUT_MS = 8_000;

/**
 * One cheap read of the weddings table. Any problem (tables missing because schema.sql was not
 * run yet, a paused project, a wrong key, no network) means the app should not use the backend.
 */
export async function probeBackend(client: Pick<SupabaseClient, 'from'>, timeoutMs = PROBE_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ error: { message: string } }>((resolve) => {
    timer = setTimeout(() => resolve({ error: { message: 'timed out' } }), timeoutMs);
  });
  try {
    const result = (await Promise.race([client.from(T.weddings).select('id').limit(1), timeout])) as { error: { code?: string; message?: string } | null };
    if (result.error) throw new BackendNotReady(backendProblem(result.error));
  } catch (e) {
    throw e instanceof BackendNotReady ? e : new BackendNotReady(backendProblem({ message: (e as Error).message }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loaded with a dynamic import from main.ts only when config.json has Supabase keys, so demo
 * mode never downloads supabase-js. Throws BackendNotReady when the backend fails its first check.
 *
 * The magic link returns to `…/shagun-wishlist/#access_token=…`, which collides with hash
 * routing. supabase-js reads the tokens while the client initialises (before Angular starts);
 * afterwards the URL is put back to the page the couple was on.
 */
export async function supabaseProviders(config: RuntimeConfig): Promise<Provider[]> {
  const hash = location.hash;
  const fromAuthLink = /(^#|&)(access_token|error_description)=/.test(hash);
  const authError = fromAuthLink ? new URLSearchParams(hash.slice(1)).get('error_description') : null;

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: 'sg.auth' },
  });
  const [{ data }] = await Promise.all([client.auth.getSession(), probeBackend(client)]);

  if (fromAuthLink) {
    let next = '/';
    try {
      next = localStorage.getItem(AUTH_NEXT_KEY) || '/';
      localStorage.removeItem(AUTH_NEXT_KEY);
      if (authError) sessionStorage.setItem(AUTH_ERROR_KEY, authError.replace(/\+/g, ' '));
    } catch {
      // storage blocked
    }
    history.replaceState(null, '', `${location.pathname}${location.search}#${authError ? '/login' : next}`);
  }

  return [
    { provide: SUPABASE_CLIENT, useValue: client },
    { provide: WeddingRepository, useClass: SupabaseWeddingRepository },
    { provide: AuthService, useValue: new SupabaseAuthService(client, data.session) },
    { provide: BACKEND_STATUS, useValue: { configured: true, online: true } },
  ];
}
