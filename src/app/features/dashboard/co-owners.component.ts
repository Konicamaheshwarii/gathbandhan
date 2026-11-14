import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { AuthService, isEmail } from '../../core/auth/auth.service';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { ToastService } from '../../shared/toast.service';

/** Backend only: the partner signs in with their own email and manages the same page. */
@Component({
  selector: 'app-co-owners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card owners" aria-labelledby="owners-h">
      <h2 id="owners-h">Who can manage this page</h2>
      <ul>
        @for (email of owners(); track email) {
          <li class="row">
            <span class="email">{{ email }}</span>
            @if (email === auth.user()?.email) { <span class="chip">You</span> }
            <span class="spacer"></span>
            @if (owners().length > 1 && email !== auth.user()?.email) {
              <button class="btn small ghost danger" type="button" (click)="remove(email)">Remove</button>
            }
          </li>
        }
      </ul>
      <form class="row add" (submit)="$event.preventDefault(); add()">
        <label class="grow">
          <span class="sr-only">Partner's email</span>
          <input type="email" inputmode="email" autocomplete="off" placeholder="Partner's email" [value]="email()" (input)="email.set($any($event.target).value)" />
        </label>
        <button class="btn small" type="submit" [disabled]="busy()">Add co-owner</button>
      </form>
      <p class="hint">They sign in at the same site with that email; no invite email is sent, so tell them on WhatsApp.</p>
    </section>
  `,
  styles: `
    .owners { display: grid; gap: 0.6rem; }
    h2 { margin: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
    .email { overflow-wrap: anywhere; font-weight: 500; }
    .grow { flex: 1; min-width: 12rem; }
    .add { align-items: center; }
  `,
})
export class CoOwnersComponent {
  protected readonly auth = inject(AuthService);
  private readonly repo = inject(WeddingRepository);
  private readonly toast = inject(ToastService);

  readonly weddingId = input.required<string>();
  protected readonly owners = signal<string[]>([]);
  protected readonly email = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      const id = this.weddingId();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.owners.set(await this.repo.listOwners(id));
    } catch (e) {
      this.toast.show((e as Error).message);
    }
  }

  protected async add(): Promise<void> {
    const email = this.email().trim().toLowerCase();
    if (!isEmail(email)) {
      this.toast.show('Enter a valid email address.');
      return;
    }
    await this.run(async () => {
      await this.repo.addOwner(this.weddingId(), email);
      this.email.set('');
      this.toast.show(`${email} can now manage this page`);
    });
  }

  protected async remove(email: string): Promise<void> {
    if (!confirm(`Remove ${email}? They will no longer see the dashboard.`)) return;
    await this.run(() => this.repo.removeOwner(this.weddingId(), email));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
      await this.load(this.weddingId());
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
