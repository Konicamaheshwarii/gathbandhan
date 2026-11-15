import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, Directive, InjectionToken, TemplateRef, computed, contentChild, effect, inject, input, model, signal,
} from '@angular/core';

/** Whether the visitor asked for less motion. A token, so tests can switch it. */
export const REDUCED_MOTION = new InjectionToken<boolean>('REDUCED_MOTION', {
  providedIn: 'root',
  factory: () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

/** Marks the template the slider stamps out for each slide: `<ng-template appSlide let-i>`. */
@Directive({ selector: 'ng-template[appSlide]' })
export class SlideDirective {
  readonly template = inject<TemplateRef<{ $implicit: number; active: boolean }>>(TemplateRef);
}

const SWIPE_PX = 40;
/** How long autoplay waits after a touch before it starts again. */
const TOUCH_RESUME_MS = 6000;

/**
 * A centred slider: the active slide large in the middle with its neighbours peeking, scaled down
 * and faded. Arrow buttons, dots, swipe and drag, arrow keys, and gentle autoplay that pauses on
 * hover, focus and touch (and never runs when reduced motion is asked for). Written with signals and
 * CSS transforms; follows the WAI-ARIA carousel pattern.
 */
@Component({
  selector: 'app-slider',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    'aria-roledescription': 'carousel',
    '[attr.aria-label]': 'label()',
    '[class.reduced]': 'reducedMotion',
    '[class.dragging]': 'dragging()',
    '(keydown)': 'onKey($event)',
    '(mouseenter)': 'hover.set(true)',
    '(mouseleave)': 'hover.set(false)',
    '(focusin)': 'focused.set(true)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <div class="viewport" tabindex="0" [attr.aria-label]="label() + '. Use the left and right arrow keys to browse.'"
         (pointerdown)="onDown($event)" (pointermove)="onMove($event)" (pointerup)="onUp($event)" (pointercancel)="onUp($event)">
      <div class="track">
        @for (i of slides(); track i) {
          @let o = offset(i);
          <div class="slide" role="group" aria-roledescription="slide" [class.active]="o === 0"
               [attr.aria-label]="slideLabel(i)" [attr.aria-hidden]="o !== 0 ? 'true' : null" [attr.inert]="o !== 0 ? '' : null"
               [style.transform]="transform(o)" [style.opacity]="opacity(o)" [style.z-index]="10 - abs(o)"
               (click)="onSlideClick(i)">
            <ng-container [ngTemplateOutlet]="slide().template" [ngTemplateOutletContext]="{ $implicit: i, active: o === 0 }" />
          </div>
        }
      </div>
      <button class="arrow prev" type="button" (click)="prev()" [attr.aria-label]="'Previous: ' + slideName(index() - 1)"><span aria-hidden="true">‹</span></button>
      <button class="arrow next" type="button" (click)="next()" [attr.aria-label]="'Next: ' + slideName(index() + 1)"><span aria-hidden="true">›</span></button>
    </div>
    <div class="controls">
      @if (autoplay()) {
        <button class="play" type="button" (click)="playing.set(!playing())" [attr.aria-label]="playing() ? 'Pause the slideshow' : 'Play the slideshow'">
          <span aria-hidden="true">{{ playing() ? '❚❚' : '▶' }}</span>
        </button>
      }
      <div class="dots" role="group" aria-label="Choose a slide">
        @for (i of slides(); track i) {
          <button class="dot" type="button" (click)="go(i)" [attr.aria-label]="slideName(i)" [attr.aria-current]="i === index() ? 'true' : null"></button>
        }
      </div>
    </div>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ live() }}</p>
    <ng-content />
  `,
  styleUrl: './slider.component.scss',
})
export class SliderComponent {
  readonly count = input.required<number>();
  /** Accessible name of each slide, such as the style name. */
  readonly labels = input<string[]>([]);
  readonly label = input('Slides');
  /** Autoplay step in ms; 0 turns autoplay off. */
  readonly interval = input(5000);
  readonly index = model(0);

  protected readonly slide = contentChild.required(SlideDirective);
  protected readonly reducedMotion = inject(REDUCED_MOTION);

  readonly hover = signal(false);
  readonly focused = signal(false);
  readonly touching = signal(false);
  /** The visitor's play / pause button. */
  readonly playing = signal(true);
  readonly autoplay = computed(() => this.interval() > 0 && !this.reducedMotion && this.count() > 1);
  readonly paused = computed(() => this.hover() || this.focused() || this.touching() || !this.playing());

  protected readonly slides = computed(() => Array.from({ length: this.count() }, (_, i) => i));
  protected readonly dragX = signal(0);
  protected readonly dragging = signal(false);
  /** Announced only for moves the visitor made, so autoplay stays quiet. */
  protected readonly live = signal('');

  private start: { x: number; y: number; id: number; touch: boolean } | null = null;
  private suppressClick = false;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect((onCleanup) => {
      if (!this.autoplay() || this.paused()) return;
      const timer = setInterval(() => this.go(this.index() + 1, false), this.interval());
      onCleanup(() => clearInterval(timer));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.resumeTimer));
  }

  next(): void {
    this.go(this.index() + 1);
  }

  prev(): void {
    this.go(this.index() - 1);
  }

  /** Moves to slide i, wrapping around at both ends. */
  go(i: number, byUser = true): void {
    const n = this.count();
    if (!n) return;
    const j = ((i % n) + n) % n;
    this.index.set(j);
    if (byUser) this.live.set(`${this.slideName(j)}, ${j + 1} of ${n}`);
  }

  /** Signed distance from the active slide, the short way round. */
  offset(i: number): number {
    const n = this.count();
    let o = i - this.index();
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  }

  protected abs = Math.abs;

  protected slideName(i: number): string {
    const n = this.count();
    const j = ((i % n) + n) % n;
    return this.labels()[j] ?? `Slide ${j + 1}`;
  }

  protected slideLabel(i: number): string {
    return `${this.slideName(i)} (${i + 1} of ${this.count()})`;
  }

  protected transform(o: number): string {
    const a = Math.abs(o);
    const shift = a === 0 ? 0 : a === 1 ? 92 : a === 2 ? 168 : 230;
    const scale = a === 0 ? 1 : a === 1 ? 0.8 : 0.64;
    const x = `calc(${Math.sign(o) * shift}% + ${this.dragX()}px)`;
    return `translateX(${x}) scale(${scale})`;
  }

  protected opacity(o: number): number {
    const a = Math.abs(o);
    return a === 0 ? 1 : a === 1 ? 0.6 : a === 2 ? 0.25 : 0;
  }

  protected onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
    const moves: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.prev(),
      Home: () => this.go(0),
      End: () => this.go(this.count() - 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    move();
  }

  protected onFocusOut(e: FocusEvent): void {
    const host = e.currentTarget as HTMLElement | null;
    if (!host || !host.contains(e.relatedTarget as Node | null)) this.focused.set(false);
  }

  protected onDown(e: PointerEvent): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    this.start = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse' };
    this.suppressClick = false;
    if (this.start.touch) {
      clearTimeout(this.resumeTimer);
      this.touching.set(true);
    }
  }

  protected onMove(e: PointerEvent): void {
    if (!this.start || e.pointerId !== this.start.id) return;
    const dx = e.clientX - this.start.x;
    if (!this.dragging() && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - this.start.y)) {
      this.dragging.set(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (this.dragging()) this.dragX.set(dx);
  }

  protected onUp(e: PointerEvent): void {
    if (!this.start || e.pointerId !== this.start.id) return;
    const dx = e.clientX - this.start.x;
    const touch = this.start.touch;
    if (this.dragging()) {
      this.suppressClick = true;
      if (dx <= -SWIPE_PX) this.next();
      else if (dx >= SWIPE_PX) this.prev();
    }
    this.start = null;
    this.dragging.set(false);
    this.dragX.set(0);
    if (touch) this.resumeTimer = setTimeout(() => this.touching.set(false), TOUCH_RESUME_MS);
  }

  /** Tapping a neighbour brings it to the middle. */
  protected onSlideClick(i: number): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (this.offset(i) !== 0) this.go(i);
  }
}
