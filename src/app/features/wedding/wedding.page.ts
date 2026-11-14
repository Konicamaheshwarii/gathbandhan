import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { daysUntil } from '../../core/format';
import { inviteMessage, whatsappUrl } from '../../core/share';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { copyText } from '../../shared/clipboard';
import { IndianDatePipe, InrPipe, TimeAgoPipe } from '../../shared/pipes';
import { ToastService } from '../../shared/toast.service';
import { ToranComponent } from '../../shared/toran.component';
import { EventsTimelineComponent } from './events-timeline.component';
import { GalleryComponent } from './gallery.component';
import { StoryTimelineComponent } from './story-timeline.component';

const WALL_PAGE = 6;

@Component({
  selector: 'app-wedding',
  imports: [RouterLink, InrPipe, IndianDatePipe, TimeAgoPipe, ToranComponent, EventsTimelineComponent, StoryTimelineComponent, GalleryComponent],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wedding.page.html',
  styleUrl: './wedding.page.scss',
})
export class WeddingPage {
  protected readonly store = inject(WeddingStore);
  private readonly toast = inject(ToastService);

  /** Route param and the optional `d` query param (wedding carried in the link). */
  readonly slug = input.required<string>();
  readonly d = input<string>();

  protected readonly wallLimit = signal(WALL_PAGE);
  protected readonly canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  protected readonly names = computed(() => {
    const w = this.store.wedding();
    return w ? { a: firstName(w.partner1), b: firstName(w.partner2) } : { a: '', b: '' };
  });
  protected readonly countdown = computed(() => {
    const w = this.store.wedding();
    if (!w) return '';
    const days = daysUntil(w.date);
    if (Number.isNaN(days)) return '';
    if (days > 1) return `${days} days to go`;
    if (days === 1) return 'Tomorrow!';
    if (days === 0) return 'Today!';
    return 'Just married';
  });
  protected readonly goalTitles = computed(
    () => new Map((this.store.wedding()?.goals ?? []).map((g) => [g.id, `${g.emoji} ${g.title}`])),
  );
  protected readonly sideLabel = (side?: string) => (side === 'bride' ? "Bride's side" : side === 'groom' ? "Groom's side" : '');
  protected readonly wall = computed(() => this.store.blessings().slice(0, this.wallLimit()));
  protected readonly whatsapp = computed(() => {
    const w = this.store.wedding();
    const t = this.store.totals();
    return w && t ? whatsappUrl(inviteMessage(w, this.store.shareUrl(), t.target)) : '';
  });

  constructor() {
    effect(() => void this.store.load(this.slug(), { payload: this.d() }));
  }

  protected async copyLink(): Promise<void> {
    const ok = await copyText(this.store.shareUrl());
    this.toast.show(ok ? 'Link copied. Paste it in your family group!' : 'Could not copy. Long-press the address bar instead.');
  }

  protected async nativeShare(): Promise<void> {
    const w = this.store.wedding();
    const t = this.store.totals();
    if (!w || !t) return;
    try {
      await navigator.share({ title: `${this.names().a} & ${this.names().b}`, text: inviteMessage(w, '', t.target).trim(), url: this.store.shareUrl() });
    } catch {
      // the guest closed the share sheet
    }
  }

  protected showMore(): void {
    this.wallLimit.update((n) => n + WALL_PAGE * 2);
  }
}
