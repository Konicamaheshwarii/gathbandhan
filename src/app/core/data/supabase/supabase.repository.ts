import { Injectable, OnDestroy, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable, Subject, merge } from 'rxjs';
import {
  Contribution, ContributionStatus, CoverPreset, InviteLanguage, FeeBearer, PaymentMode, PaymentProvider, Families, GalleryPhoto, Goal, Guest, GuestInvite, GuestMark, InviteDesign, Milestone,
  NewContribution, NewRsvp, PublicActivity, Rsvp, Side, Wedding, WeddingEvent,
} from '../../models';
import { LocalStorageWeddingRepository } from '../local-storage.repository';
import { DEMO_SLUGS, isDemoId, isDemoSlug } from '../seed';
import { DemoPayment, RepositoryChange, WeddingRepository } from '../wedding.repository';
import { PHOTO_BUCKET, RPC, SUPABASE_CLIENT, T } from './supabase.token';

/** Columns guests may read (the schema grants exactly these, not created_by). */
export const WEDDING_COLUMNS =
  'id,slug,partner1,partner2,wedding_date,venue,city,upi_id,payee_name,show_amounts,details,created_at,payment_mode,fee_bearer,razorpay_active';

export interface WeddingRow {
  id: string;
  slug: string;
  partner1: string;
  partner2: string;
  wedding_date: string;
  venue: string;
  city: string;
  upi_id: string;
  payee_name: string;
  show_amounts: boolean;
  details: WeddingDetails;
  created_at?: string;
  payment_mode?: PaymentMode;
  fee_bearer?: FeeBearer;
  /** Read-only: the database sets it from the payout account. */
  razorpay_active?: boolean;
}

interface WeddingDetails {
  cover?: { preset: CoverPreset; imageUrl?: string };
  story?: string;
  goals?: Goal[];
  events?: WeddingEvent[];
  families?: Families;
  gallery?: GalleryPhoto[];
  milestones?: Milestone[];
  invite?: InviteDesign;
}

export interface GuestRow {
  id: string;
  wedding_id: string;
  name: string;
  greeting: string | null;
  phone: string | null;
  side: Side | null;
  group_name: string | null;
  /** Only sent when the couple picked (or cleared) a language, so older databases keep working. */
  language?: InviteLanguage | null;
  token: string;
  sent_at: string | null;
  opened_at: string | null;
  rsvp_at: string | null;
  gave_at: string | null;
  created_at: string;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : undefined);

export function toGuestRow(g: Guest): GuestRow {
  return {
    id: g.id,
    wedding_id: g.weddingId,
    name: g.name,
    greeting: g.greeting ?? null,
    phone: g.phone ?? null,
    side: g.side ?? null,
    group_name: g.group ?? null,
    ...('language' in g ? { language: g.language ?? null } : {}),
    token: g.token,
    sent_at: iso(g.sentAt),
    opened_at: iso(g.openedAt),
    rsvp_at: iso(g.rsvpAt),
    gave_at: iso(g.gaveAt),
    created_at: new Date(g.createdAt).toISOString(),
  };
}

export function fromGuestRow(r: GuestRow): Guest {
  const g: Guest = { id: r.id, weddingId: r.wedding_id, name: r.name, token: r.token, createdAt: Date.parse(r.created_at) };
  if (r.greeting) g.greeting = r.greeting;
  if (r.phone) g.phone = r.phone;
  if (r.side) g.side = r.side;
  if (r.group_name) g.group = r.group_name;
  if (r.language) g.language = r.language;
  const set = (key: 'sentAt' | 'openedAt' | 'rsvpAt' | 'gaveAt', v: string | null) => { const t = ms(v); if (t) g[key] = t; };
  set('sentAt', r.sent_at);
  set('openedAt', r.opened_at);
  set('rsvpAt', r.rsvp_at);
  set('gaveAt', r.gave_at);
  return g;
}

export interface ContributionRow {
  id: string;
  wedding_id: string;
  goal_id: string;
  guest_name: string;
  amount: number;
  message: string;
  phone: string | null;
  side: Side | null;
  status: ContributionStatus;
  thanked_at: string | null;
  created_at: string;
  provider?: PaymentProvider;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  charged_amount?: number | string | null;
  guest_fee?: number | string | null;
  fee_amount?: number | string | null;
  paid_at?: string | null;
}

export interface RsvpRow {
  id: string;
  wedding_id: string;
  guest_name: string;
  phone: string | null;
  side: Side | null;
  event_ids: string[];
  party_size: number;
  note: string;
  created_at: string;
}

export function toWeddingRow(w: Wedding): WeddingRow {
  return {
    id: w.id,
    slug: w.slug,
    partner1: w.partner1,
    partner2: w.partner2,
    wedding_date: w.date,
    venue: w.venue,
    city: w.city,
    upi_id: w.upiId,
    payee_name: w.payeeName,
    show_amounts: w.showAmounts,
    payment_mode: w.paymentMode ?? 'upi_direct',
    fee_bearer: w.feeBearer ?? 'couple',
    details: {
      cover: w.cover,
      story: w.story,
      goals: w.goals,
      events: w.events ?? [],
      families: w.families ?? {},
      gallery: w.gallery ?? [],
      milestones: w.milestones ?? [],
      ...(w.invite ? { invite: w.invite } : {}),
    },
  };
}

export function fromWeddingRow(r: WeddingRow): Wedding {
  const d = r.details ?? {};
  return {
    id: r.id,
    slug: r.slug,
    partner1: r.partner1,
    partner2: r.partner2,
    date: r.wedding_date,
    venue: r.venue ?? '',
    city: r.city ?? '',
    cover: d.cover ?? { preset: 'marigold' },
    story: d.story ?? '',
    goals: Array.isArray(d.goals) ? d.goals : [],
    events: Array.isArray(d.events) ? d.events : [],
    families: d.families ?? {},
    gallery: Array.isArray(d.gallery) ? d.gallery : [],
    milestones: Array.isArray(d.milestones) ? d.milestones : [],
    ...(d.invite ? { invite: d.invite } : {}),
    upiId: r.upi_id,
    payeeName: r.payee_name,
    showAmounts: !!r.show_amounts,
    paymentMode: r.payment_mode === 'razorpay' ? 'razorpay' : 'upi_direct',
    feeBearer: r.fee_bearer === 'guest' ? 'guest' : 'couple',
    razorpayActive: !!r.razorpay_active,
    createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
  };
}

export function fromContributionRow(r: ContributionRow): Contribution {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    goalId: r.goal_id,
    guestName: r.guest_name,
    amount: r.amount,
    message: r.message ?? '',
    ...(r.phone ? { phone: r.phone } : {}),
    ...(r.side ? { side: r.side } : {}),
    createdAt: Date.parse(r.created_at),
    status: r.status,
    ...(r.thanked_at ? { thankedAt: Date.parse(r.thanked_at) } : {}),
    ...(r.provider === 'razorpay' ? { provider: 'razorpay' as const } : {}),
    ...(r.razorpay_order_id ? { razorpayOrderId: r.razorpay_order_id } : {}),
    ...(r.razorpay_payment_id ? { razorpayPaymentId: r.razorpay_payment_id } : {}),
    ...(r.charged_amount != null ? { chargedAmount: Number(r.charged_amount) } : {}),
    ...(Number(r.guest_fee ?? 0) ? { guestFee: Number(r.guest_fee) } : {}),
    ...(Number(r.fee_amount ?? 0) ? { fee: Number(r.fee_amount) } : {}),
    ...(r.paid_at ? { paidAt: Date.parse(r.paid_at) } : {}),
  };
}

export function fromRsvpRow(r: RsvpRow): Rsvp {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    guestName: r.guest_name,
    ...(r.phone ? { phone: r.phone } : {}),
    ...(r.side ? { side: r.side } : {}),
    eventIds: r.event_ids ?? [],
    partySize: r.party_size,
    note: r.note ?? '',
    createdAt: Date.parse(r.created_at),
  };
}

/** Postgres / PostgREST errors as messages a couple or guest can act on. */
export function friendlyError(error: { code?: string; message?: string } | null | undefined): Error {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new Error('Only the couple can do that. Please sign in with the email that owns this page.');
  }
  if (code === '23505') return new Error('That already exists.');
  if (code === '23514' || code === '22001' || code === '23502') {
    return new Error(/dream|function|owner/i.test(message) ? message : 'Some details were not accepted. Check the amount, name and message length.');
  }
  if (/fetch|network|failed to fetch/i.test(message)) return new Error('Could not reach the server. Check your internet connection and try again.');
  return new Error(message || 'Something went wrong. Please try again.');
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);

/** Every photo URL in a wedding, with a setter so uploads can replace data URLs in place. */
export function photoSlots(w: Wedding): { get: () => string | undefined; set: (url: string) => void }[] {
  const slots: { get: () => string | undefined; set: (url: string) => void }[] = [
    { get: () => w.cover.imageUrl, set: (u) => (w.cover = { ...w.cover, imageUrl: u }) },
  ];
  for (const g of w.goals) {
    slots.push({ get: () => g.imageUrl, set: (u) => (g.imageUrl = u) });
    for (const u of g.updates ?? []) slots.push({ get: () => u.imageUrl, set: (x) => (u.imageUrl = x) });
  }
  for (const p of w.gallery ?? []) slots.push({ get: () => p.url, set: (u) => (p.url = u) });
  return slots;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Unsupported image.');
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return new Blob([bytes], { type: m[1] });
}

/**
 * Supabase implementation. Guests use the public anon key; Row Level Security (supabase/schema.sql)
 * decides what they can read and write. The bundled sample wedding stays in localStorage so the
 * demo keeps working for everyone, even with the backend switched on.
 */
@Injectable()
export class SupabaseWeddingRepository extends WeddingRepository implements OnDestroy {
  readonly mode = 'supabase' as const;

  private readonly client = inject(SUPABASE_CLIENT) as SupabaseClient;
  private readonly local = new LocalStorageWeddingRepository();
  private readonly changes$ = new Subject<RepositoryChange>();

  ngOnDestroy(): void {
    this.local.ngOnDestroy();
  }

  changes(): Observable<RepositoryChange> {
    return merge(this.changes$, this.local.changes());
  }

  override watch(weddingId: string): () => void {
    if (isDemoId(weddingId)) return () => undefined;
    const emit = () => this.changes$.next({ weddingId });
    const channel = this.client
      .channel(`wedding-${weddingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: T.weddings, filter: `id=eq.${weddingId}` }, emit)
      .on('postgres_changes', { event: '*', schema: 'public', table: T.contributions, filter: `wedding_id=eq.${weddingId}` }, emit)
      .on('postgres_changes', { event: '*', schema: 'public', table: T.rsvps, filter: `wedding_id=eq.${weddingId}` }, emit)
      .on('postgres_changes', { event: '*', schema: 'public', table: T.guests, filter: `wedding_id=eq.${weddingId}` }, emit)
      .subscribe();
    return () => void this.client.removeChannel(channel);
  }

  // ---------- weddings ----------

  async listWeddings(): Promise<Wedding[]> {
    const demo = (await this.local.listWeddings()).filter((w) => w.demo);
    if (!(await this.signedIn())) return demo;
    const owned = await this.run(this.client.from(T.owners).select('wedding_id'));
    const ids = [...new Set((owned as { wedding_id: string }[]).map((o) => o.wedding_id))];
    if (!ids.length) return demo;
    const rows = await this.run(this.client.from(T.weddings).select(WEDDING_COLUMNS).in('id', ids).order('created_at', { ascending: false }));
    return [...(rows as WeddingRow[]).map(fromWeddingRow), ...demo];
  }

  async getWeddingBySlug(slug: string): Promise<Wedding | null> {
    if (isDemoSlug(slug)) return this.local.getWeddingBySlug(slug);
    const row = await this.run(this.client.from(T.weddings).select(WEDDING_COLUMNS).eq('slug', slug).maybeSingle());
    return row ? fromWeddingRow(row as WeddingRow) : null;
  }

  async saveWedding(wedding: Wedding): Promise<Wedding> {
    if (wedding.demo || isDemoId(wedding.id)) return this.local.saveWedding(wedding);
    if (!(await this.signedIn())) throw new Error('Please sign in first, so only you can edit your page.');

    const w: Wedding = structuredClone(wedding);
    w.slug = await this.freeSlug(w.slug, w.id);
    const existing = await this.run(this.client.from(T.weddings).select('id,details').eq('id', w.id).maybeSingle());

    if (!existing) {
      // Create the row first (without photos): ownership exists from then on, which storage needs.
      const bare = structuredClone(w);
      photoSlots(bare).forEach((s) => s.get()?.startsWith('data:') && s.set(''));
      await this.run(this.client.from(T.weddings).insert(toWeddingRow(bare)));
    }

    for (const slot of photoSlots(w)) {
      const url = slot.get();
      if (url?.startsWith('data:')) slot.set(await this.uploadPhoto(w.id, url));
    }
    const { id: _id, ...patch } = toWeddingRow(w);
    await this.run(this.client.from(T.weddings).update(patch).eq('id', w.id));

    if (existing) await this.removeUnusedPhotos(fromWeddingRow({ ...toWeddingRow(w), details: (existing as WeddingRow).details }), w);
    this.changes$.next({ weddingId: w.id });
    return { ...w, demo: undefined, imported: undefined };
  }

  async deleteWedding(id: string): Promise<void> {
    if (isDemoId(id)) return this.local.deleteWedding(id);
    const files = await this.client.storage.from(PHOTO_BUCKET).list(id);
    const paths = (files.data ?? []).map((f) => `${id}/${f.name}`);
    if (paths.length) await this.client.storage.from(PHOTO_BUCKET).remove(paths);
    await this.run(this.client.from(T.weddings).delete().eq('id', id));
    this.changes$.next({ weddingId: id });
  }

  async isOwner(weddingId: string): Promise<boolean> {
    if (isDemoId(weddingId)) return true;
    if (!(await this.signedIn())) return false;
    const rows = await this.run(this.client.from(T.owners).select('email').eq('wedding_id', weddingId).limit(1));
    return (rows as unknown[]).length > 0;
  }

  // ---------- contributions ----------

  async getPublicActivity(weddingId: string): Promise<PublicActivity> {
    if (isDemoId(weddingId)) return this.local.getPublicActivity(weddingId);
    const data = (await this.run(this.client.rpc(RPC.publicActivity, { p_wedding_id: weddingId }))) as PublicActivity | null;
    return {
      goals: data?.goals ?? {},
      raised: Number(data?.raised ?? 0),
      contributors: Number(data?.contributors ?? 0),
      wall: (data?.wall ?? []).map((e) => ({ ...e, createdAt: Number(e.createdAt) })),
    };
  }

  async listContributions(weddingId: string): Promise<Contribution[]> {
    if (isDemoId(weddingId)) return this.local.listContributions(weddingId);
    const rows = await this.run(
      this.client.from(T.contributions).select('*').eq('wedding_id', weddingId).order('created_at', { ascending: false }),
    );
    return (rows as ContributionRow[]).map(fromContributionRow);
  }

  async addContribution(input: NewContribution): Promise<Contribution> {
    if (isDemoId(input.weddingId)) return this.local.addContribution(input);
    const id = crypto.randomUUID();
    // Insert only: guests cannot read contributions back (RLS), so no `.select()` here.
    await this.run(
      this.client.from(T.contributions).insert({
        id,
        wedding_id: input.weddingId,
        goal_id: input.goalId,
        guest_name: input.guestName,
        amount: input.amount,
        message: input.message,
        phone: input.phone ?? null,
        side: input.side ?? null,
      }),
    );
    this.changes$.next({ weddingId: input.weddingId });
    return { ...input, id, createdAt: Date.now(), status: 'guest-confirmed' };
  }

  async recordDemoPayment(input: NewContribution, payment: DemoPayment): Promise<Contribution> {
    if (isDemoId(input.weddingId)) return this.local.recordDemoPayment(input, payment);
    throw new Error('Simulated payments only exist on the sample wedding.');
  }

  async updateContribution(id: string, patch: Partial<Pick<Contribution, 'status' | 'thankedAt'>>): Promise<Contribution> {
    if (!isUuid(id)) return this.local.updateContribution(id, patch);
    const row: Record<string, unknown> = {};
    if ('status' in patch) row['status'] = patch.status;
    if ('thankedAt' in patch) row['thanked_at'] = iso(patch.thankedAt);
    const saved = await this.run(this.client.from(T.contributions).update(row).eq('id', id).select('*').single());
    const c = fromContributionRow(saved as ContributionRow);
    this.changes$.next({ weddingId: c.weddingId });
    return c;
  }

  async deleteContribution(id: string): Promise<void> {
    if (!isUuid(id)) return this.local.deleteContribution(id);
    await this.run(this.client.from(T.contributions).delete().eq('id', id));
    this.changes$.next({ weddingId: null });
  }

  // ---------- RSVPs ----------

  async listRsvps(weddingId: string): Promise<Rsvp[]> {
    if (isDemoId(weddingId)) return this.local.listRsvps(weddingId);
    const rows = await this.run(this.client.from(T.rsvps).select('*').eq('wedding_id', weddingId).order('created_at', { ascending: false }));
    return (rows as RsvpRow[]).map(fromRsvpRow);
  }

  async addRsvp(input: NewRsvp): Promise<Rsvp> {
    if (isDemoId(input.weddingId)) return this.local.addRsvp(input);
    const id = crypto.randomUUID();
    await this.run(
      this.client.from(T.rsvps).insert({
        id,
        wedding_id: input.weddingId,
        guest_name: input.guestName,
        phone: input.phone ?? null,
        side: input.side ?? null,
        event_ids: input.eventIds,
        party_size: input.partySize,
        note: input.note,
      }),
    );
    this.changes$.next({ weddingId: input.weddingId });
    return { ...input, id, createdAt: Date.now() };
  }

  async deleteRsvp(id: string): Promise<void> {
    if (!isUuid(id)) return this.local.deleteRsvp(id);
    await this.run(this.client.from(T.rsvps).delete().eq('id', id));
    this.changes$.next({ weddingId: null });
  }

  // ---------- guests (invites) ----------

  async listGuests(weddingId: string): Promise<Guest[]> {
    if (isDemoId(weddingId)) return this.local.listGuests(weddingId);
    const rows = await this.run(this.client.from(T.guests).select('*').eq('wedding_id', weddingId).order('created_at'));
    return (rows as GuestRow[]).map(fromGuestRow);
  }

  async saveGuests(guests: Guest[]): Promise<void> {
    if (!guests.length) return;
    if (isDemoId(guests[0].weddingId)) return this.local.saveGuests(guests);
    // Backend rows need uuid ids; demo-style ids are replaced on first save.
    const rows = guests.map((g) => toGuestRow(isUuid(g.id) ? g : { ...g, id: crypto.randomUUID() }));
    for (let i = 0; i < rows.length; i += 500) {
      await this.run(this.client.from(T.guests).upsert(rows.slice(i, i + 500), { onConflict: 'id' }));
    }
    this.changes$.next({ weddingId: guests[0].weddingId });
  }

  async deleteGuest(id: string): Promise<void> {
    if (!isUuid(id)) return this.local.deleteGuest(id);
    await this.run(this.client.from(T.guests).delete().eq('id', id));
    this.changes$.next({ weddingId: null });
  }

  async getGuestInvite(weddingId: string, token: string): Promise<GuestInvite | null> {
    if (isDemoId(weddingId)) return this.local.getGuestInvite(weddingId, token);
    const data = (await this.run(this.client.rpc(RPC.guestInvite, { p_wedding_id: weddingId, p_token: token }))) as GuestInvite | null;
    return data?.name ? { name: data.name, greeting: data.greeting || data.name } : null;
  }

  async markGuest(weddingId: string, token: string, mark: GuestMark): Promise<void> {
    if (isDemoId(weddingId)) return this.local.markGuest(weddingId, token, mark);
    await this.run(this.client.rpc(RPC.guestMark, { p_wedding_id: weddingId, p_token: token, p_mark: mark }));
  }

  // ---------- co-owners ----------

  async listOwners(weddingId: string): Promise<string[]> {
    if (isDemoId(weddingId)) return [];
    const rows = await this.run(this.client.from(T.owners).select('email').eq('wedding_id', weddingId).order('added_at'));
    return (rows as { email: string }[]).map((r) => r.email);
  }

  async addOwner(weddingId: string, email: string): Promise<void> {
    if (isDemoId(weddingId)) return this.local.addOwner();
    await this.run(this.client.from(T.owners).insert({ wedding_id: weddingId, email: email.trim().toLowerCase() }));
  }

  async removeOwner(weddingId: string, email: string): Promise<void> {
    if (isDemoId(weddingId)) return this.local.removeOwner();
    await this.run(this.client.from(T.owners).delete().eq('wedding_id', weddingId).eq('email', email.trim().toLowerCase()));
  }

  resetDemo(): Promise<void> {
    return this.local.resetDemo();
  }

  // ---------- helpers ----------

  private async signedIn(): Promise<boolean> {
    const { data } = await this.client.auth.getSession();
    return !!data.session;
  }

  /** Unwraps a PostgREST response, turning errors into friendly ones. */
  private async run<T>(query: PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>): Promise<T> {
    let result: { data: T; error: { code?: string; message?: string } | null };
    try {
      result = await query;
    } catch (e) {
      throw friendlyError({ message: (e as Error).message });
    }
    if (result.error) throw friendlyError(result.error);
    return result.data;
  }

  private async freeSlug(base: string, id: string): Promise<string> {
    const rows = (await this.run(this.client.from(T.weddings).select('id,slug').like('slug', `${base}%`))) as { id: string; slug: string }[];
    const taken = new Set([...DEMO_SLUGS, ...rows.filter((r) => r.id !== id).map((r) => r.slug)]);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    return slug;
  }

  private async uploadPhoto(weddingId: string, dataUrl: string): Promise<string> {
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${weddingId}/${crypto.randomUUID()}.${ext}`;
    const bucket = this.client.storage.from(PHOTO_BUCKET);
    const { error } = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw new Error(`Could not upload a photo: ${error.message}`);
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  /** Deletes stored photos the couple removed or replaced (best effort). */
  private async removeUnusedPhotos(before: Wedding, after: Wedding): Promise<void> {
    const marker = `/${PHOTO_BUCKET}/`;
    const paths = (w: Wedding) =>
      new Set(photoSlots(w).map((s) => s.get() ?? '').filter((u) => u.includes(marker)).map((u) => u.split(marker)[1]));
    const keep = paths(after);
    const gone = [...paths(before)].filter((p) => !keep.has(p));
    if (gone.length) await this.client.storage.from(PHOTO_BUCKET).remove(gone);
  }
}
