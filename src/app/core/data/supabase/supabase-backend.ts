import { Provider } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { AUTH_ERROR_KEY, AUTH_NEXT_KEY, AuthService } from '../../auth/auth.service';
import { RuntimeConfig } from '../../config';
import { WeddingRepository } from '../wedding.repository';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseWeddingRepository } from './supabase.repository';
import { SUPABASE_CLIENT } from './supabase.token';

/**
 * Loaded with a dynamic import from main.ts only when config.json has Supabase keys, so demo
 * mode never downloads supabase-js.
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
  const { data } = await client.auth.getSession();

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
  ];
}
