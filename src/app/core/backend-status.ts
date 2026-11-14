import { InjectionToken } from '@angular/core';

/**
 * Whether the online backend is in use. `configured` but not `online` means config.json has keys
 * but the backend failed its first check (tables not created yet, project paused, no network), so
 * the app runs in demo mode and says why.
 */
export interface BackendStatus {
  configured: boolean;
  online: boolean;
  reason?: string;
}

export const BACKEND_STATUS = new InjectionToken<BackendStatus>('BACKEND_STATUS', {
  providedIn: 'root',
  factory: () => ({ configured: false, online: false }),
});

/** Thrown by the startup check; main.ts catches it and starts in demo mode. */
export class BackendNotReady extends Error {}

/** A friendly reason for the banner and Settings, from a PostgREST/network error. */
export function backendProblem(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message)) {
    return 'the online database is not set up yet (supabase/schema.sql has not been run)';
  }
  if (/fetch|network|timed out|timeout|load failed/i.test(message)) return 'the online database could not be reached';
  if (code === 'PGRST301' || /jwt|api key|apikey|invalid key/i.test(message)) return 'the Supabase key in config.json was not accepted';
  return 'the online database reported a problem';
}
