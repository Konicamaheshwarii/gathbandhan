import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, signal, untracked, viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { sortEvents, weddingIcs } from '../../core/calendar';
import { downloadText } from '../../core/csv';
import { WeddingRepository } from '../../core/data/wedding.repository';
import { inviteUrl, isGuestToken, rememberGuestToken } from '../../core/guests';
import { defaultInvite, invitePages, migrateInvite, templateMeta } from '../../core/invite';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { appBaseUrl, weddingUrl } from '../../core/wedding-link';
import { copyText } from '../../shared/clipboard';
import { ensureInviteFonts } from '../../shared/invite-fonts';
import { Shehnai } from '../../shared/shehnai';
import { ToastService } from '../../shared/toast.service';
import { InvitePageComponent } from './invite-page.component';

/**
 * The invite guests open from WhatsApp: pages that turn in as you scroll, with RSVP, shagun,
 * calendar and share always at hand. `#/i/:slug/:token` greets one guest by name.
 */
@Component({
  selector: 'app-invite-view',
  imports: [RouterLink, InvitePageComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-view.page.html',
  styleUrl: './invite-view.page.scss',
})
export class InviteViewPage {
  protected readonly store = inject(WeddingStore);
  private readonly repo = inject(WeddingRepository);
  private readonly toast = inject(ToastService);
  private readonly shehnai = new Shehnai();

  readonly slug = input.required<string>();
  readonly token = input<string>();

  protected readonly greeting = signal<string | null>(null);
  protected readonly music = signal(false);
  protected readonly design = computed(() => {
    const w = this.store.wedding();
    return w ? (w.invite ? migrateInvite(w.invite) : defaultInvite(w)) : null;
  });
  protected readonly pages = computed(() => {
    const w = this.store.wedding();
    const d = this.design();
    return w && d ? invitePages(w, d) : [];
  });
  protected readonly couple = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });
  protected readonly rsvpUrl = computed(() => `${appBaseUrl()}#/w/${this.slug()}/rsvp`);
  protected readonly giveUrl = computed(() => `${appBaseUrl()}#/w/${this.slug()}/give`);
  protected readonly backdrop = computed(() => {
    const d = this.design();
    return d ? `linear-gradient(180deg, ${d.palette.primary} 0%, color-mix(in srgb, ${d.palette.primary} 55%, #120606) 100%)` : '';
  });
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  private readonly sheets = viewChildren<ElementRef<HTMLElement>>('sheet');

  constructor() {
    effect(() => {
      const slug = this.slug();
      const token = this.token();
      untracked(() => void this.open(slug, token));
    });
    effect(() => {
      const d = this.design();
      if (d) void ensureInviteFonts(d.language, d.template);
    });
    // Pages "turn in" as they scroll into view.
    afterRenderEffect(() => {
      const sheets = this.sheets().map((s) => s.nativeElement);
      if (!sheets.length || typeof IntersectionObserver === 'undefined') {
        sheets.forEach((s) => s.classList.add('in'));
        return;
      }
      const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.25 });
      sheets.forEach((s) => io.observe(s));
      return () => io.disconnect();
    });
    inject(DestroyRef).onDestroy(() => this.shehnai.stop());
  }

  private async open(slug: string, token?: string): Promise<void> {
    const w = await this.store.load(slug);
    if (!w || !isGuestToken(token)) return;
    try {
      const invite = await this.repo.getGuestInvite(w.id, token);
      if (!invite) return;
      this.greeting.set(invite.greeting);
      rememberGuestToken(w.id, token);
      await this.repo.markGuest(w.id, token, 'opened');
    } catch {
      // The invite still works without the personal greeting.
    }
  }

  protected toggleMusic(): void {
    if (this.shehnai.playing) this.shehnai.stop();
    else this.shehnai.start();
    this.music.set(this.shehnai.playing);
  }

  protected addToCalendar(): void {
    const w = this.store.wedding();
    if (!w) return;
    const events = sortEvents(w.events);
    const list = events.length ? events : [{ id: 'wedding', kind: 'wedding' as const, name: 'Wedding', date: w.date, time: '18:00', venue: w.venue, address: w.city }];
    downloadText(`${w.slug}.ics`, weddingIcs(w, list, weddingUrl(w.slug)), 'text/calendar;charset=utf-8');
  }

  protected async share(): Promise<void> {
    const w = this.store.wedding();
    if (!w) return;
    const url = inviteUrl(w.slug);
    if (this.canShare) {
      try {
        await navigator.share({ title: `${this.couple()}: ${templateMeta(this.design()!.template).name}`, url });
        return;
      } catch {
        return; // closed the share sheet
      }
    }
    this.toast.show((await copyText(url)) ? 'Invite link copied' : 'Could not copy the link');
  }
}
