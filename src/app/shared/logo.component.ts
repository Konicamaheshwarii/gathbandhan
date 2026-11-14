import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The Gathbandhan mark: a maroon thread and a gold thread tied into one knot, in the shape of a heart.
 * The small gaps where one thread passes over the other take the colour of `--knot-case`
 * (the page background by default), so set it on surfaces that are not `--bg`.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'logo', '[class.with-name]': 'wordmark()' },
  template: `
    <svg viewBox="4 5 56 57" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5.5">
        <path class="m" d="M32 23.5C31.5 14 26.5 8.5 19.5 8.5C12 8.5 7 14 7 21C7 28 25 32 32 37C35.5 39.5 37.5 41 37.5 44C37.5 47 35.5 48.5 32 51C28.5 53.5 25 56 21.5 58.5" />
        <path class="g" d="M32 23.5C32.5 14 37.5 8.5 44.5 8.5C52 8.5 57 14 57 21C57 28 39 32 32 37C28.5 39.5 26.5 41 26.5 44C26.5 47 28.5 48.5 32 51C35.5 53.5 39 56 42.5 58.5" />
        <path class="case" stroke-width="9.9" stroke-linecap="butt" d="M27.47 34.45C29.21 35.28 30.78 36.13 32 37C33.73 38.24 35.1 39.23 36.03 40.28" />
        <path class="m" d="M27.47 34.45C29.21 35.28 30.78 36.13 32 37C33.73 38.24 35.1 39.23 36.03 40.28" />
        <path class="case" stroke-width="9.9" stroke-linecap="butt" d="M27.94 47.69C28.88 48.75 30.25 49.75 32 51C33.41 52.01 34.82 53.01 36.23 54.02" />
        <path class="g" d="M27.94 47.69C28.88 48.75 30.25 49.75 32 51C33.41 52.01 34.82 53.01 36.23 54.02" />
      </g>
    </svg>
    @if (wordmark()) { <span class="name">Gathbandhan</span> }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 0.4em; line-height: 1; vertical-align: middle; }
    svg { display: block; flex: none; overflow: visible; }
    .m { stroke: var(--knot-red, #8a1c3b); }
    .g { stroke: var(--knot-gold, #c9a227); }
    .case { stroke: var(--knot-case, var(--bg, #fbf5ec)); }
    .name { font: 600 1em/1 var(--font-display); color: var(--text); letter-spacing: -0.01em; }
  `,
})
export class LogoComponent {
  /** Pixel size of the mark. */
  readonly size = input(28);
  /** Show "Gathbandhan" next to the mark. */
  readonly wordmark = input(false);
}
