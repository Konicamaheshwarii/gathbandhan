import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CARD_PRINTED_KEY } from '../../core/stats';
import { writeJson } from '../../core/storage';
import { firstName } from '../../core/util';
import { WeddingStore } from '../../core/wedding.store';
import { IndianDatePipe } from '../../shared/pipes';
import { QrCodeComponent } from '../../shared/qr-code.component';
import { ToranComponent } from '../../shared/toran.component';

type PaperSize = 'A6' | 'A5';
const PAPER_MM: Record<PaperSize, string> = { A6: '105mm 148mm', A5: '148mm 210mm' };

/** Printable card for the shagun table at the venue: guests scan it to open the wedding page. */
@Component({
  selector: 'app-card',
  imports: [RouterLink, QrCodeComponent, ToranComponent, IndianDatePipe],
  providers: [WeddingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card.page.html',
  styleUrl: './card.page.scss',
})
export class CardPage {
  protected readonly store = inject(WeddingStore);
  private readonly document = inject(DOCUMENT);

  readonly slug = input.required<string>();

  protected readonly sizes: PaperSize[] = ['A6', 'A5'];
  protected readonly size = signal<PaperSize>('A6');
  protected readonly names = computed(() => {
    const w = this.store.wedding();
    return w ? `${firstName(w.partner1)} & ${firstName(w.partner2)}` : '';
  });

  constructor() {
    effect(() => void this.store.load(this.slug()));

    // @page cannot be bound from a template, so the page size lives in a <style> we own.
    const style = this.document.createElement('style');
    this.document.head.appendChild(style);
    inject(DestroyRef).onDestroy(() => style.remove());
    // Explicit millimetres: Chrome does not recognise the A6 keyword.
    effect(() => {
      style.textContent = `@page { size: ${PAPER_MM[this.size()]}; margin: 0; }`;
    });
  }

  protected print(): void {
    const w = this.store.wedding();
    if (w) writeJson(CARD_PRINTED_KEY(w.id), true); // ticks "venue card printed" on the dashboard checklist
    globalThis.print?.();
  }
}
