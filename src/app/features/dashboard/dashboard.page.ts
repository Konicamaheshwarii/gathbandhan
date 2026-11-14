import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiService } from '../../core/ai/ai.service';
import { contributionsCsv, downloadText } from '../../core/csv';
import { Contribution, NOTE_LANGUAGES, NoteLanguage } from '../../core/models';
import { SettingsStore } from '../../core/settings.store';
import { inviteMessage, whatsappUrl } from '../../core/share';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { copyText } from '../../shared/clipboard';
import { InrPipe, TimeAgoPipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';

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
  imports: [RouterLink, InrPipe, TimeAgoPipe],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  protected readonly store = inject(WeddingStore);
  protected readonly settings = inject(SettingsStore);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly languages = NOTE_LANGUAGES;
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unverified', label: 'To verify' },
    { id: 'verified', label: 'Verified' },
    { id: 'unthanked', label: 'Not thanked' },
  ];
  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  /** Contribution whose thank-you panel is open. */
  protected readonly openNote = signal<string | null>(null);
  protected readonly drafts = signal<Record<string, NoteDraft>>({});
  protected readonly defaultLanguage = signal<NoteLanguage>('english');
  /** Latest request per guest, so a slow earlier draft never overwrites a newer one. */
  private readonly noteSeq = new Map<string, number>();

  protected readonly couple = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });
  protected readonly goalTitle = computed(() => new Map((this.store.wedding()?.goals ?? []).map((g) => [g.id, g])));
  protected readonly counts = computed(() => {
    const list = this.store.contributions();
    return {
      all: list.length,
      unverified: list.filter((c) => c.status !== 'verified').length,
      verified: list.filter((c) => c.status === 'verified').length,
      unthanked: list.filter((c) => !c.thankedAt).length,
    };
  });
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store.contributions().filter((c) => {
      const f = this.filter();
      if (f === 'unverified' && c.status === 'verified') return false;
      if (f === 'verified' && c.status !== 'verified') return false;
      if (f === 'unthanked' && c.thankedAt) return false;
      return !q || c.guestName.toLowerCase().includes(q) || c.message.toLowerCase().includes(q);
    });
  });
  protected readonly whatsapp = computed(() => {
    const w = this.store.wedding();
    const t = this.store.totals();
    return w && t ? whatsappUrl(inviteMessage(w, this.store.shareUrl(), t.target)) : '';
  });

  constructor() {
    effect(() => void this.store.load(this.slug()));
  }

  protected async toggleVerified(c: Contribution): Promise<void> {
    await this.store.setVerified(c, c.status !== 'verified');
  }

  protected async remove(c: Contribution): Promise<void> {
    if (!confirm(`Remove ${c.guestName}'s contribution? Use this only for mistakes or duplicates.`)) return;
    await this.store.remove(c);
    this.toast.show('Contribution removed');
  }

  protected exportCsv(): void {
    const w = this.store.wedding();
    if (!w) return;
    downloadText(`shagun-${w.slug}-${new Date().toISOString().slice(0, 10)}.csv`, contributionsCsv(w, this.store.contributions()));
    this.toast.show('CSV downloaded');
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
