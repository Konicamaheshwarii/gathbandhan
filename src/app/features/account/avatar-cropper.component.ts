import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';

/** Avatars are stored as a square JPEG of this size, made on the device. */
export const AVATAR_SIZE = 256;
/** Size of the round crop window on screen. */
export const CROP_VIEW = 220;

export interface CropState {
  /** 1 = the photo just covers the circle; up to 3x. */
  zoom: number;
  /** Pan in screen pixels from the centre. */
  x: number;
  y: number;
}

/** Keeps the photo covering the whole crop window. */
export function clampCrop(w: number, h: number, s: CropState, view = CROP_VIEW): CropState {
  const zoom = Math.min(3, Math.max(1, s.zoom));
  const scale = (view / Math.min(w, h)) * zoom;
  const maxX = Math.max(0, (w * scale - view) / 2);
  const maxY = Math.max(0, (h * scale - view) / 2);
  return { zoom, x: Math.min(maxX, Math.max(-maxX, s.x)), y: Math.min(maxY, Math.max(-maxY, s.y)) };
}

/** The square of the source image (in its own pixels) that the crop window shows. */
export function cropSource(w: number, h: number, state: CropState, view = CROP_VIEW): { sx: number; sy: number; size: number } {
  const s = clampCrop(w, h, state, view);
  const scale = (view / Math.min(w, h)) * s.zoom;
  const size = view / scale;
  return { sx: (w * scale / 2 - view / 2 - s.x) / scale, sy: (h * scale / 2 - view / 2 - s.y) / scale, size };
}

/**
 * Pick a photo, then drag and zoom it inside a circle. Only the cropped 256px JPEG leaves this
 * component; the original file is never stored or uploaded.
 */
@Component({
  selector: 'app-avatar-cropper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as s) {
      <div class="cropper" role="group" aria-label="Crop your photo">
        <div class="window" #win [style.width.px]="view" [style.height.px]="view"
             (pointerdown)="grab($event)" (pointermove)="drag($event)" (pointerup)="drop()" (pointercancel)="drop()"
             (wheel)="wheel($event)" (keydown)="key($event)" tabindex="0" aria-label="Photo position: drag, or use the arrow keys">
          <img [src]="s" alt="" draggable="false" [style.width.px]="dims().w" [style.height.px]="dims().h"
               [style.transform]="'translate(-50%, -50%) translate(' + crop().x + 'px, ' + crop().y + 'px)'" />
          <span class="ring" aria-hidden="true"></span>
        </div>
        <label class="zoom">
          <span class="sr-only">Zoom</span>
          <span aria-hidden="true" class="z-ico">−</span>
          <input type="range" min="1" max="3" step="0.01" [value]="crop().zoom" (input)="setZoom(+$any($event.target).value)" aria-label="Zoom" />
          <span aria-hidden="true" class="z-ico">+</span>
        </label>
        <p class="hint center">Drag to move · zoom to fit your face in the circle</p>
        <div class="actions">
          <button type="button" class="btn primary" (click)="use()" [disabled]="busy()">
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> Saving… } @else { Use this photo }
          </button>
          <button type="button" class="btn ghost" (click)="cancel()" [disabled]="busy()">Cancel</button>
        </div>
      </div>
    }
  `,
  styles: `
    .cropper { display: grid; justify-items: center; gap: 0.7rem; padding: 0.9rem; border-radius: 18px; background: var(--surface-2); }
    .window {
      position: relative;
      overflow: hidden;
      border-radius: 50%;
      touch-action: none;
      cursor: grab;
      background: #1c0e0e;
      box-shadow: 0 0 0 4px var(--surface), 0 0 0 6px color-mix(in srgb, var(--gold) 60%, transparent), 0 10px 30px rgb(0 0 0 / 25%);
      &:active { cursor: grabbing; }
      &:focus-visible { outline: 3px solid var(--accent); outline-offset: 6px; }
    }
    img { position: absolute; left: 50%; top: 50%; max-width: none; user-select: none; pointer-events: none; }
    .zoom { display: flex; align-items: center; gap: 0.6rem; width: min(260px, 100%); font-weight: 600; }
    .zoom input { flex: 1; accent-color: var(--accent); min-height: 32px; }
    .z-ico { color: var(--muted); font-size: 1.2rem; width: 1ch; text-align: center; }
    .hint { margin: 0; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
  `,
})
export class AvatarCropperComponent {
  /** The picked image file. */
  readonly file = input<File | null>(null);
  readonly busy = input(false);
  readonly cropped = output<string>();
  readonly cancelled = output<void>();
  /** The file could not be read as an image. */
  readonly failed = output<string>();

  protected readonly src = signal<string | null>(null);

  protected readonly view = CROP_VIEW;
  protected readonly crop = signal<CropState>({ zoom: 1, x: 0, y: 0 });
  protected readonly dims = signal({ w: CROP_VIEW, h: CROP_VIEW });
  private natural = { w: 1, h: 1 };
  private image: HTMLImageElement | null = null;
  private start: { px: number; py: number; x: number; y: number } | null = null;
  private readonly win = viewChild<ElementRef<HTMLElement>>('win');

  constructor() {
    effect(() => {
      const file = this.file();
      untracked(() => void this.prepare(file));
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private async prepare(file: File | null): Promise<void> {
    this.release();
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.failed.emit('Please choose an image file.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      this.failed.emit('That photo could not be opened. Try a JPEG or PNG.');
      return;
    }
    this.src.set(url);
    this.image = img;
    this.natural = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
    this.crop.set({ zoom: 1, x: 0, y: 0 });
    this.resize();
    queueMicrotask(() => this.win()?.nativeElement.focus());
  }

  protected setZoom(zoom: number): void {
    this.crop.set(clampCrop(this.natural.w, this.natural.h, { ...this.crop(), zoom }));
    this.resize();
  }

  protected grab(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.start = { px: e.clientX, py: e.clientY, x: this.crop().x, y: this.crop().y };
  }

  protected drag(e: PointerEvent): void {
    if (!this.start) return;
    const { px, py, x, y } = this.start;
    this.crop.set(clampCrop(this.natural.w, this.natural.h, { ...this.crop(), x: x + e.clientX - px, y: y + e.clientY - py }));
  }

  protected drop(): void {
    this.start = null;
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.crop().zoom - e.deltaY / 500);
  }

  protected key(e: KeyboardEvent): void {
    const step = e.shiftKey ? 20 : 6;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      this.crop.set(clampCrop(this.natural.w, this.natural.h, { ...this.crop(), x: this.crop().x + dx, y: this.crop().y + dy }));
    } else if (e.key === '+' || e.key === '=') this.setZoom(this.crop().zoom + 0.1);
    else if (e.key === '-') this.setZoom(this.crop().zoom - 0.1);
  }

  protected use(): void {
    if (!this.image) return;
    const { sx, sy, size } = cropSource(this.natural.w, this.natural.h, this.crop());
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.image, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    this.cropped.emit(canvas.toDataURL('image/jpeg', 0.86));
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  private release(): void {
    const url = this.src();
    if (url) URL.revokeObjectURL(url);
    this.src.set(null);
    this.image = null;
  }

  private resize(): void {
    const scale = (CROP_VIEW / Math.min(this.natural.w, this.natural.h)) * this.crop().zoom;
    this.dims.set({ w: this.natural.w * scale, h: this.natural.h * scale });
  }
}
