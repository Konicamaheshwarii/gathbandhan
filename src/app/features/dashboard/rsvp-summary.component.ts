import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { eventName, sortEvents } from '../../core/calendar';
import { downloadText, headcount, rsvpsCsv, sideLabel } from '../../core/csv';
import { EVENT_META, Rsvp, Wedding } from '../../core/models';
import { TimeAgoPipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';

/** Headcount per function and the list of replies, with a CSV for the caterer. */
@Component({
  selector: 'app-rsvp-summary',
  imports: [TimeAgoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card rsvp" aria-labelledby="rsvp-h">
      <div class="row">
        <h2 id="rsvp-h">RSVPs</h2>
        <span class="chip">{{ rsvps().length }} replies · {{ people() }} people</span>
        <span class="spacer"></span>
        <button class="btn small" type="button" (click)="exportCsv()" [disabled]="!rsvps().length">Export CSV</button>
      </div>
      @if (counts().length) {
        <ul class="counts">
          @for (c of counts(); track c.id) {
            <li>
              <span class="emoji" aria-hidden="true">{{ c.emoji }}</span>
              <span class="name">{{ c.name }}</span>
              <strong class="num">{{ c.people }}</strong>
              <span class="hint">people</span>
            </li>
          }
        </ul>
      } @else {
        <p class="muted small">Add your functions (haldi, sangeet…) in Edit to collect RSVPs per function.</p>
      }
      @if (rsvps().length) {
        <details>
          <summary>See every reply</summary>
          <ul class="replies">
            @for (r of rsvps(); track r.id) {
              <li>
                <div class="row between">
                  <strong>{{ r.guestName }}</strong>
                  <span class="small num">{{ r.partySize }} {{ r.partySize === 1 ? 'person' : 'people' }}</span>
                </div>
                <span class="hint">{{ side(r) }}{{ side(r) ? ' · ' : '' }}{{ attending(r) }} · {{ r.createdAt | timeAgo }}</span>
                @if (r.note) { <p class="note-text">“{{ r.note }}”</p> }
              </li>
            }
          </ul>
        </details>
      }
    </section>
  `,
  styles: `
    .rsvp { display: grid; gap: 0.75rem; }
    h2 { margin: 0; }
    .counts { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .counts li { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 0.5rem; padding: 0.6rem 0.75rem; background: var(--surface-2); border-radius: 14px; align-items: center; }
    .emoji { grid-row: span 2; font-size: 1.4rem; }
    .name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .num { font: 600 1.35rem/1.1 var(--font-display); }
    .counts .hint { display: none; }
    summary { cursor: pointer; font-weight: 600; color: var(--accent); min-height: 36px; display: flex; align-items: center; }
    .replies { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; }
    .replies li { border-top: 1px solid var(--border); padding: 0.6rem 0; display: grid; gap: 0.1rem; }
    .between { justify-content: space-between; }
    .note-text { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.9rem; overflow-wrap: anywhere; }
  `,
})
export class RsvpSummaryComponent {
  private readonly toast = inject(ToastService);
  readonly wedding = input.required<Wedding>();
  readonly rsvps = input.required<Rsvp[]>();

  protected readonly people = computed(() => this.rsvps().filter((r) => r.eventIds.length).reduce((t, r) => t + r.partySize, 0));
  protected readonly counts = computed(() =>
    sortEvents(this.wedding().events).map((e) => ({ id: e.id, name: eventName(e), emoji: EVENT_META[e.kind].emoji, people: headcount(this.rsvps(), e.id) })),
  );
  private readonly names = computed(() => new Map((this.wedding().events ?? []).map((e) => [e.id, eventName(e)])));

  protected side(r: Rsvp): string {
    return sideLabel(r.side);
  }

  protected attending(r: Rsvp): string {
    if (!r.eventIds.length) return 'Cannot come';
    if (r.eventIds.length === (this.wedding().events ?? []).length) return 'All functions';
    return r.eventIds.map((id) => this.names().get(id) ?? '?').join(', ');
  }

  protected exportCsv(): void {
    const w = this.wedding();
    downloadText(`rsvps-${w.slug}-${new Date().toISOString().slice(0, 10)}.csv`, rsvpsCsv(w, this.rsvps()));
    this.toast.show('RSVP list downloaded');
  }
}
