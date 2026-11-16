import { Injectable, inject } from '@angular/core';
import { AuthUser } from '../auth/auth.service';
import { WeddingRepository } from '../data/wedding.repository';
import { readJson, writeJson } from '../storage';
import { Profile, ProfileInput, WeddingAccess, emptyProfile } from './profile.models';

/** What "Delete my account" removed. */
export interface DeleteAccountResult {
  weddingsDeleted: number;
  /** Shared pages the person was only removed from (a co-owner keeps them). */
  weddingsLeft: number;
}

/** Thrown when the profile table is not there yet (schema not updated): the app carries on without profiles. */
export class ProfilesUnavailable extends Error {
  constructor(message = 'Profiles are not switched on for this site yet, so this could not be saved. The site owner needs to finish the setup; your wedding pages work as usual.') {
    super(message);
  }
}

/**
 * The signed-in person's own profile. Abstract class as DI token, like WeddingRepository:
 * `LocalProfileRepository` keeps it in this browser (demo mode), `SupabaseProfileRepository`
 * in the shagun_profiles table, where Row Level Security lets each person reach only their row.
 */
export abstract class ProfileRepository {
  abstract readonly mode: 'local' | 'supabase';
  /** The person's profile, or null before they made one. */
  abstract get(user: AuthUser): Promise<Profile | null>;
  /** Creates or updates the profile with these fields. */
  abstract save(user: AuthUser, input: ProfileInput): Promise<Profile>;
  /** Stores a square avatar (a 256px JPEG data URL, already resized on the device) and returns the profile. */
  abstract uploadAvatar(user: AuthUser, dataUrl: string): Promise<Profile>;
  abstract removeAvatar(user: AuthUser): Promise<Profile>;
  /** Owner or co-owner, per wedding id (the first owner of a page is its owner). */
  abstract weddingAccess(user: AuthUser, weddingIds: string[]): Promise<Record<string, WeddingAccess>>;
  /**
   * Deletes the profile, the avatar and the sign-in. With `deleteWeddings`, also every page the
   * person owns alone (shared pages only lose them as an owner). The caller signs out afterwards.
   */
  abstract deleteAccount(user: AuthUser, opts: { deleteWeddings: boolean }): Promise<DeleteAccountResult>;
}

export const PROFILE_KEY_PREFIX = 'sg.profile.';
const key = (userId: string) => `${PROFILE_KEY_PREFIX}${userId}`;

/** Demo mode: one profile per local demo account, in localStorage. The avatar is a small data URL. */
@Injectable()
export class LocalProfileRepository extends ProfileRepository {
  readonly mode = 'local' as const;
  private readonly weddings = inject(WeddingRepository);

  async get(user: AuthUser): Promise<Profile | null> {
    const saved = readJson<Profile | null>(key(user.id), null);
    return saved ? { ...emptyProfile(user.id), ...saved, id: user.id } : null;
  }

  async save(user: AuthUser, input: ProfileInput): Promise<Profile> {
    const now = Date.now();
    const current = (await this.get(user)) ?? { ...emptyProfile(user.id), createdAt: now };
    return this.write({ ...current, ...input, id: user.id, updatedAt: now });
  }

  async uploadAvatar(user: AuthUser, dataUrl: string): Promise<Profile> {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) throw new Error('Please choose a photo.');
    const now = Date.now();
    const current = (await this.get(user)) ?? { ...emptyProfile(user.id), createdAt: now };
    return this.write({ ...current, avatarPath: 'local', avatarUrl: dataUrl, updatedAt: now });
  }

  async removeAvatar(user: AuthUser): Promise<Profile> {
    const current = (await this.get(user)) ?? emptyProfile(user.id);
    return this.write({ ...current, avatarPath: '', avatarUrl: '', updatedAt: Date.now() });
  }

  /** Pages made in this browser belong to whoever uses it. */
  async weddingAccess(_user: AuthUser, weddingIds: string[]): Promise<Record<string, WeddingAccess>> {
    return Object.fromEntries(weddingIds.map((id) => [id, 'owner' as const]));
  }

  async deleteAccount(user: AuthUser, opts: { deleteWeddings: boolean }): Promise<DeleteAccountResult> {
    let weddingsDeleted = 0;
    if (opts.deleteWeddings) {
      for (const w of await this.weddings.listWeddings()) {
        if (w.demo) continue;
        await this.weddings.deleteWedding(w.id);
        weddingsDeleted++;
      }
    }
    try {
      localStorage.removeItem(key(user.id));
    } catch {
      // storage blocked
    }
    return { weddingsDeleted, weddingsLeft: 0 };
  }

  private write(p: Profile): Profile {
    if (!writeJson(key(p.id), p)) throw new Error('This browser could not save your profile (storage is full or blocked).');
    return p;
  }
}
