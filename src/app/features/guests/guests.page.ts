import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiService } from '../../core/ai/ai.service';
import { guestGreeting, guestStatus, inviteUrl, inviteWhatsappText, mergeGuests, parseGuestList } from '../../core/guests';
import { defaultInvite } from '../../core/invite';
import { TIER_LABELS } from '../../core/llm/llm-chain';
import { GUEST_STATUS, Guest, GuestStatus, INVITE_TONES, InviteTone, SIDES, Side } from '../../core/models';
import { normalizeIndianPhone, whatsappUrl } from '../../core/share';
import { SettingsStore } from '../../core/settings.store';
import { WeddingStore } from '../../core/wedding.store';
import { copyText } from '../../shared/clipboard';
import { TimeAgoPipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';

const QUEUE_SIZE = 10;
/** Placeholders in the message template, filled in per guest. */
const NAME = '{name}';
const LINK = '{link}';

interface ContactsManager {
  select(props: string[], options?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[] }[]>;
}

/**
 * Guest list for e-invites: add, import (CSV, paste, phone contacts), personal links, and a
 * "send next 10" queue that opens WhatsApp one guest at a time. Nothing is ever sent
 * automatically: each message is a tap in WhatsApp by the couple.
 */
@Component({
  selector: 'app-guests',
  imports: [RouterLink, TimeAgoPipe],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guests.page.html',
  styleUrl: './guests.page.scss',
})
export class GuestsPage {
  protected readonly store = inject(WeddingStore);
  protected readonly settings = inject(SettingsStore);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly statuses = GUEST_STATUS;
  protected readonly sides = SIDES;
  protected readonly tones = INVITE_TONES;
  protected readonly canPickContacts = typeof navigator !== 'undefined' && 'contacts' in navigator;

  protected readonly filter = signal<GuestStatus | 'all'>('all');
  protected readonly group = signal('');
  protected readonly query = signal('');

  // add one
  protected readonly name = signal('');
  protected readonly greeting = signal('');
  protected readonly phone = signal('');
  protected readonly side = signal<Side | null>(null);
  protected readonly groupName = signal('');
  protected readonly showImport = signal(false);
  protected readonly pasted = signal('');

  // message
  protected readonly template = signal('');
  protected readonly tone = signal<InviteTone>('traditional');
  protected readonly writing = signal(false);
  protected readonly writtenBy = signal('');

  // queue
  protected readonly queue = signal<string[]>([]);
  protected readonly queueIndex = signal(0);

  protected readonly design = computed(() => {
    const w = this.store.wedding();
    return w ? w.invite ?? defaultInvite(w) : null;
  });
  protected readonly counts = computed(() => {
    const c: Record<GuestStatus | 'all', number> = { all: 0, 'not-sent': 0, sent: 0, opened: 0, rsvp: 0, gave: 0 };
    for (const g of this.store.guests()) {
      c.all++;
      c[guestStatus(g)]++;
    }
    return c;
  });
  protected readonly groups = computed(() => [...new Set(this.store.guests().map((g) => g.group).filter((g): g is string => !!g))].sort());
  protected readonly visible = computed(() => {
    const f = this.filter();
    const grp = this.group();
    const q = this.query().trim().toLowerCase();
    return this.store.guests().filter((g) =>
      (f === 'all' || guestStatus(g) === f) && (!grp || g.group === grp) &&
      (!q || g.name.toLowerCase().includes(q) || (g.greeting ?? '').toLowerCase().includes(q) || (g.phone ?? '').includes(q)),
    );
  });
  protected readonly current = computed(() => {
    const id = this.queue()[this.queueIndex()];
    return this.store.guests().find((g) => g.id === id) ?? null;
  });

  protected readonly status = guestStatus;
  protected readonly statusLabel = (s: GuestStatus) => GUEST_STATUS.find((x) => x.id === s)!.label;

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(async () => {
        const w = await this.store.load(slug, { manage: true });
        if (w && !this.template()) this.template.set(this.defaultTemplate());
      });
    });
  }

  private defaultTemplate(): string {
    const w = this.store.wedding()!;
    return inviteWhatsappText(w, { name: NAME, greeting: NAME }, LINK, this.design()!.language);
  }

  protected link(g: Guest): string {
    return inviteUrl(this.slug(), g.token);
  }

  protected message(g: Guest): string {
    return this.template().split(NAME).join(guestGreeting(g)).split(LINK).join(this.link(g));
  }

  // ---------- adding ----------

  protected async addOne(): Promise<void> {
    const w = this.store.wedding();
    const name = this.name().trim();
    if (!w || name.length < 2) {
      this.toast.show('Add the guest’s name.');
      return;
    }
    const phone = this.phone().trim() ? normalizeIndianPhone(this.phone()) : null;
    if (this.phone().trim() && !phone) {
      this.toast.show('Enter a 10-digit Indian mobile number, or leave it empty.');
      return;
    }
    const fresh = mergeGuests(w.id, this.store.guests(), [{
      name, ...(phone ? { phone } : {}), ...(this.side() ? { side: this.side()! } : {}),
      ...(this.groupName().trim() ? { group: this.groupName().trim() } : {}), ...(this.greeting().trim() ? { greeting: this.greeting().trim() } : {}),
    }]);
    if (!fresh.length) {
      this.toast.show(`${name} is already on your list.`);
      return;
    }
    await this.save(fresh, `${name} added`);
    this.name.set('');
    this.greeting.set('');
    this.phone.set('');
  }

  protected async importText(text: string): Promise<void> {
    const w = this.store.wedding();
    if (!w) return;
    const { guests, skipped } = parseGuestList(text);
    const fresh = mergeGuests(w.id, this.store.guests(), guests);
    if (!fresh.length) {
      this.toast.show(guests.length ? 'Everyone there is already on your list.' : 'No names found. Put one guest per line.');
      return;
    }
    await this.save(fresh, `${fresh.length} guests added${skipped ? `, ${skipped} lines skipped` : ''}`);
    this.pasted.set('');
    this.showImport.set(false);
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await this.importText(await file.text());
    input.value = '';
  }

  /** Android Chrome's contact picker: the couple chooses people; nothing else is read. */
  protected async pickContacts(): Promise<void> {
    try {
      const contacts = await (navigator as Navigator & { contacts: ContactsManager }).contacts.select(['name', 'tel'], { multiple: true });
      await this.importText(contacts.map((c) => `${c.name?.[0] ?? ''}, ${c.tel?.[0] ?? ''}`).join('\n'));
    } catch {
      // closed the picker
    }
  }

  private async save(guests: Guest[], message: string): Promise<void> {
    try {
      await this.store.saveGuests(guests);
      this.toast.show(message);
    } catch (e) {
      this.toast.show((e as Error).message);
    }
  }

  protected async remove(g: Guest): Promise<void> {
    if (!confirm(`Remove ${g.name} from the guest list?`)) return;
    await this.store.removeGuest(g);
  }

  // ---------- message ----------

  protected async writeWithAi(): Promise<void> {
    const w = this.store.wedding();
    const d = this.design();
    if (!w || !d) return;
    this.writing.set(true);
    try {
      const r = await this.ai.whatsappMessage({ wedding: w, greeting: NAME, url: LINK, language: d.language, tone: this.tone() });
      // Models sometimes rewrite the placeholder; make sure each guest still gets their name and link.
      let text = r.value;
      if (!text.includes(NAME)) text = text.replace(/^(\S+\s+)?/, (m) => `${m}${NAME}, `);
      this.template.set(text);
      this.writtenBy.set(TIER_LABELS[r.tier]);
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.writing.set(false);
    }
  }

  protected resetTemplate(): void {
    this.template.set(this.defaultTemplate());
    this.writtenBy.set('');
  }

  // ---------- sending ----------

  protected whatsapp(g: Guest): string {
    return whatsappUrl(this.message(g), g.phone);
  }

  /** Opening WhatsApp for a guest counts as "sent"; the couple still presses send in WhatsApp. */
  protected async markSent(g: Guest): Promise<void> {
    if (g.sentAt) return;
    await this.store.saveGuests([{ ...g, sentAt: Date.now() }]);
  }

  protected async copyLink(g: Guest): Promise<void> {
    this.toast.show((await copyText(this.link(g))) ? `${g.name}'s link copied` : 'Could not copy');
  }

  protected startQueue(): void {
    const next = this.store.guests().filter((g) => !g.sentAt && g.phone).slice(0, QUEUE_SIZE).map((g) => g.id);
    if (!next.length) {
      this.toast.show('Everyone with a phone number has been sent their invite.');
      return;
    }
    this.queue.set(next);
    this.queueIndex.set(0);
  }

  protected async sendCurrent(): Promise<void> {
    const g = this.current();
    if (!g) return;
    globalThis.open?.(this.whatsapp(g), '_blank', 'noopener');
    await this.markSent(g);
    this.advance();
  }

  protected advance(): void {
    if (this.queueIndex() + 1 >= this.queue().length) {
      this.toast.show('Done! Start the next 10 whenever you are ready.');
      this.queue.set([]);
    } else {
      this.queueIndex.update((i) => i + 1);
    }
  }
}
