import { Injectable, Signal, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DEMO_SLUG } from '../data/seed';
import { readJson, writeJson } from '../storage';
import { hashString } from '../util';

export interface AuthUser {
  id: string;
  email: string;
}

/** Where to go after the magic link brings the couple back. */
export const AUTH_NEXT_KEY = 'sg.authNext';
/** Error from a failed magic link (expired, already used), shown on the login page. */
export const AUTH_ERROR_KEY = 'sg.authError';

/** The local demo account (demo mode only). */
export const DEMO_USER_KEY = 'sg.demoUser';

/**
 * Couple sign-in. With the Supabase backend this is an email magic link (or the 6-digit code
 * from the same email). In demo mode `enabled` is false (no page asks for sign-in and the browser
 * that made a page manages it), but a local demo account lets people try the account pages.
 */
export abstract class AuthService {
  /** Couple pages ask for sign-in (the online backend). */
  abstract readonly enabled: boolean;
  /** Accounts and profiles exist: the backend, or the local demo account in demo mode. */
  abstract readonly accounts: boolean;
  /** Signing in is simulated in this browser: no email is ever sent. */
  readonly simulated: boolean = false;
  abstract readonly user: Signal<AuthUser | null>;
  abstract sendMagicLink(email: string, next: string): Promise<void>;
  abstract verifyCode(email: string, code: string): Promise<void>;
  abstract signOut(): Promise<void>;
  /** Signs out on every device (the backend revokes every session). */
  signOutEverywhere(): Promise<void> {
    return this.signOut();
  }
}

/** No accounts at all. */
@Injectable()
export class NoAuthService extends AuthService {
  readonly enabled = false;
  readonly accounts = false;
  readonly user = signal<AuthUser | null>(null).asReadonly();

  async sendMagicLink(): Promise<void> {
    throw new Error('Sign-in needs the online backend.');
  }

  async verifyCode(): Promise<void> {
    throw new Error('Sign-in needs the online backend.');
  }

  async signOut(): Promise<void> {}
}

/** A stable id per email, so a demo account keeps its profile across sign-ins in this browser. */
export function demoUserId(email: string): string {
  const e = email.trim().toLowerCase();
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const a = hex(hashString(e));
  const b = hex(hashString(`${e}#2`));
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-8${a.slice(1, 4)}-${b}${a.slice(4, 8)}`;
}

/**
 * Demo mode: "signing in" makes a local account in this browser, so the account and profile
 * pages can be tried without the backend. Nothing is emailed and couple pages stay open to all.
 */
@Injectable()
export class DemoAuthService extends AuthService {
  readonly enabled = false;
  readonly accounts = true;
  override readonly simulated = true;
  private readonly state = signal<AuthUser | null>(readJson<AuthUser | null>(DEMO_USER_KEY, null));
  readonly user = this.state.asReadonly();

  async sendMagicLink(email: string, _next?: string): Promise<void> {
    if (!isEmail(email)) throw new Error('Enter a valid email address.');
    const e = email.trim().toLowerCase();
    const user = { id: demoUserId(e), email: e };
    writeJson(DEMO_USER_KEY, user);
    this.state.set(user);
  }

  async verifyCode(email: string): Promise<void> {
    await this.sendMagicLink(email);
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(DEMO_USER_KEY);
    } catch {
      // storage blocked
    }
    this.state.set(null);
  }
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

/** The account pages need a signed-in person (in demo mode, the local demo account). */
export const requireAccount: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (!auth.accounts) return inject(Router).createUrlTree(['/']);
  if (auth.user()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};
