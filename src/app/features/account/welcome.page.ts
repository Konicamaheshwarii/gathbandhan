import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { PROFILE_LANGUAGES, ProfileErrors, ProfileLanguage, WEDDING_ROLES, WeddingRole, cleanProfileInput } from '../../core/profile/profile.models';
import { ProfileStore } from '../../core/profile/profile.store';
import { LogoComponent } from '../../shared/logo.component';
import { ToastService } from '../../shared/toast.service';
import { ToranComponent } from '../../shared/toran.component';
import { safeNext } from '../login/login.page';

/** First sign-in: "Tell us about you" (name, role, phone, language), then on to `next`. Skippable. */
@Component({
  selector: 'app-welcome',
  imports: [LogoComponent, ToranComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="welcome">
      <div class="card welcome-card">
        <div class="band festive" aria-hidden="true">
          <app-toran class="toran" />
          <span class="badge"><app-logo [size]="40" /></span>
        </div>

        <form class="stack body" (submit)="$event.preventDefault(); save()" novalidate>
          <header class="head">
            <p class="eyebrow">Welcome to Gathbandhan</p>
            <h1>Namaste! Tell us about you</h1>
            <p class="sub">Four quick details, so we can greet you by name and set things up your way. You can change them any time in your account.</p>
          </header>

          <label class="field">
            <span>Your name <span class="req" aria-hidden="true">*</span></span>
            <input type="text" name="fullName" autocomplete="name" maxlength="80" placeholder="Riya Sharma" required
                   [value]="fullName()" (input)="fullName.set($any($event.target).value); clearError('fullName')"
                   [attr.aria-invalid]="!!errors().fullName || null" aria-describedby="w-name-err" />
            @if (errors().fullName) { <span class="error-text" id="w-name-err">{{ errors().fullName }}</span> }
          </label>

          <fieldset class="field">
            <legend>I am the…</legend>
            <div class="choices roles" role="radiogroup" aria-label="Your role in the wedding">
              @for (r of roles; track r.id) {
                <button type="button" role="radio" class="choice" [attr.aria-checked]="role() === r.id" (click)="role.set(role() === r.id ? null : r.id)">
                  <span class="emoji" aria-hidden="true">{{ r.emoji }}</span>{{ r.label }}
                </button>
              }
            </div>
          </fieldset>

          <label class="field">
            <span>Mobile number <span class="opt">optional</span></span>
            <input type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="98765 43210"
                   [value]="phone()" (input)="phone.set($any($event.target).value); clearError('phone')"
                   [attr.aria-invalid]="!!errors().phone || null" aria-describedby="w-phone-hint" />
            @if (errors().phone) { <span class="error-text" id="w-phone-hint">{{ errors().phone }}</span> }
            @else { <span class="hint" id="w-phone-hint">Only you see it. Indian mobiles need no +91.</span> }
          </label>

          <fieldset class="field">
            <legend>Language for invites and AI text</legend>
            <div class="choices" role="radiogroup" aria-label="Preferred language">
              @for (l of languages; track l.id) {
                <button type="button" role="radio" class="choice" [attr.aria-checked]="language() === l.id" (click)="language.set(l.id)">{{ l.label }}</button>
              }
            </div>
          </fieldset>

          @if (error()) { <p class="alert small" role="alert">{{ error() }}</p> }

          <div class="actions">
            <button class="btn primary big" type="submit" [disabled]="busy()">
              @if (busy()) { <span class="spinner" aria-hidden="true"></span> Saving… } @else { Save and continue }
            </button>
            <button class="btn ghost" type="button" (click)="skip()" [disabled]="busy()">Skip for now</button>
          </div>
        </form>
      </div>
    </section>
  `,
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {
  private readonly store = inject(ProfileStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly next = input<string>();

  protected readonly roles = WEDDING_ROLES;
  protected readonly languages = PROFILE_LANGUAGES;
  protected readonly fullName = signal('');
  protected readonly role = signal<WeddingRole | null>(null);
  protected readonly phone = signal('');
  protected readonly language = signal<ProfileLanguage>('en');
  protected readonly errors = signal<ProfileErrors>({});
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  private leaving = false;

  constructor() {
    // Someone who already has a profile has nothing to do here.
    effect(() => {
      if (this.store.status() === 'ready' && !this.busy()) untracked(() => void this.continue());
    });
  }

  protected async save(): Promise<void> {
    const { value, errors } = cleanProfileInput(
      { fullName: this.fullName(), role: this.role(), phone: this.phone(), language: this.language() },
      { requireName: true },
    );
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.save(value);
      this.toast.show(`Lovely to meet you, ${this.store.name()}!`);
      await this.continue();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected clearError(field: keyof ProfileErrors): void {
    if (this.errors()[field]) this.errors.update(({ [field]: _gone, ...rest }) => rest);
  }

  protected async skip(): Promise<void> {
    this.store.skip();
    await this.continue();
  }

  private async continue(): Promise<void> {
    if (this.leaving) return;
    this.leaving = true;
    await this.router.navigateByUrl(safeNext(this.next()) || '/account');
  }
}
