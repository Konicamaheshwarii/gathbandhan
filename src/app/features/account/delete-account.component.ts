import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MyWedding } from '../../core/profile/profile.models';

/** The word to type before the account can be deleted. */
export const CONFIRM_WORD = 'DELETE';

/**
 * "Delete my account" with a clear, two-step confirmation: open the panel, choose what happens
 * to the wedding pages, type DELETE, then confirm.
 */
@Component({
  selector: 'app-delete-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button type="button" class="btn danger-outline" data-test="delete-open" (click)="open.set(true)">Delete my account…</button>
    } @else {
      <div class="confirm" role="group" aria-labelledby="del-title">
        <h3 id="del-title"><span aria-hidden="true">⚠️</span> Delete your account?</h3>
        <p>This removes your profile, your photo and your sign-in{{ backend() ? '' : ' in this browser' }}. It cannot be undone.</p>

        @if (owned().length) {
          <label class="check">
            <input type="checkbox" data-test="delete-weddings" [checked]="deleteWeddings()" (change)="deleteWeddings.set($any($event.target).checked)" />
            <span>Also delete the {{ owned().length === 1 ? 'wedding page' : owned().length + ' wedding pages' }} I own, with {{ owned().length === 1 ? 'its' : 'their' }} guests, RSVPs and blessings
              <span class="names">({{ ownedNames() }})</span></span>
          </label>
          @if (!deleteWeddings()) {
            <p class="hint">Your pages stay online for guests{{ backend() ? ', and signing in again with this email lets you manage them' : '' }}.</p>
          }
        }
        @if (backend() && shared().length) {
          <p class="hint">Pages you co-own ({{ shared().length }}) stay with the other owners.</p>
        }

        <label class="field">
          <span>Type <strong>{{ word }}</strong> to confirm</span>
          <input type="text" data-test="delete-word" autocomplete="off" autocapitalize="characters" spellcheck="false"
                 [value]="typed()" (input)="typed.set($any($event.target).value)" />
        </label>

        @if (error()) { <p class="alert small" role="alert">{{ error() }}</p> }

        <div class="row">
          <button type="button" class="btn danger-solid" data-test="delete-confirm" [disabled]="!ready() || busy()" (click)="confirm()">
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> Deleting… } @else { Delete my account forever }
          </button>
          <button type="button" class="btn ghost" (click)="cancel()" [disabled]="busy()">Keep my account</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    h3, p { margin: 0; }
    .confirm {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      border-radius: 16px;
      border: 1.5px solid color-mix(in srgb, var(--bad) 45%, transparent);
      background: color-mix(in srgb, var(--bad) 6%, var(--surface));
      animation: rise 0.3s ease both;
    }
    h3 { color: var(--bad); font-size: 1.1rem; }
    .check { display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 500; line-height: 1.4; cursor: pointer; }
    .check input { width: 20px; height: 20px; margin-top: 0.1rem; accent-color: var(--bad); flex: none; }
    .names { color: var(--muted); }
    .field { display: grid; gap: 0.35rem; font-weight: 500; }
    .field input { max-width: 260px; letter-spacing: 0.08em; }
    .btn.danger-outline { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); background: transparent; }
    .btn.danger-outline:hover:not(:disabled) { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 8%, transparent); }
    .btn.danger-solid { background: var(--bad); border-color: var(--bad); color: #fff; }
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  `,
})
export class DeleteAccountComponent {
  readonly weddings = input<MyWedding[]>([]);
  readonly backend = input(false);
  readonly busy = input(false);
  readonly error = input('');
  readonly confirmed = output<{ deleteWeddings: boolean }>();

  protected readonly word = CONFIRM_WORD;
  protected readonly open = signal(false);
  protected readonly deleteWeddings = signal(false);
  protected readonly typed = signal('');
  protected readonly owned = computed(() => this.weddings().filter((m) => m.access === 'owner'));
  protected readonly shared = computed(() => this.weddings().filter((m) => m.access === 'co-owner'));
  protected readonly ownedNames = computed(() => this.owned().map((m) => `${m.wedding.partner1.split(' ')[0]} & ${m.wedding.partner2.split(' ')[0]}`).join(', '));
  protected readonly ready = computed(() => this.typed().trim().toUpperCase() === CONFIRM_WORD);

  protected confirm(): void {
    if (!this.ready()) return;
    this.confirmed.emit({ deleteWeddings: this.owned().length > 0 && this.deleteWeddings() });
  }

  protected cancel(): void {
    this.open.set(false);
    this.typed.set('');
    this.deleteWeddings.set(false);
  }
}
