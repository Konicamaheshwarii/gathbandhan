import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AUTH_ERROR_KEY, AuthService, isEmail } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/toast.service';

/** Couple sign-in by email: a magic link, or the 6-digit code from the same email. */
@Component({
  selector: 'app-login',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      @if (!auth.enabled) {
        <section class="card stack">
          <h1>No sign-in needed</h1>
          <p class="muted">This copy of Gathbandhan runs in demo mode: your pages stay in this browser, so there is nothing to sign in to.
            Once the owner connects the free Supabase backend, couples sign in here with just their email.</p>
          <a class="btn primary" routerLink="/">Go home</a>
        </section>
      } @else if (auth.user(); as u) {
        <section class="card stack">
          <p class="eyebrow">Signed in</p>
          <h1>Namaste!</h1>
          <p>You are signed in as <strong>{{ u.email }}</strong>. Only you (and co-owners you add) can edit your page,
            see the dashboard and guests' phone numbers.</p>
          <div class="row">
            <a class="btn primary" [routerLink]="next() || '/'">Continue</a>
            <button class="btn ghost" type="button" (click)="signOut()">Sign out</button>
          </div>
        </section>
      } @else {
        <section class="card stack">
          <p class="eyebrow">For the couple</p>
          <h1>Sign in with your email</h1>
          <p class="muted">No password. We email you a sign-in link; tap it on this phone or computer. Guests never need to sign in.</p>
          @if (linkError()) { <p class="alert small" role="alert">{{ linkError() }}. Ask for a new link below.</p> }
          <form class="stack" (submit)="$event.preventDefault(); send()" novalidate>
            <label>
              Email
              <input type="email" autocomplete="email" inputmode="email" [value]="email()" (input)="email.set($any($event.target).value)"
                     placeholder="riya@example.com" [disabled]="busy()" />
            </label>
            <button class="btn primary block" type="submit" [disabled]="busy()">
              @if (busy()) { <span class="spinner" aria-hidden="true"></span> } {{ sent() ? 'Send again' : 'Email me a sign-in link' }}
            </button>
          </form>
          @if (sent()) {
            <div class="note stack sent" role="status">
              <p><strong>Check your inbox</strong> (and spam) for an email from Supabase, and tap the link. It works for one hour.</p>
              <form class="row code" (submit)="$event.preventDefault(); verify()">
                <label class="grow">
                  <span class="small">Or type the 6-digit code from the email</span>
                  <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [value]="code()" (input)="code.set($any($event.target).value)" />
                </label>
                <button class="btn" type="submit" [disabled]="busy() || code().trim().length < 6">Verify</button>
              </form>
            </div>
          }
          @if (error()) { <p class="alert small" role="alert">{{ error() }}</p> }
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: block; padding-top: 1rem; }
    .wrap { max-width: 30rem; margin: 0 auto; }
    h1, p { margin: 0; }
    input[type='email'] { width: 100%; font: inherit; font-size: 16px; color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 0.65rem 0.8rem; }
    .sent { gap: 0.6rem; }
    .code { align-items: flex-end; }
    .grow { flex: 1; }
  `,
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

  protected async send(): Promise<void> {
    if (!isEmail(this.email())) {
      this.error.set('Enter a valid email address.');
      return;
    }
    await this.attempt(async () => {
      await this.auth.sendMagicLink(this.email(), this.next() || '/');
      this.sent.set(true);
    });
  }

  protected async verify(): Promise<void> {
    await this.attempt(async () => {
      await this.auth.verifyCode(this.email(), this.code());
      this.toast.show('Signed in');
      await this.router.navigateByUrl(this.next() || '/');
    });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.toast.show('Signed out');
  }

  private async attempt(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
    } catch (e) {
      this.error.set((e as Error).message);
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
