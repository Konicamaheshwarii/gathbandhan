import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiService } from '../../core/ai/ai.service';
import { contributionsCsv, downloadText } from '../../core/csv';
import { Contribution, GoalUpdate, NOTE_LANGUAGES, NoteLanguage, SIDES, Side, isConfirmed } from '../../core/models';
import { RUNTIME_CONFIG } from '../../core/config';
import { isTestKey } from '../../../../supabase/functions/_shared/razorpay-core';
import { PAYMENT_GATEWAY } from '../../core/payments/payment-gateway.token';
import { formatRupees } from '../../core/payments/payments.models';
import { ProfileStore } from '../../core/profile/profile.store';
import { SettingsStore } from '../../core/settings.store';
import { inviteMessage, whatsappUrl } from '../../core/share';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { Wedding } from '../../core/models';
import { copyText } from '../../shared/clipboard';
import { LogoComponent } from '../../shared/logo.component';
import { IndianDatePipe, InrPipe, TimeAgoPipe } from '../../shared/pipes';
import { readJson } from '../../core/storage';
import { CARD_PRINTED_KEY, activityFeed, daysToGo, inviteStats, weddingChecklist } from '../../core/stats';
import { SideSplitComponent } from './side-split.component';
import { TrendChartComponent } from './trend-chart.component';
import { ToastService } from '../../shared/toast.service';
import { CoOwnersComponent } from './co-owners.component';
import { GoalUpdateComponent, withUpdate, withoutUpdate } from './goal-update.component';
import { RsvpSummaryComponent } from './rsvp-summary.component';

type Filter = 'all' | 'unverified' | 'verified' | 'unthanked';

interface NoteDraft {
  language: NoteLanguage;
  mentionAmount: boolean;
  text: string;
  busy: boolean;
  error: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [LogoComponent, RouterLink, InrPipe, IndianDatePipe, TimeAgoPipe, RsvpSummaryComponent, CoOwnersComponent, GoalUpdateComponent, TrendChartComponent, SideSplitComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  protected readonly store = inject(WeddingStore);
  protected readonly settings = inject(SettingsStore);
  private readonly profile = inject(ProfileStore);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);
  private readonly gateway = inject(PAYMENT_GATEWAY);
  private readonly config = inject(RUNTIME_CONFIG);
  protected readonly rupees = formatRupees;

  readonly slug = input.required<string>();

  protected readonly languages = NOTE_LANGUAGES;
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unverified', label: 'To verify' },
    { id: 'verified', label: 'Verified' },
    { id: 'unthanked', label: 'Not thanked' },
  ];
  protected readonly filter = signal<Filter>('all');
  protected readonly sides = SIDES;
  protected readonly side = signal<Side | 'all'>('all');
  protected readonly query = signal('');
  /** Contribution whose thank-you panel is open. */
  protected readonly openNote = signal<string | null>(null);
  protected readonly drafts = signal<Record<string, NoteDraft>>({});
  /** Thank-you notes start in the language chosen in the account profile. */
  protected readonly defaultLanguage = signal<NoteLanguage>(this.profile.noteLanguage());
  /** Latest request per guest, so a slow earlier draft never overwrites a newer one. */
  private readonly noteSeq = new Map<string, number>();

  protected readonly couple = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });
  /** "Namaste, Konica" for a signed-in person with a profile, else the couple's names. */
  protected readonly greetName = computed(() => this.profile.name() || this.couple());
  protected readonly goalTitle = computed(() => new Map((this.store.wedding()?.goals ?? []).map((g) => [g.id, g])));
  protected readonly counts = computed(() => {
    const list = this.store.contributions();
    return {
      all: list.length,
      unverified: list.filter((c) => !isConfirmed(c)).length,
      verified: list.filter(isConfirmed).length,
      unthanked: list.filter((c) => !c.thankedAt).length,
    };
  });
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const side = this.side();
    return this.store.contributions().filter((c) => {
      if (side !== 'all' && c.side !== side) return false;
      const f = this.filter();
      if (f === 'unverified' && isConfirmed(c)) return false;
      if (f === 'verified' && !isConfirmed(c)) return false;
      if (f === 'unthanked' && c.thankedAt) return false;
      return !q || c.guestName.toLowerCase().includes(q) || c.message.toLowerCase().includes(q);
    });
  });
  protected readonly bySide = computed(() => {
    const list = this.store.contributions();
    const total = (side: Side) => list.filter((c) => c.side === side).reduce((t, c) => t + c.amount, 0);
    return { bride: total('bride'), groom: total('groom') };
  });
  /** Paid through Razorpay vs. guest-confirmed UPI, and the fees on Razorpay payments. */
  protected readonly payments = computed(() => {
    const list = this.store.contributions();
    const paid = list.filter((c) => c.status === 'paid');
    const sum = (l: Contribution[]) => l.reduce((t, c) => t + c.amount, 0);
    return {
      paid: sum(paid),
      paidCount: paid.length,
      fees: Math.round(paid.reduce((t, c) => t + (c.fee ?? 0), 0) * 100) / 100,
      guestFees: Math.round(paid.reduce((t, c) => t + (c.guestFee ?? 0), 0) * 100) / 100,
      guestConfirmed: sum(list.filter((c) => c.status === 'guest-confirmed')),
      verified: sum(list.filter((c) => c.status === 'verified')),
      incomplete: this.store.incomplete().length,
    };
  });
  protected readonly razorpayMode = computed(() => this.store.wedding()?.paymentMode === 'razorpay');
  protected readonly testMode = computed(() => {
    const w = this.store.wedding();
    return !!w && (this.gateway.availability(w) === 'simulated' || isTestKey(this.config.razorpayKeyId));
  });
  protected readonly invites = computed(() => inviteStats(this.store.guests()));
  protected readonly people = computed(() => this.store.rsvps().filter((r) => r.eventIds.length).reduce((t, r) => t + r.partySize, 0));
  protected readonly daysLeft = computed(() => {
    const w = this.store.wedding();
    return w ? daysToGo(w) : 0;
  });
  protected readonly activity = computed(() => {
    const w = this.store.wedding();
    return w ? activityFeed(w, this.store.contributions(), this.store.rsvps(), this.store.guests()) : [];
  });
  protected readonly checklist = computed(() => {
    const w = this.store.wedding();
    return w ? weddingChecklist(w, this.store.contributions(), this.store.rsvps(), this.store.guests(), readJson<boolean>(CARD_PRINTED_KEY(w.id), false)) : [];
  });
  protected readonly checkDone = computed(() => this.checklist().filter((c) => c.done).length);
  protected pct(a: number, b: number): number {
    return b ? Math.round((a / b) * 100) : 0;
  }
  /** The goal's own photo, else its newest update photo. */
  protected goalPhoto(g: Wedding['goals'][number]): string {
    return g.imageUrl || g.updates?.find((u) => u.imageUrl)?.imageUrl || '';
  }
  protected readonly whatsapp = computed(() => {
    const w = this.store.wedding();
    const t = this.store.totals();
    return w && t ? whatsappUrl(inviteMessage(w, this.store.shareUrl(), t.target)) : '';
  });

  constructor() {
    effect(() => void this.store.load(this.slug(), { manage: true }));
  }

  protected async toggleVerified(c: Contribution): Promise<void> {
    await this.store.setVerified(c, c.status !== 'verified');
  }

  protected async remove(c: Contribution): Promise<void> {
    if (!confirm(`Remove ${c.guestName}'s contribution? Use this only for mistakes or duplicates.`)) return;
    await this.store.remove(c);
    this.toast.show('Contribution removed');
  }

  protected async postUpdate(goalId: string, update: GoalUpdate): Promise<void> {
    await this.editGoal(goalId, (g) => withUpdate(g, update), 'Update posted on your page');
  }

  protected async deleteUpdate(goalId: string, updateId: string): Promise<void> {
    if (!confirm('Delete this update?')) return;
    await this.editGoal(goalId, (g) => withoutUpdate(g, updateId), 'Update deleted');
  }

  private async editGoal(goalId: string, change: (g: Wedding['goals'][number]) => Wedding['goals'][number], message: string): Promise<void> {
    const w = this.store.wedding();
    if (!w) return;
    try {
      await this.store.saveWedding({ ...w, goals: w.goals.map((g) => (g.id === goalId ? change(g) : g)) });
      this.toast.show(message);
    } catch (e) {
      this.toast.show((e as Error).message);
    }
  }

  protected exportCsv(): void {
    const w = this.store.wedding();
    if (!w) return;
    downloadText(`shagun-${w.slug}-${new Date().toISOString().slice(0, 10)}.csv`, contributionsCsv(w, this.store.contributions()));
    this.toast.show('CSV downloaded');
  }

  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  /** The phone's own share sheet (WhatsApp, Telegram, SMS, email…). */
  protected async share(): Promise<void> {
    const w = this.store.wedding();
    const t = this.store.totals();
    if (!w || !t) return;
    try {
      await navigator.share({ title: this.couple(), text: inviteMessage(w, '', t.target).trim(), url: this.store.shareUrl() });
    } catch {
      // closed the share sheet
    }
  }

  protected async copyLink(): Promise<void> {
    this.toast.show((await copyText(this.store.shareUrl())) ? 'Link copied' : 'Could not copy');
  }

  // ---------- thank-you notes ----------

  protected draft(id: string): NoteDraft {
    return this.drafts()[id] ?? { language: this.defaultLanguage(), mentionAmount: false, text: '', busy: false, error: '' };
  }

  private patchDraft(id: string, patch: Partial<NoteDraft>): void {
    this.drafts.update((d) => ({ ...d, [id]: { ...this.draft(id), ...patch } }));
  }

  protected toggleNote(c: Contribution): void {
    const opening = this.openNote() !== c.id;
    this.openNote.set(opening ? c.id : null);
    if (opening && !this.draft(c.id).text) void this.writeNote(c);
  }

  protected setLanguage(c: Contribution, language: NoteLanguage): void {
    this.defaultLanguage.set(language);
    this.patchDraft(c.id, { language });
    void this.writeNote(c);
  }

  protected setMentionAmount(c: Contribution, mentionAmount: boolean): void {
    this.patchDraft(c.id, { mentionAmount });
    void this.writeNote(c);
  }

  protected editNote(c: Contribution, text: string): void {
    this.patchDraft(c.id, { text });
  }

  protected async writeNote(c: Contribution): Promise<void> {
    const w = this.store.wedding();
    if (!w) return;
    const d = this.draft(c.id);
    const seq = (this.noteSeq.get(c.id) ?? 0) + 1;
    this.noteSeq.set(c.id, seq);
    const current = () => this.noteSeq.get(c.id) === seq;
    this.patchDraft(c.id, { busy: true, error: '' });
    try {
      const text = await this.ai.draftThanks({
        couple: `${w.partner1} & ${w.partner2}`,
        guestName: c.guestName,
        amount: c.amount,
        goalTitle: this.goalTitle().get(c.goalId)?.title ?? 'our new life together',
        message: c.message,
        language: d.language,
        mentionAmount: d.mentionAmount,
      });
      if (current()) this.patchDraft(c.id, { text, busy: false });
    } catch (e) {
      if (current()) this.patchDraft(c.id, { busy: false, error: (e as Error).message });
    }
  }

  protected async copyNote(c: Contribution): Promise<void> {
    this.toast.show((await copyText(this.draft(c.id).text)) ? 'Note copied' : 'Could not copy');
  }

  protected noteWhatsapp(c: Contribution): string {
    return whatsappUrl(this.draft(c.id).text, c.phone);
  }

  protected async markThanked(c: Contribution, thanked: boolean): Promise<void> {
    await this.store.markThanked(c, thanked);
    if (thanked) {
      this.openNote.set(null);
      this.toast.show(`Marked ${firstName(c.guestName)} as thanked`);
    }
  }
}
