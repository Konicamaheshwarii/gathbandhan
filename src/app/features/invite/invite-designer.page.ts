import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiService } from '../../core/ai/ai.service';
import { DesignPick, InvitePage, TEMPLATES, defaultInvite, designPicks, draftInviteText, invitePages, templateMeta } from '../../core/invite';
import { TIER_LABELS } from '../../core/llm/llm-chain';
import { INVITE_LANGUAGES, INVITE_TONES, InviteDesign, InviteLanguage, InviteTemplate, InviteText, InviteTone } from '../../core/models';
import { SettingsStore } from '../../core/settings.store';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { appBaseUrl } from '../../core/wedding-link';
import { pagePng, pagesPdf, saveBlob } from '../../shared/export';
import { ensureInviteFonts } from '../../shared/invite-fonts';
import { LogoComponent } from '../../shared/logo.component';
import { ToastService } from '../../shared/toast.service';
import { InvitePageComponent } from './invite-page.component';

/** The couple designs their digital kankotri: template, words (AI or typed), colours, families, export. */
@Component({
  selector: 'app-invite-designer',
  imports: [LogoComponent, RouterLink, InvitePageComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-designer.page.html',
  styleUrl: './invite-designer.page.scss',
})
export class InviteDesignerPage {
  protected readonly store = inject(WeddingStore);
  protected readonly settings = inject(SettingsStore);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly templates = TEMPLATES;
  protected readonly languages = INVITE_LANGUAGES;
  protected readonly tones = INVITE_TONES;
  protected readonly design = signal<InviteDesign | null>(null);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly exporting = signal('');
  protected readonly wishes = signal('');
  protected readonly pickBusy = signal(false);
  protected readonly pick = signal<(DesignPick & { via: string }) | null>(null);
  protected readonly textBusy = signal(false);
  protected readonly textVia = signal('');
  protected readonly personal = signal(false);
  protected readonly coverPage: InvitePage = { kind: 'cover' };
  /** The couple's current words in another template, for the style picker. */
  protected previewOf(d: InviteDesign, id: InviteTemplate): InviteDesign {
    const meta = templateMeta(id);
    return { ...d, template: id, palette: meta.palette, showShlok: meta.invocation, aiBackground: false };
  }
  protected readonly templateName = (id: InviteTemplate) => templateMeta(id).name;
  protected readonly languageLabel = (id: InviteLanguage) => INVITE_LANGUAGES.find((l) => l.id === id)?.label ?? id;

  protected readonly pages = computed(() => {
    const w = this.store.wedding();
    const d = this.design();
    return w && d ? invitePages(w, d) : [];
  });
  protected readonly photos = computed(() => {
    const w = this.store.wedding();
    if (!w) return [];
    return [...(w.gallery ?? []).map((p) => p.url), ...(w.cover.imageUrl ? [w.cover.imageUrl] : [])];
  });
  protected readonly couple = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });
  protected readonly rsvpUrl = computed(() => `${appBaseUrl()}#/w/${this.slug()}/rsvp`);
  protected readonly giveUrl = computed(() => `${appBaseUrl()}#/w/${this.slug()}/give`);

  private readonly pageEls = viewChildren('pageEl', { read: ElementRef<HTMLElement> });

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(async () => {
        const w = await this.store.load(slug, { manage: true });
        if (w) this.design.set(structuredClone(w.invite ?? defaultInvite(w)));
      });
    });
    effect(() => {
      const d = this.design();
      if (d) void ensureInviteFonts(d.language);
    });
  }

  protected patch(change: Partial<InviteDesign>): void {
    this.design.update((d) => (d ? { ...d, ...change } : d));
    this.dirty.set(true);
  }

  protected patchText(change: Partial<InviteText>): void {
    const d = this.design();
    if (d) this.patch({ text: { ...d.text, ...change } });
  }

  /** Switching template keeps the couple's words but takes the template's colours. */
  protected chooseTemplate(id: InviteTemplate): void {
    const meta = templateMeta(id);
    this.patch({ template: id, palette: { ...meta.palette }, showShlok: meta.invocation });
  }

  /** Language and tone redraft the words offline at once; "Write with AI" can improve them. */
  protected setVoice(language: InviteLanguage, tone: InviteTone): void {
    const w = this.store.wedding();
    const d = this.design();
    if (!w || !d) return;
    this.patch({ language, tone, text: draftInviteText(w, language, tone, d.template) });
    this.textVia.set('');
  }

  protected setGrandparent(side: 'bride' | 'groom', value: string): void {
    const d = this.design();
    if (d) this.patch({ grandparents: { ...d.grandparents, [side]: value } });
  }

  protected setColour(key: 'primary' | 'accent' | 'paper', value: string): void {
    const d = this.design();
    if (d) this.patch({ palette: { ...d.palette, [key]: value } });
  }

  protected resetColours(): void {
    const d = this.design();
    if (d) this.patch({ palette: { ...templateMeta(d.template).palette } });
  }

  protected async writeWithAi(): Promise<void> {
    const w = this.store.wedding();
    const d = this.design();
    if (!w || !d) return;
    this.textBusy.set(true);
    try {
      const r = await this.ai.inviteText({ wedding: w, language: d.language, tone: d.tone, template: d.template });
      this.patch({ text: r.value });
      this.textVia.set(TIER_LABELS[r.tier]);
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.textBusy.set(false);
    }
  }

  protected async suggestDesign(): Promise<void> {
    const w = this.store.wedding();
    if (!w) return;
    this.pickBusy.set(true);
    try {
      const r = await this.ai.designPicks({ wedding: w, wishes: this.wishes() });
      this.pick.set({ ...r.value, via: TIER_LABELS[r.tier] });
    } catch {
      this.pick.set({ ...designPicks(w, this.wishes()), via: TIER_LABELS.offline });
    } finally {
      this.pickBusy.set(false);
    }
  }

  protected applyPick(): void {
    const w = this.store.wedding();
    const p = this.pick();
    const d = this.design();
    if (!w || !p || !d) return;
    this.patch({
      template: p.template, palette: { ...p.palette }, language: p.language, tone: p.tone,
      showShlok: templateMeta(p.template).invocation, text: draftInviteText(w, p.language, p.tone, p.template),
    });
    this.pick.set(null);
    this.toast.show('Design applied. Tap "Write with AI" to polish the words.');
  }

  protected async save(): Promise<void> {
    const w = this.store.wedding();
    const d = this.design();
    if (!w || !d) return;
    this.saving.set(true);
    try {
      await this.store.saveWedding({ ...w, invite: { ...d, updatedAt: Date.now() } });
      this.dirty.set(false);
      this.toast.show('Invite saved');
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private nodes(): HTMLElement[] {
    return this.pageEls().map((r) => (r.nativeElement as HTMLElement).querySelector<HTMLElement>('.page')!);
  }

  protected async downloadPng(index: number): Promise<void> {
    await this.run(`page ${index + 1}`, async () => {
      saveBlob(`invite-${this.slug()}-${index + 1}.png`, await pagePng(this.nodes()[index]));
    });
  }

  protected async downloadAllPng(): Promise<void> {
    await this.run('all pages', async () => {
      const nodes = this.nodes();
      for (let i = 0; i < nodes.length; i++) saveBlob(`invite-${this.slug()}-${i + 1}.png`, await pagePng(nodes[i]));
    });
  }

  protected async downloadPdf(): Promise<void> {
    await this.run('PDF', async () => {
      saveBlob(`invite-${this.slug()}.pdf`, await pagesPdf(this.nodes(), `${this.couple()} wedding invitation`));
    });
  }

  private async run(label: string, fn: () => Promise<void>): Promise<void> {
    this.exporting.set(label);
    try {
      await fn();
      this.toast.show('Downloaded. Share it on WhatsApp!');
    } catch (e) {
      this.toast.show(`Could not export: ${(e as Error).message}`);
    } finally {
      this.exporting.set('');
    }
  }
}
