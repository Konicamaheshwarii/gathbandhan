import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ProfileStore } from '../core/profile/profile.store';
import { AvatarComponent } from './avatar.component';
import { ToastService } from './toast.service';

/** Header: "Sign in", or the person's avatar and first name with a small account menu. */
@Component({
  selector: 'app-account-menu',
  imports: [RouterLink, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'outside($event)', '(document:keydown.escape)': 'close(true)' },
  template: `
    @if (auth.user(); as u) {
      <button type="button" class="trigger" #trigger [attr.aria-expanded]="open()" aria-haspopup="menu" aria-controls="account-menu"
              [attr.aria-label]="'Account menu for ' + store.label() + (store.nudge() ? '. Your profile is incomplete' : '')" (click)="toggle()">
        <span class="av-wrap">
          <app-avatar [url]="store.avatarUrl()" [initials]="store.initials()" [size]="30" />
          @if (store.nudge()) { <span class="nudge-dot" aria-hidden="true"></span> }
        </span>
        <span class="name">{{ store.label() }}</span>
        <svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      @if (open()) {
        <div class="menu" id="account-menu" role="menu" aria-label="Account" (keydown)="keys($event)">
          <div class="who">
            <app-avatar [url]="store.avatarUrl()" [initials]="store.initials()" [size]="40" />
            <span><strong>{{ store.profile()?.fullName || store.label() }}</strong><span class="email">{{ u.email }}</span></span>
          </div>
          @if (store.nudge()) {
            <a role="menuitem" class="item nudge" routerLink="/account" (click)="close()">
              <span class="ico" aria-hidden="true">✨</span><span>Complete your profile<small>Add your name so we can greet you</small></span>
            </a>
          }
          <a role="menuitem" class="item" routerLink="/account" (click)="close()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></svg>My account
          </a>
          <a role="menuitem" class="item" routerLink="/account" fragment="weddings" (click)="close()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>My wedding pages
          </a>
          <button type="button" role="menuitem" class="item" (click)="signOut()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>Sign out
          </button>
        </div>
      }
    } @else {
      <a routerLink="/login" class="chip sign-in">Sign in</a>
    }
  `,
  styleUrl: './account-menu.component.scss',
})
export class AccountMenuComponent {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(ProfileStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((o) => !o);
    if (this.open()) queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('[role=menuitem]')?.focus());
  }

  close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
  }

  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  /** Arrow keys move between items. */
  protected keys(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const items = [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  protected async signOut(): Promise<void> {
    this.open.set(false);
    await this.auth.signOut();
    this.toast.show('Signed out');
    await this.router.navigateByUrl('/');
  }
}
