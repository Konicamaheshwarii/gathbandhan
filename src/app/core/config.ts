import { InjectionToken } from '@angular/core';

/**
 * Runtime configuration read from `public/config.json` before the app starts, so the owner can
 * switch the backend on by editing one file (no rebuild of the code needed, CI just redeploys).
 * Empty values keep the app in demo mode: localStorage plus the bundled sample wedding.
 */
export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * Razorpay's public Key ID (`rzp_test_…` or `rzp_live_…`). Public by design: the key SECRET
   * lives only in Supabase Edge Function secrets and never in this file or the app.
   */
  razorpayKeyId: string;
}

export const EMPTY_CONFIG: RuntimeConfig = { supabaseUrl: '', supabaseAnonKey: '', razorpayKeyId: '' };

/** The config main.ts loaded (empty in tests unless a test provides one). */
export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG', { providedIn: 'root', factory: () => EMPTY_CONFIG });

export function hasBackend(c: RuntimeConfig | null | undefined): c is RuntimeConfig {
  return !!c && /^https:\/\/\S+$/.test(c.supabaseUrl.trim()) && c.supabaseAnonKey.trim().length > 20;
}

export function parseConfig(raw: unknown): RuntimeConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const key = str(o['razorpayKeyId']);
  return {
    supabaseUrl: str(o['supabaseUrl']).replace(/\/+$/, ''),
    supabaseAnonKey: str(o['supabaseAnonKey']),
    // Only a key id is accepted here; anything else (say, a pasted secret) is ignored.
    razorpayKeyId: /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/.test(key) ? key : '',
  };
}

/** Never throws: a missing or broken config.json simply means demo mode. */
export async function loadRuntimeConfig(fetchFn: typeof fetch = fetch): Promise<RuntimeConfig> {
  try {
    const res = await fetchFn('config.json', { cache: 'no-store' });
    return res.ok ? parseConfig(await res.json()) : EMPTY_CONFIG;
  } catch {
    return EMPTY_CONFIG;
  }
}
