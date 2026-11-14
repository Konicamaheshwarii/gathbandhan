import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { eventName, formatTime, googleCalendarUrl, mapsUrl, sortEvents, weddingIcs } from '../../core/calendar';
import { downloadText } from '../../core/csv';
import { EVENT_META, Wedding, WeddingEvent } from '../../core/models';
import { IndianDatePipe } from '../../shared/pipes';

/** The wedding functions as a timeline, each with a map link and "Add to calendar". */
@Component({
  selector: 'app-events-timeline',
  imports: [RouterLink, IndianDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card events" aria-labelledby="events-title">
      <div class="row head">
        <h2 id="events-title">Wedding functions</h2>
        <span class="spacer"></span>
        <button class="btn small" type="button" (click)="downloadAll()">📅 Add all to calendar</button>
      </div>
      <ol class="timeline">
        @for (e of events(); track e.id) {
          <li class="event" [class]="'event kind-' + e.kind">
            <span class="dot" aria-hidden="true">{{ meta[e.kind].emoji }}</span>
            <div class="body">
              <p class="when small">{{ e.date | indianDate: 'long' }} · {{ time(e.time) }}@if (e.endTime) { – {{ time(e.endTime) }} }</p>
              <h3>{{ name(e) }}</h3>
              <p class="venue">{{ e.venue }}@if (e.address) { <span class="muted">, {{ e.address }}</span> }</p>
              @if (e.dressCode) { <p class="dress small"><span aria-hidden="true">👗</span> <strong>Dress code:</strong> {{ e.dressCode }}</p> }
              <div class="row actions">
                @if (map(e)) { <a class="btn small" [href]="map(e)" target="_blank" rel="noopener">📍 Map</a> }
                <a class="btn small" [href]="google(e)" target="_blank" rel="noopener">Google Calendar</a>
                <button class="btn small ghost" type="button" (click)="download(e)">.ics</button>
              </div>
            </div>
          </li>
        }
      </ol>
      <a class="btn primary block" [routerLink]="['/w', wedding().slug, 'rsvp']">RSVP: tell us you're coming</a>
    </section>
  `,
  styles: `
    .events { display: grid; gap: 0.75rem; }
    .head h2 { margin: 0; }
    .timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
    .event { display: grid; grid-template-columns: 2.6rem minmax(0, 1fr); gap: 0.75rem; position: relative; padding-bottom: 1rem; }
    .event:not(:last-child)::before { content: ''; position: absolute; left: 1.3rem; top: 2.6rem; bottom: 0; width: 2px; background: var(--border); }
    .dot { width: 2.6rem; height: 2.6rem; border-radius: 50%; display: grid; place-items: center; font-size: 1.25rem; background: var(--surface-2); border: 2px solid var(--marigold); }
    .kind-haldi .dot { background: #fff1b8; }
    .kind-mehndi .dot { background: #dff0d8; }
    .kind-wedding .dot { background: var(--accent-soft); border-color: var(--accent); }
    .body { min-width: 0; p { margin: 0; } h3 { margin: 0.1rem 0 0.15rem; font-size: 1.15rem; } }
    .when { color: var(--marigold-deep); font-weight: 600; }
    .venue { overflow-wrap: anywhere; }
    .dress { margin-top: 0.25rem !important; }
    .actions { margin-top: 0.5rem; gap: 0.4rem; }
  `,
})
export class EventsTimelineComponent {
  readonly wedding = input.required<Wedding>();
  readonly pageUrl = input('');

  protected readonly meta = EVENT_META;
  protected readonly events = computed(() => sortEvents(this.wedding().events));
  protected readonly time = formatTime;
  protected readonly name = eventName;
  protected readonly map = mapsUrl;

  protected google(e: WeddingEvent): string {
    return googleCalendarUrl(this.wedding(), e, this.pageUrl());
  }

  protected download(e: WeddingEvent): void {
    downloadText(`${this.wedding().slug}-${e.kind}.ics`, weddingIcs(this.wedding(), [e], this.pageUrl()), 'text/calendar;charset=utf-8');
  }

  protected downloadAll(): void {
    downloadText(`${this.wedding().slug}-functions.ics`, weddingIcs(this.wedding(), this.events(), this.pageUrl()), 'text/calendar;charset=utf-8');
  }
}
