import { BrowserContext, Route, WebSocketRoute, expect } from '@playwright/test';

/**
 * An in-memory stand-in for the Supabase project, installed with Playwright network routing.
 * It answers exactly what the app calls (PostgREST tables and RPCs, Auth, Storage, Edge
 * Functions and the Realtime websocket) at a fake host, so no test ever talks to the live
 * project, and no email is ever sent: `signInWithOtp` is only recorded in `emails`.
 *
 * Anything the mock does not understand is recorded in `unhandled` and fails the test (the
 * fixture checks it), so a new backend call cannot slip past silently.
 */

export const MOCK_HOST = 'e2e-mock.supabase.co';
export const MOCK_URL = `https://${MOCK_HOST}`;
export const MOCK_ANON_KEY = 'sb_publishable_e2e_mock_key_not_real_000000';
export const MOCK_RAZORPAY_KEY = 'rzp_test_E2EMockKey123';

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export interface MockUser {
  id: string;
  email: string;
}

export interface FunctionCall {
  name: string;
  body: Record<string, unknown>;
  auth: string;
}

type FunctionHandler = (body: Record<string, unknown>, mock: SupabaseMock) => { status?: number; json: unknown } | Promise<{ status?: number; json: unknown }>;

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** A JWT-shaped token (the mock never checks the signature). */
export function fakeJwt(user: MockUser, expSeconds = Math.floor(Date.now() / 1000) + 3600 * 24): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: expSeconds, iat: expSeconds - 3600 })}.${b64url('sig')}`;
}

export function authUser(user: MockUser): Row {
  const now = new Date().toISOString();
  return {
    id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, email_confirmed_at: now,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now, updated_at: now,
  };
}

/** The session supabase-js keeps in localStorage under the app's storage key. */
export function storedSession(user: MockUser): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 * 24;
  return JSON.stringify({
    access_token: fakeJwt(user, expiresAt), refresh_token: 'e2e-refresh-token', token_type: 'bearer',
    expires_in: 3600 * 24, expires_at: expiresAt, user: authUser(user),
  });
}

// ---------- PostgREST filters ----------

function parseValue(raw: string): string {
  return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
}

function matches(row: Row, column: string, expr: string): boolean {
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const value = expr.slice(dot + 1);
  const cell = row[column];
  switch (op) {
    case 'eq':
      return String(cell) === parseValue(value);
    case 'neq':
      return String(cell) !== parseValue(value);
    case 'in': {
      const list = value.replace(/^\(|\)$/g, '').split(',').map(parseValue);
      return list.includes(String(cell));
    }
    case 'like':
    case 'ilike': {
      const re = new RegExp(`^${value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return re.test(String(cell ?? ''));
    }
    case 'is':
      return value === 'null' ? cell == null : String(cell) === value;
    default:
      throw new Error(`Unsupported filter ${op}`);
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows.filter((r) => [...params.entries()].every(([k, v]) => RESERVED.has(k) || matches(r, k, v)));
  const order = params.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out = [...out].sort((a, b) => {
      const x = String(a[col] ?? '');
      const y = String(b[col] ?? '');
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1);
    });
  }
  const limit = params.get('limit');
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

function project(row: Row, select: string | null): Row {
  if (!select || select === '*') return { ...row };
  const out: Row = {};
  for (const col of select.split(',')) out[col] = row[col] ?? null;
  return out;
}

/** Columns the database fills in on insert. */
const DEFAULTS: Record<string, (row: Row) => Row> = {
  shagun_weddings: () => ({ created_at: new Date().toISOString(), payment_mode: 'upi_direct', fee_bearer: 'couple', razorpay_active: false }),
  shagun_contributions: () => ({ created_at: new Date().toISOString(), status: 'guest-confirmed', thanked_at: null, provider: 'upi_direct' }),
  shagun_rsvps: () => ({ created_at: new Date().toISOString() }),
  shagun_guests: () => ({ created_at: new Date().toISOString() }),
  shagun_profiles: () => ({
    full_name: '', display_name: '', phone: null, city: '', avatar_path: null, wedding_role: null, language: 'en', upi_id: null, payee_name: null,
    notify_shagun: true, notify_rsvp: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }),
  shagun_wedding_owners: () => ({ added_at: new Date().toISOString() }),
};

export interface MockOptions {
  /** Signed in already (a stored session). */
  user?: MockUser | null;
  /** Initial table rows. */
  tables?: Tables;
  /** signInWithOtp answers with Supabase's email rate limit. */
  rateLimitOtp?: boolean;
}

export class SupabaseMock {
  readonly tables: Tables;
  readonly emails: string[] = [];
  readonly functionCalls: FunctionCall[] = [];
  readonly uploads: string[] = [];
  readonly removed: string[] = [];
  /** Requests at the mock host the mock does not implement. Must stay empty. */
  readonly unhandled: string[] = [];
  readonly signOuts: string[] = [];
  /** Every PostgREST call as "METHOD table" or "RPC name", to check what a guest's browser reads. */
  readonly calls: string[] = [];
  user: MockUser | null;
  rateLimitOtp: boolean;
  private readonly functions = new Map<string, FunctionHandler>();
  private readonly sockets: { ws: WebSocketRoute; topics: Map<string, { joinRef: string; ids: { id: number; table: string }[] }> }[] = [];
  private nextChangeId = 1;

  constructor(opts: MockOptions = {}) {
    this.user = opts.user ?? null;
    this.rateLimitOtp = !!opts.rateLimitOtp;
    this.tables = {
      shagun_weddings: [], shagun_wedding_owners: [], shagun_contributions: [], shagun_rsvps: [], shagun_guests: [], shagun_profiles: [],
      ...structuredClone(opts.tables ?? {}),
    };
  }

  onFunction(name: string, handler: FunctionHandler): void {
    this.functions.set(name, handler);
  }

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  /** Installs the mock on a browser context (before any page opens). */
  async install(context: BrowserContext): Promise<void> {
    const config = { supabaseUrl: MOCK_URL, supabaseAnonKey: MOCK_ANON_KEY, razorpayKeyId: MOCK_RAZORPAY_KEY };
    await context.route(/\/gathbandhan\/config\.json(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }));
    await context.route(`${MOCK_URL}/**`, (route) => this.handle(route));
    await context.routeWebSocket(new RegExp(`^wss://${MOCK_HOST.replace(/\./g, '\\.')}/realtime/`), (ws) => this.socket(ws));
    if (this.user) {
      const session = storedSession(this.user);
      await context.addInitScript(([s]) => {
        if (!localStorage.getItem('sg.auth')) localStorage.setItem('sg.auth', s);
      }, [session]);
    }
  }

  /** Pushes a realtime change to every page subscribed to this table, like Postgres would. */
  emitChange(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', record: Row): void {
    for (const { ws, topics } of this.sockets) {
      for (const [topic, sub] of topics) {
        const ids = sub.ids.filter((s) => s.table === table).map((s) => s.id);
        if (!ids.length) continue;
        const payload = {
          ids,
          data: { schema: 'public', table, commit_timestamp: new Date().toISOString(), type, record, old_record: type === 'INSERT' ? {} : { id: record['id'] }, columns: [], errors: null },
        };
        ws.send(JSON.stringify([null, null, topic, 'postgres_changes', payload]));
      }
    }
  }

  /** Number of realtime channels the app has joined. */
  get channelCount(): number {
    return this.sockets.reduce((n, s) => n + s.topics.size, 0);
  }

  // ---------- routing ----------

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
    try {
      if (path.startsWith('/rest/v1/rpc/')) return await this.rpc(route, path.slice('/rest/v1/rpc/'.length), body(route));
      if (path.startsWith('/rest/v1/')) return await this.rest(route, path.slice('/rest/v1/'.length), url.searchParams);
      if (path.startsWith('/auth/v1/')) return await this.auth(route, path.slice('/auth/v1/'.length), url.searchParams);
      if (path.startsWith('/storage/v1/')) return await this.storage(route, path.slice('/storage/v1/'.length));
      if (path.startsWith('/functions/v1/')) return await this.fn(route, path.slice('/functions/v1/'.length));
    } catch (e) {
      this.unhandled.push(`${method} ${path}: ${(e as Error).message}`);
      return json(route, 500, { message: (e as Error).message });
    }
    this.unhandled.push(`${method} ${url.href}`);
    return json(route, 404, { message: 'not mocked' });
  }

  private async rest(route: Route, table: string, params: URLSearchParams): Promise<void> {
    const req = route.request();
    const method = req.method();
    const headers = req.headers();
    const prefer = headers['prefer'] ?? '';
    const single = (headers['accept'] ?? '').includes('vnd.pgrst.object');
    this.calls.push(`${method} ${table}`);
    const rows = this.table(table);
    const select = params.get('select');
    const representation = prefer.includes('return=representation');

    const reply = (data: Row[], status = 200) => {
      const shaped = data.map((r) => project(r, select));
      if (single) {
        if (shaped.length !== 1) return json(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: '', hint: null });
        return json(route, status, shaped[0]);
      }
      return json(route, status, shaped);
    };

    if (method === 'GET' || method === 'HEAD') return reply(filterRows(rows, params));

    if (method === 'POST') {
      const input = body(route);
      const list = (Array.isArray(input) ? input : [input]) as Row[];
      const upsert = prefer.includes('resolution=merge-duplicates');
      const conflict = params.get('on_conflict') ?? 'id';
      const saved: Row[] = [];
      for (const r of list) {
        const existing = upsert ? rows.find((x) => x[conflict] === r[conflict]) : undefined;
        if (existing) {
          Object.assign(existing, r);
          saved.push(existing);
        } else {
          const row = { ...(DEFAULTS[table]?.(r) ?? {}), ...r };
          if (!row['id'] && table !== 'shagun_wedding_owners') row['id'] = crypto.randomUUID();
          rows.push(row);
          saved.push(row);
          this.emitChange(table, 'INSERT', row);
        }
      }
      return representation ? reply(saved, 201) : route.fulfill({ status: 201, headers: cors(), body: '' });
    }

    if (method === 'PATCH') {
      const patch = body(route) as Row;
      const hit = filterRows(rows, params);
      for (const r of hit) {
        Object.assign(r, patch, table === 'shagun_profiles' ? { updated_at: new Date().toISOString() } : {});
        this.emitChange(table, 'UPDATE', r);
      }
      return representation ? reply(hit) : route.fulfill({ status: 204, headers: cors(), body: '' });
    }

    if (method === 'DELETE') {
      const hit = new Set(filterRows(rows, params));
      this.tables[table] = rows.filter((r) => !hit.has(r));
      for (const r of hit) this.emitChange(table, 'DELETE', r);
      return representation ? reply([...hit]) : route.fulfill({ status: 204, headers: cors(), body: '' });
    }

    throw new Error(`REST ${method} not mocked`);
  }

  private async rpc(route: Route, name: string, args: Row): Promise<void> {
    this.calls.push(`RPC ${name}`);
    const weddingId = String(args['p_wedding_id'] ?? '');
    if (name === 'shagun_public_activity') {
      const w = this.table('shagun_weddings').find((x) => x['id'] === weddingId);
      if (!w) return json(route, 200, null);
      const c = this.table('shagun_contributions')
        .filter((x) => x['wedding_id'] === weddingId && x['status'] !== 'pending' && x['status'] !== 'failed')
        .sort((a, b) => String(b['created_at']).localeCompare(String(a['created_at'])));
      const goals: Record<string, { raised: number; count: number }> = {};
      for (const x of c) {
        const g = (goals[String(x['goal_id'])] ??= { raised: 0, count: 0 });
        g.raised += Number(x['amount']);
        g.count++;
      }
      return json(route, 200, {
        raised: c.reduce((s, x) => s + Number(x['amount']), 0),
        contributors: new Set(c.map((x) => String(x['guest_name']).trim().toLowerCase())).size,
        goals,
        wall: c.map((m) => strip({
          id: m['id'], goalId: m['goal_id'], guestName: m['guest_name'], message: m['message'], side: m['side'],
          paid: m['status'] === 'paid' ? true : null, amount: w['show_amounts'] ? m['amount'] : null, createdAt: Date.parse(String(m['created_at'])),
        })),
      });
    }
    if (name === 'shagun_guest_invite') {
      const g = this.table('shagun_guests').find((x) => x['wedding_id'] === weddingId && x['token'] === args['p_token']);
      return json(route, 200, g ? { name: g['name'], greeting: String(g['greeting'] ?? '').trim() || g['name'] } : null);
    }
    if (name === 'shagun_guest_mark') {
      const g = this.table('shagun_guests').find((x) => x['wedding_id'] === weddingId && x['token'] === args['p_token']);
      if (g) {
        const now = new Date().toISOString();
        g['opened_at'] ??= now;
        if (args['p_mark'] === 'rsvp') g['rsvp_at'] ??= now;
        if (args['p_mark'] === 'gave') g['gave_at'] ??= now;
      }
      return route.fulfill({ status: 204, headers: cors(), body: '' });
    }
    if (name === 'shagun_order_status') {
      const c = this.table('shagun_contributions').find((x) => x['provider'] === 'razorpay' && x['razorpay_order_id'] === args['p_order_id']);
      return json(route, 200, c ? c['status'] : null);
    }
    throw new Error(`RPC ${name} not mocked`);
  }

  private async auth(route: Route, path: string, params: URLSearchParams): Promise<void> {
    const method = route.request().method();
    if (path === 'otp' && method === 'POST') {
      const email = String((body(route) as Row)['email'] ?? '');
      if (this.rateLimitOtp) return json(route, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' });
      this.emails.push(email); // recorded, never sent
      return json(route, 200, {});
    }
    if (path === 'user' && method === 'GET') {
      if (!this.user) return json(route, 401, { code: 401, msg: 'invalid JWT' });
      return json(route, 200, authUser(this.user));
    }
    if (path === 'logout' && method === 'POST') {
      this.signOuts.push(params.get('scope') ?? 'global');
      return route.fulfill({ status: 204, headers: cors(), body: '' });
    }
    if (path === 'token' && method === 'POST' && this.user) {
      const s = JSON.parse(storedSession(this.user));
      return json(route, 200, s);
    }
    throw new Error(`auth ${method} ${path} not mocked`);
  }

  private async storage(route: Route, path: string): Promise<void> {
    const method = route.request().method();
    if (path.startsWith('object/public/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG, headers: cors() });
    }
    if (path.startsWith('object/list/') && method === 'POST') {
      const prefix = String((body(route) as Row)['prefix'] ?? '');
      const names = this.uploads.filter((u) => u.startsWith(`${prefix}/`)).map((u) => ({ name: u.slice(prefix.length + 1), id: u }));
      return json(route, 200, names);
    }
    if (path.startsWith('object/shagun-photos/') && method === 'POST') {
      const key = path.slice('object/shagun-photos/'.length);
      this.uploads.push(key);
      return json(route, 200, { Key: `shagun-photos/${key}`, Id: crypto.randomUUID() });
    }
    if (path === 'object/shagun-photos' && method === 'DELETE') {
      const prefixes = ((body(route) as Row)['prefixes'] ?? []) as string[];
      this.removed.push(...prefixes);
      return json(route, 200, prefixes.map((name) => ({ name })));
    }
    throw new Error(`storage ${method} ${path} not mocked`);
  }

  private async fn(route: Route, name: string): Promise<void> {
    const req = route.request();
    const input = (body(route) ?? {}) as Record<string, unknown>;
    this.functionCalls.push({ name, body: input, auth: req.headers()['authorization'] ?? '' });
    const handler = this.functions.get(name);
    if (!handler) return json(route, 404, { error: 'Requested function was not found' });
    const { status = 200, json: out } = await handler(input, this);
    return json(route, status, out);
  }

  // ---------- realtime (Phoenix protocol, vsn 2.0.0: [join_ref, ref, topic, event, payload]) ----------

  private socket(ws: WebSocketRoute): void {
    const entry = { ws, topics: new Map<string, { joinRef: string; ids: { id: number; table: string }[] }>() };
    this.sockets.push(entry);
    ws.onMessage((raw) => {
      if (typeof raw !== 'string') return;
      const [joinRef, ref, topic, event, payload] = JSON.parse(raw) as [string, string, string, string, Row];
      const ok = (response: unknown = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]));
      if (event === 'phx_join') {
        const changes = (((payload['config'] as Row)?.['postgres_changes'] ?? []) as Row[]).map((c) => ({ ...c, id: this.nextChangeId++ }));
        entry.topics.set(topic, { joinRef, ids: changes.map((c) => ({ id: c['id'] as number, table: String(c['table']) })) });
        ok({ postgres_changes: changes });
        ws.send(JSON.stringify([joinRef, null, topic, 'system', { channel: topic.replace(/^realtime:/, ''), extension: 'postgres_changes', message: 'Subscribed to PostgreSQL', status: 'ok' }]));
      } else if (event === 'phx_leave') {
        entry.topics.delete(topic);
        ok();
      } else {
        ok(); // heartbeat, access_token…
      }
    });
    ws.onClose(() => {
      const i = this.sockets.indexOf(entry);
      if (i >= 0) this.sockets.splice(i, 1);
    });
  }
}

function cors(): Record<string, string> {
  return { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
}

function json(route: Route, status: number, data: unknown): Promise<void> {
  return route.fulfill({ status, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(data) });
}

function body(route: Route): Row {
  const raw = route.request().postData();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Row;
  } catch {
    return {};
  }
}

function strip(o: Row): Row {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}

/** Waits until the app has joined at least one realtime channel. */
export async function waitForRealtime(mock: SupabaseMock): Promise<void> {
  await expect.poll(() => mock.channelCount, { message: 'the app should join a realtime channel' }).toBeGreaterThan(0);
}
