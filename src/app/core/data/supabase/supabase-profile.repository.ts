import { Injectable, inject } from '@angular/core';
import { AuthUser } from '../../auth/auth.service';
import { PaymentsUnavailable } from '../../payments/payments.models';
import { Profile, ProfileInput, ProfileLanguage, WeddingAccess, WeddingRole, emptyProfile } from '../../profile/profile.models';
import { DeleteAccountResult, ProfileRepository, ProfilesUnavailable } from '../../profile/profile.repository';
import { invokeFunction } from './supabase-payment-gateway';
import { dataUrlToBlob, friendlyError } from './supabase.repository';
import { PHOTO_BUCKET, SUPABASE_CLIENT, T } from './supabase.token';

export const PROFILE_COLUMNS =
  'id,full_name,display_name,phone,city,avatar_path,wedding_role,language,upi_id,payee_name,notify_shagun,notify_rsvp,created_at,updated_at';

export const DELETE_ACCOUNT_FN = 'shagun-delete-account';

export interface ProfileRow {
  id: string;
  full_name: string;
  display_name: string;
  phone: string | null;
  city: string;
  avatar_path: string | null;
  wedding_role: WeddingRole | null;
  language: ProfileLanguage;
  upi_id: string | null;
  payee_name: string | null;
  notify_shagun: boolean;
  notify_rsvp: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Only the fields being changed, as columns. Empty optional text is stored as null. */
export function toProfileRow(input: ProfileInput): Partial<ProfileRow> {
  const row: Partial<ProfileRow> = {};
  if (input.fullName !== undefined) row.full_name = input.fullName;
  if (input.displayName !== undefined) row.display_name = input.displayName;
  if (input.phone !== undefined) row.phone = input.phone || null;
  if (input.city !== undefined) row.city = input.city;
  if (input.role !== undefined) row.wedding_role = input.role;
  if (input.language !== undefined) row.language = input.language;
  if (input.upiId !== undefined) row.upi_id = input.upiId || null;
  if (input.payeeName !== undefined) row.payee_name = input.payeeName || null;
  if (input.notifyShagun !== undefined) row.notify_shagun = input.notifyShagun;
  if (input.notifyRsvp !== undefined) row.notify_rsvp = input.notifyRsvp;
  return row;
}

export function fromProfileRow(r: ProfileRow, publicUrl: (path: string) => string): Profile {
  return {
    ...emptyProfile(r.id),
    fullName: r.full_name ?? '',
    displayName: r.display_name ?? '',
    phone: r.phone ?? '',
    city: r.city ?? '',
    avatarPath: r.avatar_path ?? '',
    avatarUrl: r.avatar_path ? publicUrl(r.avatar_path) : '',
    role: r.wedding_role ?? null,
    language: r.language ?? 'en',
    upiId: r.upi_id ?? '',
    payeeName: r.payee_name ?? '',
    notifyShagun: r.notify_shagun ?? true,
    notifyRsvp: r.notify_rsvp ?? true,
    createdAt: r.created_at ? Date.parse(r.created_at) : 0,
    updatedAt: r.updated_at ? Date.parse(r.updated_at) : 0,
  };
}

/** The table is missing (schema.sql not updated yet) or not exposed. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message ?? '');
}

type Result<T> = { data: T; error: { code?: string; message?: string } | null };

/** Profiles in shagun_profiles. RLS limits every query to the caller's own row. */
@Injectable()
export class SupabaseProfileRepository extends ProfileRepository {
  readonly mode = 'supabase' as const;
  private readonly client = inject(SUPABASE_CLIENT);

  async get(user: AuthUser): Promise<Profile | null> {
    const row = await this.run(this.client.from(T.profiles).select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle());
    return row ? this.fromRow(row as ProfileRow) : null;
  }

  async save(user: AuthUser, input: ProfileInput): Promise<Profile> {
    const patch = toProfileRow(input);
    // Update first; the very first save inserts. (An upsert would need UPDATE on the id column.)
    const updated = (await this.run(this.client.from(T.profiles).update(patch).eq('id', user.id).select(PROFILE_COLUMNS))) as ProfileRow[];
    if (updated.length) return this.fromRow(updated[0]);
    const row = await this.run(this.client.from(T.profiles).insert({ ...patch, id: user.id }).select(PROFILE_COLUMNS).single());
    return this.fromRow(row as ProfileRow);
  }

  async uploadAvatar(user: AuthUser, dataUrl: string): Promise<Profile> {
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const folder = `avatars/${user.id}`;
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const bucket = this.client.storage.from(PHOTO_BUCKET);
    const { error } = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw new Error(`Could not upload your photo: ${error.message}`);
    const profile = await this.saveAvatarPath(user, path);
    await this.removeOtherAvatars(folder, path);
    return profile;
  }

  async removeAvatar(user: AuthUser): Promise<Profile> {
    const profile = await this.saveAvatarPath(user, null);
    await this.removeOtherAvatars(`avatars/${user.id}`, '');
    return profile;
  }

  /** The first owner added to a page (its creator) is the owner; later ones are co-owners. */
  async weddingAccess(user: AuthUser, weddingIds: string[]): Promise<Record<string, WeddingAccess>> {
    if (!weddingIds.length) return {};
    const rows = (await this.run(
      this.client.from(T.owners).select('wedding_id,email,added_at').in('wedding_id', weddingIds).order('added_at', { ascending: true }),
    )) as { wedding_id: string; email: string; added_at: string }[];
    const first = new Map<string, string>();
    for (const r of rows) if (!first.has(r.wedding_id)) first.set(r.wedding_id, r.email);
    const me = user.email.toLowerCase();
    return Object.fromEntries(weddingIds.map((id) => [id, !first.has(id) || first.get(id) === me ? 'owner' : 'co-owner']));
  }

  async deleteAccount(_user: AuthUser, opts: { deleteWeddings: boolean }): Promise<DeleteAccountResult> {
    try {
      const r = await invokeFunction<{ weddingsDeleted?: number; weddingsLeft?: number }>(this.client, DELETE_ACCOUNT_FN, { deleteWeddings: opts.deleteWeddings });
      return { weddingsDeleted: r?.weddingsDeleted ?? 0, weddingsLeft: r?.weddingsLeft ?? 0 };
    } catch (e) {
      if (e instanceof PaymentsUnavailable) {
        throw new Error('Account deletion is not switched on yet: the site owner still has to deploy it. Nothing was deleted; please try again later.');
      }
      throw e;
    }
  }

  // ---------- helpers ----------

  private fromRow(r: ProfileRow): Profile {
    return fromProfileRow(r, (path) => this.client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
  }

  private async saveAvatarPath(user: AuthUser, path: string | null): Promise<Profile> {
    const updated = (await this.run(
      this.client.from(T.profiles).update({ avatar_path: path }).eq('id', user.id).select(PROFILE_COLUMNS),
    )) as ProfileRow[];
    if (updated.length) return this.fromRow(updated[0]);
    const row = await this.run(this.client.from(T.profiles).insert({ id: user.id, avatar_path: path }).select(PROFILE_COLUMNS).single());
    return this.fromRow(row as ProfileRow);
  }

  /** Best effort: replaced avatars are deleted so only the current one stays stored. */
  private async removeOtherAvatars(folder: string, keep: string): Promise<void> {
    try {
      const bucket = this.client.storage.from(PHOTO_BUCKET);
      const { data } = await bucket.list(folder);
      const old = (data ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== keep);
      if (old.length) await bucket.remove(old);
    } catch {
      // a leftover file is harmless
    }
  }

  private async run<R>(query: PromiseLike<Result<R>>): Promise<R> {
    let result: Result<R>;
    try {
      result = await query;
    } catch (e) {
      throw friendlyError({ message: (e as Error).message });
    }
    if (result.error) {
      if (isMissingTable(result.error)) throw new ProfilesUnavailable();
      if (result.error.code === '23514') throw new Error('Some details were not accepted. Check the phone number and UPI ID.');
      throw friendlyError(result.error);
    }
    return result.data;
  }
}
