import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { EVENT_KINDS, EVENT_META, EventKind, MAX_EVENTS } from '../../core/models';
import { EventForm, eventForm } from './wedding-form';

const DAY_OFFSET: Record<EventKind, number> = { haldi: -2, mehndi: -2, sangeet: -1, wedding: 0, reception: 1, custom: 0 };
const DEFAULT_TIME: Record<EventKind, string> = { haldi: '10:00', mehndi: '16:00', sangeet: '19:30', wedding: '18:00', reception: '20:00', custom: '18:00' };

function shift(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return d.toISOString().slice(0, 10);
}

/** Add, edit and remove the wedding functions (haldi, mehndi, sangeet…). */
@Component({
  selector: 'app-events-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row quick" role="group" aria-label="Add a function">
      @for (k of kinds; track k) {
        <button type="button" class="btn small" (click)="add(k)" [disabled]="events().length >= max">{{ meta[k].emoji }} {{ meta[k].label }}</button>
      }
    </div>
    @if (!events().length) {
      <p class="hint">Add each function guests are invited to. They appear as a timeline with "Add to calendar", and guests can RSVP to each one.</p>
    }
    <ol class="list">
      @for (e of events().controls; track e.controls.id.value; let i = $index) {
        <li class="item" [formGroup]="e">
          <div class="row top">
            <span class="emoji" aria-hidden="true">{{ meta[e.controls.kind.value].emoji }}</span>
            <label class="grow"><span class="sr-only">Function {{ i + 1 }} name</span>
              <input type="text" formControlName="name" placeholder="Sangeet" /></label>
            <button type="button" class="icon-btn danger" (click)="events().removeAt(i)" [attr.aria-label]="'Remove ' + e.controls.name.value">✕</button>
          </div>
          <div class="grid3">
            <label>Date <input type="date" formControlName="date" /></label>
            <label>Starts <input type="time" formControlName="time" /></label>
            <label>Ends <span class="hint">(optional)</span> <input type="time" formControlName="endTime" /></label>
          </div>
          <div class="grid2">
            <label>Venue <input type="text" formControlName="venue" placeholder="Durbar Hall" /></label>
            <label>Address <span class="hint">(optional)</span> <input type="text" formControlName="address" placeholder="City Palace Complex, Udaipur" /></label>
            <label>Google Maps link <span class="hint">(optional)</span> <input type="url" formControlName="mapsUrl" placeholder="https://maps.app.goo.gl/…" inputmode="url" /></label>
            <label>Dress code <span class="hint">(optional)</span> <input type="text" formControlName="dressCode" placeholder="Yellow for haldi" /></label>
          </div>
          @if (e.touched && e.invalid) {
            <span class="error-text">
              @if (e.controls.date.invalid) { Pick a date. } @if (e.controls.venue.invalid) { Add the venue. }
              @if (e.controls.mapsUrl.invalid) { The map link should start with https://. }
            </span>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: grid; gap: 0.75rem; }
    .quick { gap: 0.4rem; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
    .item { display: grid; gap: 0.6rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); }
    .top { flex-wrap: nowrap; }
    .grow { flex: 1; min-width: 0; }
    .emoji { font-size: 1.4rem; }
    .grid3 { display: grid; gap: 0.6rem; grid-template-columns: 1.4fr 1fr 1fr; }
    .grid2 { display: grid; gap: 0.6rem; grid-template-columns: 1fr 1fr; }
    input[type='time'], input[type='url'] { width: 100%; min-width: 0; font: inherit; font-size: 16px; color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 0.6rem 0.7rem; font-weight: 400; }
    .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); cursor: pointer; color: var(--bad); flex: none; }
    @media (max-width: 600px) { .grid3 { grid-template-columns: 1fr 1fr; } .grid3 label:first-child { grid-column: 1 / -1; } .grid2 { grid-template-columns: 1fr; } }
  `,
})
export class EventsEditorComponent {
  readonly events = input.required<FormArray<EventForm>>();
  /** Wedding day, used to suggest dates (haldi two days before, reception the day after). */
  readonly weddingDate = input('');
  readonly venue = input('');

  protected readonly kinds = EVENT_KINDS;
  protected readonly meta = EVENT_META;
  protected readonly max = MAX_EVENTS;

  protected add(kind: EventKind): void {
    this.events().push(
      eventForm({
        kind,
        name: kind === 'custom' ? '' : EVENT_META[kind].label,
        date: shift(this.weddingDate(), DAY_OFFSET[kind]),
        time: DEFAULT_TIME[kind],
        venue: kind === 'wedding' ? this.venue() : '',
      }),
    );
  }
}
