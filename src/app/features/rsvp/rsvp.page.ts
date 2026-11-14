import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { eventName, formatTime, sortEvents } from '../../core/calendar';
import { EVENT_META, MAX_PARTY, NOTE_MAX, SIDES, Side } from '../../core/models';
import { normalizeIndianPhone } from '../../core/share';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { IndianDatePipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';

/** Guests tell the couple which functions they will attend and how many people are coming. */
@Component({
  selector: 'app-rsvp',
  imports: [RouterLink, IndianDatePipe],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rsvp.page.html',
  styleUrl: './rsvp.page.scss',
})
export class RsvpPage {
  protected readonly store = inject(WeddingStore);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly sides = SIDES;
  protected readonly meta = EVENT_META;
  protected readonly maxParty = MAX_PARTY;
  protected readonly noteMax = NOTE_MAX;
  protected readonly time = formatTime;
  protected readonly name = eventName;

  protected readonly guestName = signal('');
  protected readonly phone = signal('');
  protected readonly side = signal<Side | null>(null);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly partySize = signal(1);
  protected readonly note = signal('');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly done = signal(false);

  protected readonly events = computed(() => sortEvents(this.store.wedding()?.events));
  protected readonly couple = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });
  protected readonly attending = computed(() => this.chosen().size > 0);
  protected readonly errors = computed(() => {
    const phone = this.phone().trim();
    return {
      name: this.guestName().trim().length >= 2 ? '' : 'Tell the couple who is replying.',
      phone: phone && !normalizeIndianPhone(phone) ? 'Enter a 10-digit Indian mobile number, or leave it empty.' : '',
      party: Number.isInteger(this.partySize()) && this.partySize() >= 1 && this.partySize() <= MAX_PARTY ? '' : `Between 1 and ${MAX_PARTY} people.`,
      note: this.note().length > NOTE_MAX ? `Keep it under ${NOTE_MAX} characters.` : '',
    };
  });
  protected readonly valid = computed(() => Object.values(this.errors()).every((e) => !e));

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(async () => {
        const w = await this.store.load(slug);
        // Most guests come to everything: start with every function ticked.
        if (w?.events?.length) this.chosen.set(new Set(w.events.map((e) => e.id)));
      });
    });
  }

  protected toggle(id: string): void {
    this.chosen.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected step(delta: number): void {
    this.partySize.update((n) => Math.min(MAX_PARTY, Math.max(1, n + delta)));
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.rsvp({
        guestName: this.guestName().trim(),
        phone: normalizeIndianPhone(this.phone()) ?? undefined,
        side: this.side() ?? undefined,
        eventIds: this.events().filter((e) => this.chosen().has(e.id)).map((e) => e.id),
        partySize: this.partySize(),
        note: this.note().trim(),
      });
      this.done.set(true);
      globalThis.scrollTo?.({ top: 0 });
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
