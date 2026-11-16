import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AiService } from '../../core/ai/ai.service';
import { TIER_LABELS } from '../../core/llm/llm-chain';
import { Guest, INVITE_LANGUAGES, INVITE_TONES, InviteLanguage, InviteTone, Wedding } from '../../core/models';
import { SettingsStore } from '../../core/settings.store';
import { whatsappUrl } from '../../core/share';
import { MSG, whatsappToHtml } from '../../core/whatsapp-invite';
import { copyText } from '../../shared/clipboard';
import { ToastService } from '../../shared/toast.service';
import { InviteMessageState } from './invite-message.state';

/** Shown when there are no guests yet, so the preview still reads naturally. */
export const SAMPLE_GUEST: Pick<Guest, 'name' | 'greeting' | 'token'> = { name: 'Sharma Parivar', greeting: 'Sharma Parivar', token: '' };

const TONE_LABELS: Record<InviteTone, string> = { traditional: 'Traditional', modern: 'Modern', fun: 'Fun' };

/**
 * The WhatsApp message, previewed as a chat bubble for one guest: pick the language (each label
 * in its own script) and tone, optionally add the shagun link, rewrite with AI or edit by hand,
 * then copy it or open WhatsApp.
 */
@Component({
  selector: 'app-invite-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-composer.component.html',
  styleUrl: './invite-composer.component.scss',
})
export class InviteComposerComponent {
  protected readonly state = inject(InviteMessageState);
  protected readonly settings = inject(SettingsStore);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);

  readonly wedding = input.required<Wedding>();
  readonly guests = input<Guest[]>([]);
  /** Opening WhatsApp for a real guest counts as sending their invite. */
  readonly opened = output<Guest>();

  protected readonly languages = INVITE_LANGUAGES;
  protected readonly tones = INVITE_TONES;
  protected readonly toneLabel = (t: InviteTone) => TONE_LABELS[t];
  protected readonly langLabel = (l: InviteLanguage) => INVITE_LANGUAGES.find((x) => x.id === l)?.label ?? l;

  protected readonly previewId = signal('');
  protected readonly editing = signal(false);
  protected readonly writing = signal(false);
  protected readonly writtenBy = signal('');

  /** The guest the preview is for: the chosen one, else the first guest, else a sample. */
  protected readonly previewGuest = computed<Guest | null>(() => {
    const list = this.guests();
    return list.find((g) => g.id === this.previewId()) ?? list.at(0) ?? null;
  });
  protected readonly text = computed(() => this.state.message(this.previewGuest() ?? SAMPLE_GUEST, this.state.language()));
  protected readonly html = computed(() => whatsappToHtml(this.text()));
  /** The time shown on the bubble, like WhatsApp. */
  protected readonly clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date());
  /** The previewed guest has their own language set in the list. */
  protected readonly ownLanguage = computed(() => {
    const g = this.previewGuest();
    return g?.language && g.language !== this.state.language() ? g.language : null;
  });
  protected readonly waLink = computed(() => whatsappUrl(this.text(), this.previewGuest()?.phone));

  protected async copy(): Promise<void> {
    this.toast.show((await copyText(this.text())) ? 'Message copied. Paste it in WhatsApp.' : 'Could not copy');
  }

  protected openWhatsapp(): void {
    const g = this.previewGuest();
    if (g) this.opened.emit(g);
  }

  protected async rewrite(): Promise<void> {
    this.writing.set(true);
    try {
      const r = await this.ai.whatsappMessage({
        wedding: this.wedding(), greeting: MSG.name, url: MSG.link, rsvpUrl: MSG.rsvp,
        shagunUrl: this.state.includeShagun() ? MSG.shagun : undefined, language: this.state.language(), tone: this.state.tone(),
      });
      // Models sometimes rewrite the placeholder; make sure each guest still gets their name.
      let t = r.value;
      if (!t.includes(MSG.name)) t = t.replace(/^(\S+\s+)?/, (m) => `${m}${MSG.name}, `);
      this.state.setTemplate(t);
      this.writtenBy.set(TIER_LABELS[r.tier]);
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.writing.set(false);
    }
  }

  protected reset(): void {
    this.state.resetTemplate();
    this.writtenBy.set('');
  }

  protected pickLanguage(l: InviteLanguage): void {
    this.state.setLanguage(l);
    this.writtenBy.set('');
  }

  protected pickTone(t: InviteTone): void {
    this.state.setTone(t);
    this.writtenBy.set('');
  }
}
