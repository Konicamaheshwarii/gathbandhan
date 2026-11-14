import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { eventLocation, mapsUrl, sortEvents } from '../../core/calendar';
import { LABELS, InvitePage, inkFor, localDate, localEventName, localTime, nameList, templateMeta } from '../../core/invite';
import { aiImageUrl } from '../../core/llm/pollinations.provider';
import { EVENT_META, InviteDesign, Wedding } from '../../core/models';
import { firstName, hashString } from '../../core/util';
import { QrCodeComponent } from '../../shared/qr-code.component';
import { INVITE_FONTS } from '../../shared/invite-fonts';
import { InviteMotifComponent } from './invite-motif.component';

const WITH: Record<string, string> = { english: '&', hinglish: '&', hindi: 'संग', gujarati: 'સંગ' };

/** One page of the digital kankotri. Everything is sized in container units, so any width works. */
@Component({
  selector: 'app-invite-page',
  imports: [InviteMotifComponent, QrCodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-page.component.html',
  styleUrl: './invite-page.component.scss',
  host: { '[style]': 'vars()' },
})
export class InvitePageComponent {
  readonly wedding = input.required<Wedding>();
  readonly design = input.required<InviteDesign>();
  readonly page = input.required<InvitePage>();
  /** "Sharma Parivar" on a personal invite. */
  readonly greeting = input<string | null>(null);
  readonly rsvpUrl = input('');
  readonly giveUrl = input('');

  protected readonly meta = EVENT_META;
  protected readonly labels = computed(() => LABELS[this.design().language]);
  protected readonly names = computed(() => ({ a: firstName(this.wedding().partner1), b: firstName(this.wedding().partner2) }));
  protected readonly monogram = computed(() => `${this.names().a[0] ?? ''} & ${this.names().b[0] ?? ''}`);
  protected readonly withWord = computed(() => WITH[this.design().language]);
  protected readonly date = computed(() => localDate(this.wedding().date, this.design().language));
  protected readonly mainEvent = computed(() => sortEvents(this.wedding().events).find((e) => e.kind === 'wedding') ?? null);
  protected readonly mapUrl = computed(() => {
    const e = this.mainEvent();
    return e ? mapsUrl(e) : this.wedding().venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${this.wedding().venue}, ${this.wedding().city}`)}` : '';
  });
  protected readonly place = computed(() => {
    const e = this.mainEvent();
    return e ? eventLocation(e) : [this.wedding().venue, this.wedding().city].filter(Boolean).join(', ');
  });
  protected readonly swagat = computed(() => nameList(this.design().swagatotsuk));
  protected readonly darshan = computed(() => nameList(this.design().darshanabhilashi));
  protected readonly hasShlok = computed(() => this.design().showShlok && !!this.design().text.shlok && templateMeta(this.design().template).invocation);
  protected readonly aiBackground = computed(() => {
    const d = this.design();
    if (!d.aiBackground) return '';
    const prompt = `ornamental Indian wedding invitation background, ${templateMeta(d.template).blurb}, soft watercolor, empty center, no text, no letters, colors ${d.palette.paper} ${d.palette.accent}`;
    return aiImageUrl(prompt, hashString(this.wedding().id + d.template) % 100_000);
  });

  protected readonly vars = computed(() => {
    const d = this.design();
    const fonts = INVITE_FONTS[d.language];
    return {
      '--i-primary': d.palette.primary,
      '--i-accent': d.palette.accent,
      '--i-paper': d.palette.paper,
      '--i-ink': inkFor(d.palette),
      '--i-display': fonts.display,
      '--i-body': fonts.body,
    };
  });

  protected eventName = localEventName;
  protected eventTime = localTime;
  protected eventDate = localDate;

  protected hideImage(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }
}
