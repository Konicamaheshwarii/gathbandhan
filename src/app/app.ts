import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { BACKEND_STATUS } from './core/backend-status';
import { WeddingRepository } from './core/data/wedding.repository';
import { ProfileStore, onboardingTarget } from './core/profile/profile.store';
import { PwaService } from './core/pwa.service';
import { PROVIDERS, SettingsStore } from './core/settings.store';
import { AccountMenuComponent } from './shared/account-menu.component';
import { LogoComponent } from './shared/logo.component';
import { ToastsComponent } from './shared/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastsComponent, LogoComponent, AccountMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.standalone]': 'pwa.standalone()' },
  template: `
    @if (demoMode) {
      <p class="demo-banner" role="note">
        <app-logo [size]="14" /> Demo mode: data stays in this browser.
        @if (backendStatus.configured) { <span class="why">Online mode is switched on, but {{ backendStatus.reason }}. <a routerLink="/settings">Details</a></span> }
      </p>
    }
    @if (!pwa.online()) {
      <p class="offline-banner" role="status">
        <span aria-hidden="true">📴</span> You're offline. Pages you opened before still work; giving shagun, RSVPs, AI and saving changes need the internet.
      </p>
    }
    @if (pwa.updateReady()) {
      <p class="update-banner" role="status">
        A new version of Gathbandhan is ready. <button class="btn small" type="button" (click)="pwa.applyUpdate()">Refresh</button>
      </p>
    }
    <header class="top" [class.guest]="guestView()">
      <a routerLink="/" class="brand" aria-label="Gathbandhan home">
        <app-logo [size]="30" [wordmark]="true" />
      </a>
      @if (guestView()) {
        <span class="spacer"></span>
        <a routerLink="/" class="make-own">Make a page for your wedding</a>
      } @else {
        <nav aria-label="Main">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">My pages</a>
          <a routerLink="/create" routerLinkActive="active">Create</a>
          <a routerLink="/settings" routerLinkActive="active">Settings</a>
        </nav>
        <a routerLink="/settings" class="chip provider" [title]="'AI provider: ' + providerLabel()">AI: {{ providerLabel() }}</a>
        @if (auth.accounts) { <app-account-menu /> }
      }
    </header>

    @if (installHere() && pwa.offerInstall()) {
      <aside class="install" aria-label="Install the app">
        <span class="install-icon" aria-hidden="true"><img src="icons/icon-96.png" alt="" width="40" height="40" /></span>
        <div class="install-text">
          <strong>Install Gathbandhan</strong>
          @if (pwa.showIosHelp()) {
            <span>Tap <b>Share</b> <span aria-hidden="true">⬆️</span> in Safari's toolbar, then <b>Add to Home Screen</b>.</span>
          } @else {
            <span>Open it like an app on your phone, even with a weak network.</span>
          }
        </div>
        @if (!pwa.showIosHelp()) { <button class="btn small primary" type="button" (click)="pwa.install()">Install app</button> }
        <button class="btn small ghost" type="button" (click)="pwa.dismiss()" aria-label="Not now">✕</button>
      </aside>
    }

    <main><router-outlet /></main>
    <footer class="foot">
      <p class="foot-brand"><app-logo [size]="22" [wordmark]="true" /><span class="tagline">Wedding e-invites &amp; digital shagun</span></p>
      <p>Shagun goes straight from the guest's UPI app to the couple. This site never touches the money.</p>
    </footer>

    @if (pwa.standalone() && !guestView()) {
      <nav class="bottom-nav" aria-label="App">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><span aria-hidden="true">🏠</span>Home</a>
        <a routerLink="/create" routerLinkActive="active"><span aria-hidden="true">➕</span>Create</a>
        <a routerLink="/i/riya-weds-arjun" routerLinkActive="active"><span aria-hidden="true">💌</span>Sample</a>
        <a routerLink="/settings" routerLinkActive="active"><span aria-hidden="true">⚙️</span>Settings</a>
      </nav>
    }
    <app-toasts />
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly pwa = inject(PwaService);
  protected readonly demoMode = inject(WeddingRepository).mode === 'local';
  protected readonly backendStatus = inject(BACKEND_STATUS);
  private readonly profile = inject(ProfileStore);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)),
    { initialValue: '' },
  );
  /** Guests arriving from WhatsApp see the wedding, not the couple's tools. */
  protected readonly guestView = computed(() => /^\/(w\/[^/]+(\/give|\/rsvp)?|i\/.+)(\?|$)/.test(this.url()));
  /** Offer the app on the home page and the dashboard only, not on every screen. */
  protected readonly installHere = computed(() => /^\/(\?|$)|\/dashboard(\?|$)/.test(this.url()));

  constructor() {
    // First sign-in with no profile yet: the short "Tell us about you" step, then on to the page.
    effect(() => {
      const target = onboardingTarget(this.url(), this.profile.status(), this.profile.skipped());
      if (target) untracked(() => void this.router.navigateByUrl(target));
    });
  }

  protected readonly providerLabel = computed(
    () => PROVIDERS.find((p) => p.id === this.settings.provider())?.label.split(' (')[0] ?? '');
}
