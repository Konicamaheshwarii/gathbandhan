import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { WeddingRepository } from './core/data/wedding.repository';
import { PROVIDERS, SettingsStore } from './core/settings.store';
import { ToastsComponent } from './shared/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demoMode) {
      <p class="demo-banner" role="note"><span aria-hidden="true">🪔</span> Demo mode: data stays in this browser.</p>
    }
    <header class="top" [class.guest]="guestView()">
      <a routerLink="/" class="brand" aria-label="Shagun home">
        <svg class="logo" viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
          <path d="M32 8c6 8 8 14 0 22c-8-8-6-14 0-22z" fill="#f6b13a" />
          <path d="M32 15c3 4 3.5 8 0 12c-3.5-4-3-8 0-12z" fill="#e8501a" />
          <path d="M8 33h48c-2 11-12 19-24 19S10 44 8 33z" fill="currentColor" />
        </svg>
        <span>Shagun</span>
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
        @if (auth.enabled) {
          <a routerLink="/login" class="chip account" [title]="auth.user()?.email ?? 'Sign in'">{{ auth.user() ? 'Account' : 'Sign in' }}</a>
        }
      }
    </header>
    <main><router-outlet /></main>
    <footer class="foot">
      <p>Shagun goes straight from the guest's UPI app to the couple. This site never touches the money.</p>
    </footer>
    <app-toasts />
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly demoMode = inject(WeddingRepository).mode === 'local';

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)),
    { initialValue: '' },
  );
  /** Guests arriving from WhatsApp see the wedding, not the couple's tools. */
  protected readonly guestView = computed(() => /^\/w\/[^/]+(\/give|\/rsvp)?(\?|$)/.test(this.url()));
  protected readonly providerLabel = computed(
    () => PROVIDERS.find((p) => p.id === this.settings.provider())?.label.split(' (')[0] ?? '');
}
