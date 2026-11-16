import { signal } from '@angular/core';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AUTH_NEXT_KEY, AuthService, AuthUser } from '../../auth/auth.service';
import { appBaseUrl } from '../../wedding-link';
import { friendlyError } from './supabase.repository';

export function toAuthUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  return u?.email ? { id: u.id, email: u.email.toLowerCase() } : null;
}

/** Email magic link (and the 6-digit code from the same email) through Supabase Auth. */
export class SupabaseAuthService extends AuthService {
  readonly enabled = true;
  readonly accounts = true;
  private readonly state = signal<AuthUser | null>(null);
  readonly user = this.state.asReadonly();

  constructor(private readonly client: SupabaseClient, initial: Session | null) {
    super();
    this.state.set(toAuthUser(initial));
    client.auth.onAuthStateChange((_event, session) => this.state.set(toAuthUser(session)));
  }

  async sendMagicLink(email: string, next: string): Promise<void> {
    try {
      localStorage.setItem(AUTH_NEXT_KEY, next || '/');
    } catch {
      // storage blocked: the link still signs in, it just lands on the home page
    }
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: appBaseUrl(), shouldCreateUser: true },
    });
    if (error) {
      throw /rate limit|security purposes/i.test(error.message)
        ? new Error('Too many sign-in emails just now. Wait a minute, then try again.')
        : friendlyError(error);
    }
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (error) throw new Error('That code did not work. It may have expired; ask for a new email.');
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  /** Revokes every session of this person, on every device. */
  override async signOutEverywhere(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'global' });
    if (error) {
      // The local session is gone either way; say so if the other devices could not be reached.
      await this.client.auth.signOut({ scope: 'local' });
      throw friendlyError(error);
    }
  }
}
