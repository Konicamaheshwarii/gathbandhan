import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AUTH_ERROR_KEY, AuthService, isEmail } from '../../core/auth/auth.service';
import { demoWedding } from '../../core/data/seed';
import { InvitePage, defaultInvite } from '../../core/invite';
import { InviteDesign, InviteLanguage, InviteTemplate } from '../../core/models';
import { LogoComponent } from '../../shared/logo.component';
import { ToastService } from '../../shared/toast.service';
import { ToranComponent } from '../../shared/toran.component';
import { InvitePageComponent } from '../invite/invite-page.component';

/** Seconds before "Send again" works. Supabase's free email allows only a few sign-in emails an hour. */
export const RESEND_SECONDS = 60;

/** The sample invite on the art panel cycles through a few styles, one per language. */
const PREVIEWS: [InviteTemplate, InviteLanguage][] = [
  ['royal', 'english'],
  ['ganesh', 'hindi'],
  ['gujarati', 'gujarati'],
  ['phulkari', 'hinglish'],
];

/** "Sign in to …": what the couple is signing in for, read from the `next` param. */
export function purposeFor(next: string | undefined | null): string {
  const path = (next ?? '').split(/[?#]/)[0];
  if (path === '/create') return 'create your wedding page';
  if (/^\/w\/[^/]+\/dashboard$/.test(path)) return 'open your dashboard';
  if (/^\/w\/[^/]+\/invite$/.test(path)) return 'design your invite';
  if (/^\/w\/[^/]+\/guests$/.test(path)) return 'manage your guest list';
  if (/^\/w\/[^/]+\/edit$/.test(path)) return 'edit your wedding page';
  if (/^\/w\/[^/]+\/payments$/.test(path)) return 'set up how guests pay';
  return 'manage your wedding pages';
}

/** Only paths inside the app, and never back to the login page itself. */
export function safeNext(next: string | undefined | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '';
}

/** 75 → "1:15". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function isRateLimit(message: string): boolean {
  return /too many|rate limit|security purposes/i.test(message);
}

/** Couple sign-in by email: a magic link, or the 6-digit code from the same email. */
@Component({
  selector: 'app-login',
  imports: [RouterLink, LogoComponent, ToranComponent, InvitePageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly next = input<string>();

  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly linkError = signal(readLinkError());
  /** The address the last link went to. */
  protected readonly sentTo = signal('');
  /** Seconds left before the link can be sent again. */
  protected readonly cooldown = signal(0);
  protected readonly showCode = signal(false);
  protected readonly rateLimited = signal(false);

  protected readonly purpose = computed(() => purposeFor(this.next()));
  protected readonly clock = clock;

  // ----- the sample invite on the art panel -----
  protected readonly sample = demoWedding();
  protected readonly cover: InvitePage = { kind: 'cover' };
  private readonly designs: InviteDesign[] = PREVIEWS.map(([t, l]) => defaultInvite(this.sample, t, l, 'traditional'));
  private readonly previewIndex = signal(0);
  /** A one-item list, so the invite is re-created (and animates in) when the style changes. */
  protected readonly preview = computed(() => [this.designs[this.previewIndex()]]);

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      const cycle = setInterval(() => this.previewIndex.update((i) => (i + 1) % this.designs.length), 3600);
      destroyRef.onDestroy(() => clearInterval(cycle));
    }
    destroyRef.onDestroy(() => this.stopTimer());

    // Already signed in (or the link was opened in another tab): carry on to where they were
    // going, or to the account page.
    effect(() => {
      const next = safeNext(this.next()) || '/account';
      if (this.auth.user()) untracked(() => void this.router.navigateByUrl(next));
    });
  }

  protected async send(): Promise<void> {
    if (!isEmail(this.email())) {
      this.error.set('Enter a valid email address.');
      return;
    }
    await this.attempt(async () => {
      await this.auth.sendMagicLink(this.email(), safeNext(this.next()) || '/account');
      // Demo mode signs in at once (no email); the effect above moves on.
      if (this.auth.simulated) return;
      this.sentTo.set(this.email().trim());
      this.sent.set(true);
      this.startCooldown();
    });
  }

  protected async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.busy()) return;
    await this.send();
    if (!this.error()) this.toast.show('Sent a new link');
  }

  protected async verify(): Promise<void> {
    await this.attempt(async () => {
      await this.auth.verifyCode(this.email(), this.code());
      this.toast.show('Signed in');
      await this.router.navigateByUrl(safeNext(this.next()) || '/account');
    });
  }

  /** Back to the email form, keeping the address so a typo is easy to fix. */
  protected differentEmail(): void {
    this.sent.set(false);
    this.code.set('');
    this.error.set('');
    this.rateLimited.set(false);
    this.showCode.set(false);
    this.stopTimer();
    this.cooldown.set(0);
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((s) => Math.max(0, s - 1));
      if (this.cooldown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async attempt(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.rateLimited.set(false);
    try {
      await fn();
    } catch (e) {
      const message = (e as Error).message;
      if (isRateLimit(message)) {
        this.rateLimited.set(true);
        this.error.set(
          this.sent()
            ? 'Our free email service sends only a couple of sign-in emails an hour, so please wait a little before asking again. The link and code in the email we already sent still work.'
            : 'Our free email service sends only a couple of sign-in emails an hour. Please wait a few minutes and try again, or use the code from an earlier email.',
        );
      } else {
        this.error.set(message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}

function readLinkError(): string {
  try {
    const message = sessionStorage.getItem(AUTH_ERROR_KEY) ?? '';
    sessionStorage.removeItem(AUTH_ERROR_KEY);
    return message;
  } catch {
    return '';
  }
}
