import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService, AuthUser } from '../auth/auth.service';
import { readJson, writeJson } from '../storage';
import {
  Profile, ProfileInput, greetingName, initialsOf, inviteLanguageOf, noteLanguageOf, profileCompletion,
} from './profile.models';
import { DeleteAccountResult, ProfileRepository, ProfilesUnavailable } from './profile.repository';

/**
 * signed-out · loading · ready (has a profile) · missing (signed in, no profile yet) ·
 * unavailable (the server has no profile table yet, or it could not be read).
 */
export type ProfileStatus = 'signed-out' | 'loading' | 'ready' | 'missing' | 'unavailable';

/** People who chose "Skip for now" on the welcome step, per user id. */
export const ONBOARDING_SKIPPED_KEY = 'sg.onboardingSkipped';

/** Pages that never send someone to the welcome step: sign-in itself, the step, and guests' pages. */
const NO_ONBOARDING = /^\/(login|welcome)(\/|\?|$)|^\/(w\/[^/]+(\/give|\/rsvp|\/card)?|i\/.+)(\?|$)/;

/**
 * Where to send a signed-in person who has no profile yet: the short "Tell us about you" step,
 * then on to the page they were going to. Null when they should stay where they are.
 */
export function onboardingTarget(url: string, status: ProfileStatus, skipped: boolean): string | null {
  // No url yet means the first navigation has not finished.
  if (status !== 'missing' || skipped || !url) return null;
  if (NO_ONBOARDING.test(url)) return null;
  return `/welcome?next=${encodeURIComponent(url)}`;
}

/** The signed-in person's profile, loaded whenever who is signed in changes. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ProfileRepository);

  private readonly state = signal<{ status: ProfileStatus; profile: Profile | null }>({ status: 'signed-out', profile: null });
  private readonly skippedIds = signal<string[]>(readJson<string[]>(ONBOARDING_SKIPPED_KEY, []));
  private loadSeq = 0;

  readonly status = computed(() => this.state().status);
  readonly profile = computed(() => this.state().profile);
  readonly user = this.auth.user;

  readonly skipped = computed(() => {
    const id = this.auth.user()?.id;
    return !!id && this.skippedIds().includes(id);
  });
  /** Signed in but no profile, and the welcome step was not skipped. */
  readonly needsOnboarding = computed(() => this.status() === 'missing' && !this.skipped());
  /** The header's gentle "complete your profile" dot. */
  readonly nudge = computed(() => this.status() === 'missing' || (this.status() === 'ready' && !this.profile()?.fullName));

  readonly name = computed(() => greetingName(this.profile()));
  /** The header label: the greeting name, else the part of the email before @. */
  readonly label = computed(() => this.name() || (this.auth.user()?.email ?? '').split('@')[0]);
  readonly initials = computed(() => initialsOf(this.profile()?.fullName || this.profile()?.displayName || '', this.auth.user()?.email ?? ''));
  readonly avatarUrl = computed(() => this.profile()?.avatarUrl ?? '');
  readonly inviteLanguage = computed(() => inviteLanguageOf(this.profile()?.language));
  readonly noteLanguage = computed(() => noteLanguageOf(this.profile()?.language));
  readonly completion = computed(() => profileCompletion(this.profile()));

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => void this.load(user));
    });
  }

  /** Re-reads the profile (after sign-in, or to retry). */
  async load(user: AuthUser | null = this.auth.user()): Promise<void> {
    const seq = ++this.loadSeq;
    if (!user || !this.auth.accounts) {
      this.state.set({ status: 'signed-out', profile: null });
      return;
    }
    this.state.set({ status: 'loading', profile: null });
    try {
      const profile = await this.repo.get(user);
      if (seq === this.loadSeq) this.state.set({ status: profile ? 'ready' : 'missing', profile });
    } catch (e) {
      if (seq !== this.loadSeq) return;
      if (!(e instanceof ProfilesUnavailable)) console.warn('Could not load the profile', e);
      this.state.set({ status: 'unavailable', profile: null });
    }
  }

  async save(input: ProfileInput): Promise<Profile> {
    const profile = await this.repo.save(this.requireUser(), input);
    this.state.set({ status: 'ready', profile });
    return profile;
  }

  async uploadAvatar(dataUrl: string): Promise<Profile> {
    const profile = await this.repo.uploadAvatar(this.requireUser(), dataUrl);
    this.state.set({ status: 'ready', profile });
    return profile;
  }

  async removeAvatar(): Promise<Profile> {
    const profile = await this.repo.removeAvatar(this.requireUser());
    this.state.set({ status: 'ready', profile });
    return profile;
  }

  /** "Skip for now" on the welcome step: no more redirects, only the header nudge. */
  skip(): void {
    const id = this.auth.user()?.id;
    if (!id || this.skippedIds().includes(id)) return;
    const next = [...this.skippedIds(), id];
    this.skippedIds.set(next);
    writeJson(ONBOARDING_SKIPPED_KEY, next);
  }

  async deleteAccount(opts: { deleteWeddings: boolean }): Promise<DeleteAccountResult> {
    const result = await this.repo.deleteAccount(this.requireUser(), opts);
    this.state.set({ status: 'signed-out', profile: null });
    try {
      await this.auth.signOut();
    } catch {
      // the account is gone; a stale local session is cleared on the next start
    }
    return result;
  }

  private requireUser(): AuthUser {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in first.');
    return user;
  }
}
