import { ChangeDetectionStrategy, Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { GalleryPhoto } from '../../core/models';

/** A small photo grid; tapping a photo opens it in a native <dialog>. */
@Component({
  selector: 'app-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" [class.few]="photos().length === 2 || photos().length === 4">
      @for (p of photos(); track p.id; let i = $index) {
        <button type="button" class="photo" [class.wide]="i === 0 && (photos().length === 3 || photos().length === 6)" (click)="open(p)"
                [attr.aria-label]="'Open photo: ' + (p.caption || 'photo ' + (i + 1))">
          <img [src]="p.url" [alt]="p.caption ?? ''" loading="lazy" decoding="async" />
        </button>
      }
    </div>
    <dialog #dialog class="viewer" (click)="close()">
      @if (current(); as p) {
        <img [src]="p.url" [alt]="p.caption ?? ''" />
        @if (p.caption) { <p>{{ p.caption }}</p> }
        <button class="btn small" type="button" (click)="close()">Close</button>
      }
    </dialog>
  `,
  styles: `
    .grid { display: grid; gap: 0.5rem; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 0.75rem; }
    .grid.few { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }
    .photo { padding: 0; border: 0; border-radius: 14px; overflow: hidden; cursor: zoom-in; aspect-ratio: 1; background: var(--surface-2); }
    .photo.wide { grid-column: span 2; grid-row: span 2; }
    .photo img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
    .photo:hover img { transform: scale(1.03); }
    .photo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .viewer { border: 0; border-radius: 18px; padding: 0.75rem; max-width: min(92vw, 720px); background: var(--surface); color: var(--text); text-align: center; }
    .viewer::backdrop { background: rgb(20 5 5 / 75%); }
    .viewer img { max-height: 70vh; border-radius: 12px; display: block; margin: 0 auto 0.5rem; }
    .viewer p { margin: 0 0 0.5rem; }
  `,
})
export class GalleryComponent {
  readonly photos = input.required<GalleryPhoto[]>();
  protected readonly current = signal<GalleryPhoto | null>(null);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected open(p: GalleryPhoto): void {
    this.current.set(p);
    this.dialog().nativeElement.showModal?.();
  }

  protected close(): void {
    this.dialog().nativeElement.close?.();
  }
}
