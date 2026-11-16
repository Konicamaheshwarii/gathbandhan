import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatInr, formatInrShort } from '../../core/format';
import { Contribution } from '../../core/models';
import { DayPoint, cumulativeByDay } from '../../core/stats';

const W = 600;
const H = 200;
const PAD = { top: 14, right: 12, bottom: 24, left: 48 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (ms: number) => `${new Date(ms).getDate()} ${MONTHS[new Date(ms).getMonth()]}`;

/** Shagun so far, day by day: one series (no legend), a crosshair tooltip and a table view. */
@Component({
  selector: 'app-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (pointerleave)="leave($event)">
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" role="img"
           [attr.aria-label]="'Shagun over the last ' + days() + ' days, now ' + total()" (pointermove)="move($event)" (pointerdown)="move($event)">
        @for (t of ticks(); track t.v) {
          <line class="grid" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" />
        }
        <path class="area" [attr.d]="area()" />
        <path class="line" [attr.d]="line()" />
        @if (hover(); as p) {
          <line class="cross" [attr.x1]="x(p.i)" [attr.x2]="x(p.i)" [attr.y1]="pad.top" [attr.y2]="h - pad.bottom" />
        }
      </svg>
      <div class="axis-y" aria-hidden="true">
        @for (t of ticks(); track t.v) { <span [style.top.%]="(t.y / h) * 100">{{ short(t.v) }}</span> }
      </div>
      <div class="axis-x" aria-hidden="true">
        <span>{{ first() }}</span><span>{{ last() }}</span>
      </div>
      @if (hover(); as p) {
        <span class="dot" aria-hidden="true" [style.left.%]="(x(p.i) / w) * 100" [style.top.px]="y(p.point.total)"></span>
        <div class="tip" [style.left.%]="(x(p.i) / w) * 100" [class.flip]="p.i > points().length * 0.6" role="status">
          <strong>{{ label(p.point.day) }}</strong>
          <span>{{ inr(p.point.total) }} so far</span>
          @if (p.point.amount) { <span class="muted">+{{ inr(p.point.amount) }} that day</span> }
        </div>
      }
    </div>
    <details class="table">
      <summary>Show as a table</summary>
      <table>
        <thead><tr><th scope="col">Day</th><th scope="col">Given</th><th scope="col">Total</th></tr></thead>
        <tbody>
          @for (p of givingDays(); track p.day) { <tr><td>{{ label(p.day) }}</td><td>{{ inr(p.amount) }}</td><td>{{ inr(p.total) }}</td></tr> }
        </tbody>
      </table>
    </details>
  `,
  styles: `
    :host { display: block; --line: #d9730b; --fill: rgb(239 154 18 / 16%); }
    @media (prefers-color-scheme: dark) { :host-context(:root:not([data-theme='light'])) { --line: #f2a93b; --fill: rgb(242 169 59 / 18%); } }
    :host-context([data-theme='dark']) { --line: #f2a93b; --fill: rgb(242 169 59 / 18%); }
    .chart { position: relative; padding-left: 0; }
    svg { display: block; width: 100%; height: 200px; touch-action: pan-y; cursor: crosshair; }
    .grid { stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .area { fill: var(--fill); }
    .line { fill: none; stroke: var(--line); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .cross { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
    .dot { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--line); box-shadow: 0 0 0 2px var(--surface); pointer-events: none; }
    .axis-y { position: absolute; top: 0; left: 0; height: 200px; width: 46px; pointer-events: none;
      span { position: absolute; left: 0; transform: translateY(-50%); font-size: 0.72rem; color: var(--muted); } }
    .axis-x { display: flex; justify-content: space-between; padding-left: 48px; font-size: 0.72rem; color: var(--muted); }
    .tip { position: absolute; top: 4px; transform: translateX(10px); background: var(--surface); border: 1px solid var(--border);
      box-shadow: var(--shadow); border-radius: 10px; padding: 0.35rem 0.6rem; display: grid; font-size: 0.8rem; white-space: nowrap; pointer-events: none;
      &.flip { transform: translateX(calc(-100% - 10px)); } .muted { color: var(--muted); } }
    .table summary { cursor: pointer; font-size: 0.82rem; color: var(--accent); font-weight: 600; margin-top: 0.4rem; min-height: 32px; display: flex; align-items: center; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; th, td { text-align: left; padding: 0.25rem 0.4rem; border-bottom: 1px solid var(--border); } td:not(:first-child), th:not(:first-child) { text-align: right; } }
  `,
})
export class TrendChartComponent {
  readonly contributions = input.required<Contribution[]>();
  readonly days = input(30);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly hover = signal<{ i: number; point: DayPoint } | null>(null);

  protected readonly points = computed(() => cumulativeByDay(this.contributions(), this.days()));
  private readonly max = computed(() => {
    const top = Math.max(1, ...this.points().map((p) => p.total));
    const step = 10 ** Math.floor(Math.log10(top));
    return Math.ceil(top / step) * step;
  });
  protected readonly ticks = computed(() => [0, 0.5, 1].map((f) => ({ v: Math.round(this.max() * f), y: this.y(this.max() * f) })));
  protected readonly line = computed(() => this.points().map((p, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(p.total).toFixed(1)}`).join(''));
  protected readonly area = computed(() => {
    const n = this.points().length;
    return n ? `${this.line()}L${this.x(n - 1)},${H - PAD.bottom}L${this.x(0)},${H - PAD.bottom}Z` : '';
  });
  protected readonly total = computed(() => formatInr(this.points().at(-1)?.total ?? 0));
  protected readonly first = computed(() => (this.points().length ? dayLabel(this.points()[0].day) : ''));
  protected readonly last = computed(() => (this.points().length ? dayLabel(this.points().at(-1)!.day) : ''));
  protected readonly givingDays = computed(() => this.points().filter((p) => p.amount > 0).reverse());

  protected readonly short = formatInrShort;
  protected readonly inr = formatInr;
  protected readonly label = dayLabel;

  x(i: number): number {
    const n = Math.max(1, this.points().length - 1);
    return PAD.left + (i / n) * (W - PAD.left - PAD.right);
  }

  y(v: number): number {
    return PAD.top + (1 - v / this.max()) * (H - PAD.top - PAD.bottom);
  }

  /**
   * A mouse leaving hides the tooltip. A finger "leaves" as soon as it lifts, so on phones the
   * tooltip stays on the tapped day until another tap (otherwise it would vanish at once).
   */
  protected leave(e: PointerEvent): void {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') this.hover.set(null);
  }

  protected move(e: PointerEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const n = this.points().length;
    const i = Math.max(0, Math.min(n - 1, Math.round(((vx - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1))));
    if (n) this.hover.set({ i, point: this.points()[i] });
  }
}
