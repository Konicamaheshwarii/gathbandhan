// Deno-only helpers for the Razorpay Edge Functions: environment, JSON responses, the
// service-role database client and the Razorpay REST client. Secrets are read from the
// environment (Supabase → Edge Functions → Secrets) and are never logged or returned.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { corsHeaders } from './razorpay-core.ts';

export function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? fallback;
  if (value === undefined || value === '') throw new ConfigError(`${name} is not set`);
  return value;
}

/** A missing secret: the owner has not finished setup. Reported without the value. */
export class ConfigError extends Error {}

/** An error with a message that is safe to show the guest or couple. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
}

export function preflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/** Runs a handler with CORS, method checks and safe error reporting. */
export function serve(handler: (req: Request, origin: string | null) => Promise<Response>, opts: { cors: boolean } = { cors: true }): void {
  Deno.serve(async (req) => {
    const origin = req.headers.get('origin');
    if (opts.cors && req.method === 'OPTIONS') return preflight(origin);
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
    try {
      return await handler(req, origin);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, origin);
      if (e instanceof ConfigError) {
        console.error('Configuration problem:', e.message);
        return json({ error: 'Payments are not fully set up yet. Please pay by UPI for now.' }, 503, origin);
      }
      console.error('Unexpected error:', e instanceof Error ? e.message : 'unknown');
      return json({ error: 'Something went wrong. Please try again.' }, 500, origin);
    }
  });
}

/** Service-role client: bypasses RLS, so only these functions can set a payment "paid". */
export function admin(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface RazorpayError {
  status: number;
  description: string;
}

/** Calls the Razorpay REST API with Basic auth (key id + secret). Throws RazorpayError. */
export async function razorpay<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const auth = btoa(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`);
  const res = await fetch(`https://api.razorpay.com${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const description = (data as { error?: { description?: string } }).error?.description ?? `Razorpay returned ${res.status}`;
    throw { status: res.status, description } satisfies RazorpayError;
  }
  return data as T;
}

export const isRazorpayError = (e: unknown): e is RazorpayError =>
  !!e && typeof e === 'object' && 'description' in e && 'status' in e;
