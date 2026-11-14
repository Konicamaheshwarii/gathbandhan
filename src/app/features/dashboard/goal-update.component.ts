import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Goal, GoalUpdate, MAX_GOAL_UPDATES } from '../../core/models';
import { uid } from '../../core/util';
import { resizeImage } from '../../shared/image';
import { ToastService } from '../../shared/toast.service';

export const UPDATE_MAX = 160;

/** Adds a goal update to a goal (newest first, a few kept). Pure, so it is easy to test. */
export function withUpdate(goal: Goal, update: GoalUpdate): Goal {
  return { ...goal, updates: [update, ...(goal.updates ?? [])].slice(0, MAX_GOAL_UPDATES) };
}

export function withoutUpdate(goal: Goal, updateId: string): Goal {
  return { ...goal, updates: (goal.updates ?? []).filter((u) => u.id !== updateId) };
}

/** "Honeymoon booked!": a short note (and optional photo) guests see on the goal card. */
@Component({
  selector: 'app-goal-update',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (goal().updates?.length) {
      <ul class="updates">
        @for (u of goal().updates; track u.id) {
          <li>
            @if (u.imageUrl) { <img [src]="u.imageUrl" alt="" /> }
            <span class="small">{{ u.text }}</span>
            <button type="button" class="link" (click)="removed.emit(u.id)" [attr.aria-label]="'Delete update: ' + u.text">Delete</button>
          </li>
        }
      </ul>
    }
    @if (open()) {
      <form class="composer" (submit)="$event.preventDefault(); post()">
        <textarea rows="2" [attr.maxlength]="max" [value]="text()" (input)="text.set($any($event.target).value)"
                  [attr.aria-label]="'Update for ' + goal().title" placeholder="Honeymoon booked! Thank you all ✈️"></textarea>
        <div class="row">
          <label class="btn small photo">
            <input type="file" accept="image/*" class="sr-only" (change)="pick($event)" />
            {{ image() ? 'Photo added ✓' : '+ Photo' }}
          </label>
          <span class="hint">{{ text().length }}/{{ max }}</span>
          <span class="spacer"></span>
          <button type="button" class="btn small ghost" (click)="open.set(false)">Cancel</button>
          <button type="submit" class="btn small primary" [disabled]="!text().trim() || busy()">Post update</button>
        </div>
      </form>
    } @else {
      <button type="button" class="link add" (click)="open.set(true)">+ Post an update guests will see</button>
    }
  `,
  styles: `
    :host { display: grid; gap: 0.35rem; }
    .updates { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
    .updates li { display: flex; gap: 0.5rem; align-items: center; background: var(--good-soft); border-radius: 10px; padding: 0.35rem 0.55rem; }
    .updates img { width: 2rem; height: 2rem; border-radius: 6px; object-fit: cover; }
    .updates span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .link { border: 0; background: none; color: var(--accent); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0.3rem 0; text-align: left; min-height: 32px; }
    .composer { display: grid; gap: 0.4rem; }
    textarea { min-height: 3.2rem; }
    .photo { cursor: pointer; }
  `,
})
export class GoalUpdateComponent {
  private readonly toast = inject(ToastService);
  readonly goal = input.required<Goal>();
  readonly posted = output<GoalUpdate>();
  readonly removed = output<string>();

  protected readonly max = UPDATE_MAX;
  protected readonly open = signal(false);
  protected readonly text = signal('');
  protected readonly image = signal('');
  protected readonly busy = signal(false);

  protected async pick(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.image.set(await resizeImage(file, 600, 0.72));
    } catch (e) {
      this.toast.show((e as Error).message);
    }
  }

  protected post(): void {
    const text = this.text().trim().slice(0, UPDATE_MAX);
    if (!text) return;
    this.posted.emit({ id: uid('u'), text, createdAt: Date.now(), ...(this.image() ? { imageUrl: this.image() } : {}) });
    this.text.set('');
    this.image.set('');
    this.open.set(false);
  }
}
