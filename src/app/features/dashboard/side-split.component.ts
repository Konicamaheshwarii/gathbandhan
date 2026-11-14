import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatInr } from '../../core/format';
import { Contribution } from '../../core/models';
import { SideSplit, splitBySide } from '../../core/stats';

const LABEL: Record<SideSplit['side'], string> = { bride: "Bride's side", groom: "Groom's side", none: 'Side not given' };

/**
 * Bride's side vs groom's side as one 100% bar. Two categorical hues (validated for colour-blind
 * separation in light and dark), a neutral grey for "not given", a legend, and per-segment hover.
 */
@Component({
  selector: 'app-side-split',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" role="img" [attr.aria-label]="summary()">
      @for (s of shown(); track s.side) {
        <span class="seg" [class]="'seg ' + s.side" [style.flex-grow]="s.amount" (pointerenter)="hover.set(s)" (pointerleave)="hover.set(null)"
              [attr.title]="label[s.side] + ': ' + inr(s.amount)">
          @if (s.percent >= 12) { <b>{{ s.percent }}%</b> }
        </span>
      }
    </div>
    @if (hover(); as h) {
      <p class="tip" role="status"><strong>{{ label[h.side] }}</strong> {{ inr(h.amount) }} from {{ h.count }} {{ h.count === 1 ? 'guest' : 'guests' }}</p>
    }
    <ul class="legend">
      @for (s of split(); track s.side) {
        <li>
          <i class="sw" [class]="'sw ' + s.side" aria-hidden="true"></i>
          <span class="name">{{ label[s.side] }}</span>
          <span class="val">{{ inr(s.amount) }}</span>
          <span class="hint">{{ s.count }} · {{ s.percent }}%</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: grid; gap: 0.6rem; --bride: #a3324f; --groom: #1f6fc0; --none: #b9aaa3; }
    @media (prefers-color-scheme: dark) { :host-context(:root:not([data-theme='light'])) { --bride: #e0587a; --groom: #4f94e8; --none: #6d5a55; } }
    :host-context([data-theme='dark']) { --bride: #e0587a; --groom: #4f94e8; --none: #6d5a55; }
    .bar { display: flex; gap: 2px; height: 30px; }
    .seg { min-width: 4px; display: grid; place-items: center; color: #fff; font-size: 0.75rem; cursor: default;
      &:first-child { border-radius: 6px 0 0 6px; } &:last-child { border-radius: 0 6px 6px 0; } &:only-child { border-radius: 6px; } }
    .seg.bride, .sw.bride { background: var(--bride); }
    .seg.groom, .sw.groom { background: var(--groom); }
    .seg.none, .sw.none { background: var(--none); }
    .seg.none b { color: var(--text); }
    .tip { margin: 0; font-size: 0.85rem; }
    .legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
    .legend li { display: grid; grid-template-columns: auto 1fr auto; gap: 0 0.5rem; align-items: center; font-size: 0.9rem; }
    .legend .hint { grid-column: 2 / -1; }
    .sw { width: 12px; height: 12px; border-radius: 3px; grid-row: span 2; }
    .val { font-weight: 700; font-variant-numeric: tabular-nums; }
  `,
})
export class SideSplitComponent {
  readonly contributions = input.required<Contribution[]>();
  protected readonly label = LABEL;
  protected readonly hover = signal<SideSplit | null>(null);
  protected readonly split = computed(() => splitBySide(this.contributions()));
  protected readonly shown = computed(() => this.split().filter((s) => s.amount > 0));
  protected readonly summary = computed(() => this.split().map((s) => `${LABEL[s.side]} ${s.percent}%`).join(', '));
  protected readonly inr = formatInr;
}
