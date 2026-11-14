import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_SLUG } from '../../core/data/seed';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { InvitePage, TEMPLATES, defaultInvite, templateMeta } from '../../core/invite';
import { InviteDesign, InviteLanguage, InviteTemplate, Wedding } from '../../core/models';
import { computeTotals } from '../../core/totals';
import { firstName } from '../../core/util';
import { ensureInviteFonts } from '../../shared/invite-fonts';
import { IndianDatePipe, InrPipe } from '../../shared/pipes';
import { InvitePageComponent } from '../invite/invite-page.component';

interface PageSummary {
  wedding: Wedding;
  names: string;
  raised: number;
  target: number;
  percent: number;
  count: number;
}

/** Template, language pairs the hero mockup cycles through (sample content). */
const SHOWCASE: [InviteTemplate, InviteLanguage][] = [
  ['rajasthani', 'english'], ['ganesh', 'hindi'], ['gujarati', 'gujarati'], ['south', 'english'], ['royal', 'english'], ['minimal', 'hinglish'],
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Is Shagun free?', a: 'Yes. The site, the e-invites, the guest tracker and the AI writing are free. There are no fees on shagun: guests pay you directly by UPI.' },
  { q: 'Does Shagun ever touch the money?', a: 'Never. Guests pay from their own UPI app (GPay, PhonePe, Paytm, BHIM or a bank app) straight to your UPI ID. Shagun only records the blessing, and you tick each one off against your bank app.' },
  { q: 'Do guests need to install anything or sign up?', a: 'No. Guests open a link from WhatsApp, read the invite, RSVP and give shagun without an account. Only the couple signs in, with just an email.' },
  { q: 'Which languages are supported?', a: 'Invites, WhatsApp messages and thank-you notes can be written in English, हिन्दी, ગુજરાતી or Hinglish, with proper Devanagari and Gujarati fonts.' },
  { q: 'Where does the AI send my text?', a: "If Chrome's built-in AI is available it runs on your own device. Otherwise the free Pollinations.ai service writes it (you can switch that off in Settings), and if nothing is available the built-in offline templates do. You can also add your own Gemini or Groq key." },
  { q: 'Can I print the invite or send it as a PDF?', a: 'Yes. Download each page as a 1080 × 1920 image for WhatsApp status and chats, or the whole invite as a PDF. A printable QR card for the shagun table is included too.' },
  { q: 'Is it private?', a: 'Guests never see each other’s phone numbers, and amounts stay hidden on the blessing wall unless you choose to show them. Your guest list is visible only to you and the partner you add.' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, InrPipe, IndianDatePipe, InvitePageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly repo = inject(WeddingRepository);
  protected readonly auth = inject(AuthService);

  protected readonly demoSlug = DEMO_SLUG;
  protected readonly faq = FAQ;
  protected readonly templates = TEMPLATES;
  protected readonly pages = signal<PageSummary[]>([]);
  protected readonly demo = computed(() => this.pages().find((p) => p.wedding.demo) ?? null);
  protected readonly mine = computed(() => this.pages().filter((p) => !p.wedding.demo && !p.wedding.imported));
  protected readonly cover: InvitePage = { kind: 'cover' };
  protected readonly showcase = signal(0);
  protected readonly reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** The sample wedding's invite in a given template (and that template's usual language). */
  protected design(template: InviteTemplate, language?: InviteLanguage): InviteDesign | null {
    const d = this.demo()?.wedding;
    if (!d) return null;
    const base = d.invite ?? defaultInvite(d);
    const lang = language ?? templateMeta(template).defaultLanguage;
    return { ...defaultInvite(d, template, lang, 'traditional'), grandparents: base.grandparents, coverPhoto: template === 'minimal' ? '' : base.coverPhoto };
  }

  protected readonly heroDesign = computed(() => {
    const [t, l] = SHOWCASE[this.showcase()];
    return this.demo() ? this.design(t, l) : null;
  });
  /** A one-item list, so the invite is re-created (and animates in) when the style changes. */
  protected readonly heroList = computed(() => (this.heroDesign() ? [this.heroDesign()!] : []));
  protected readonly heroName = computed(() => templateMeta(SHOWCASE[this.showcase()][0]).name);
  protected readonly gallery = computed(() => (this.demo() ? TEMPLATES.map((t) => ({ meta: t, design: this.design(t.id)! })) : []));

  constructor() {
    void this.load();
    void ensureInviteFonts('hindi');
    void ensureInviteFonts('gujarati');
    if (!this.reduceMotion) {
      const timer = setInterval(() => this.showcase.update((i) => (i + 1) % SHOWCASE.length), 3200);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  private async load(): Promise<void> {
    const weddings = await this.repo.listWeddings();
    const rows = await Promise.all(
      weddings.map(async (wedding): Promise<PageSummary> => {
        const t = computeTotals(wedding, await this.repo.listContributions(wedding.id).catch(() => []));
        const count = (await this.repo.getPublicActivity(wedding.id).catch(() => null))?.contributors ?? 0;
        return { wedding, names: `${firstName(wedding.partner1)} & ${firstName(wedding.partner2)}`, raised: t.raised, target: t.target, percent: t.percent, count };
      }),
    );
    this.pages.set(rows);
  }
}
