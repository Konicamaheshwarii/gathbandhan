/**
 * Runtime configuration read from `public/config.json` before the app starts, so the owner can
 * switch the backend on by editing one file (no rebuild of the code needed, CI just redeploys).
 * Empty values keep the app in demo mode: localStorage plus the bundled sample wedding.
 */
export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const EMPTY_CONFIG: RuntimeConfig = { supabaseUrl: '', supabaseAnonKey: '' };

export function hasBackend(c: RuntimeConfig | null | undefined): c is RuntimeConfig {
  return !!c && /^https:\/\/\S+$/.test(c.supabaseUrl.trim()) && c.supabaseAnonKey.trim().length > 20;
}

export function parseConfig(raw: unknown): RuntimeConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return { supabaseUrl: str(o['supabaseUrl']).replace(/\/+$/, ''), supabaseAnonKey: str(o['supabaseAnonKey']) };
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
