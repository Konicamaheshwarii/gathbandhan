import { Injectable, Signal, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DEMO_SLUG } from '../data/seed';

export interface AuthUser {
  id: string;
  email: string;
}

/** Where to go after the magic link brings the couple back. */
export const AUTH_NEXT_KEY = 'sg.authNext';
/** Error from a failed magic link (expired, already used), shown on the login page. */
export const AUTH_ERROR_KEY = 'sg.authError';

/**
 * Couple sign-in. With the Supabase backend this is an email magic link (or the 6-digit code
 * from the same email). In demo mode there are no accounts: `enabled` is false and the browser
 * that made a page manages it.
 */
export abstract class AuthService {
  abstract readonly enabled: boolean;
  abstract readonly user: Signal<AuthUser | null>;
  abstract sendMagicLink(email: string, next: string): Promise<void>;
  abstract verifyCode(email: string, code: string): Promise<void>;
  abstract signOut(): Promise<void>;
}

@Injectable()
export class NoAuthService extends AuthService {
  readonly enabled = false;
  readonly user = signal<AuthUser | null>(null).asReadonly();

  async sendMagicLink(): Promise<void> {
    throw new Error('Sign-in needs the online backend.');
  }

  async verifyCode(): Promise<void> {
    throw new Error('Sign-in needs the online backend.');
  }

  async signOut(): Promise<void> {}
}

export function isEmail(text: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((text ?? '').trim());
}

/** Couple-only pages (create, edit, dashboard) ask for sign-in when the backend is on. */
export const requireSignIn: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  // The bundled sample stays in this browser, so anyone may try its dashboard.
  if (!auth.enabled || auth.user() || route.paramMap.get('slug') === DEMO_SLUG) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};
