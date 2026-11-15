import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { mixHex } from '../../core/invite';
import { InvitePalette, InviteTemplate } from '../../core/models';
import { cuspedArch, diamond, diamonds, gopuramTiers, ring, spread } from './invite-art';

let uid = 0;

const CORNERS = [
  { id: 'tl', t: '' },
  { id: 'tr', t: 'translate(900 0) scale(-1 1)' },
  { id: 'bl', t: 'translate(0 1600) scale(1 -1)' },
  { id: 'br', t: 'translate(900 1600) scale(-1 -1)' },
];

/**
 * The full-page artwork behind each invite page: frames, borders, patterns and the big scenery
 * (doorway, gopuram, scroll, mandala, phulkari bands). Original SVG drawn in code on a 900 x 1600
 * canvas. Colours are real values from the palette, not CSS variables, so PNG and PDF exports match.
 */
@Component({
  selector: 'app-invite-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-art.component.html',
  styles: `:host { position: absolute; inset: 0; display: block; pointer-events: none; } svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }`,
})
export class InviteArtComponent {
  readonly template = input.required<InviteTemplate>();
  readonly kind = input<'cover' | 'inner'>('cover');
  readonly palette = input.required<InvitePalette>();

  /** Unique ids for gradients and patterns: many pages share one document. */
  protected readonly id = `ia${++uid}`;
  protected url(name: string): string {
    return `url(#${this.id}-${name})`;
  }

  protected readonly corners = CORNERS;
  protected readonly c = computed(() => {
    const { primary, accent, paper } = this.palette();
    return {
      p: primary, a: accent, paper,
      pDark: mixHex(primary, '#000000', 0.35),
      pLight: mixHex(primary, '#ffffff', 0.3),
      pSoft: mixHex(primary, paper, 0.82),
      aSoft: mixHex(accent, paper, 0.6),
      aDark: mixHex(accent, '#000000', 0.25),
    };
  });
  protected readonly cover = computed(() => this.kind() === 'cover');

  // ----- Rajasthani doorway -----
  protected readonly door = computed(() => {
    const cover = this.cover();
    const spring = cover ? 560 : 400;
    const peak = cover ? 160 : 120;
    return [0, 18, 30, 46].map((inset) => cuspedArch(78 + inset, 822 - inset, spring, peak + inset, 1640));
  });
  protected readonly toran = spread(28, 872, 15);
  protected readonly wallFlowers = ring(4);

  // ----- Gujarati -----
  protected readonly mirrorsY = spread(250, 1360, 6);
  protected readonly mirrorsX = spread(220, 680, 3);
  protected readonly petals8 = ring(8);
  protected readonly kalashLeaves = [-64, -32, 0, 32, 64];

  // ----- South Indian -----
  protected readonly teeth = Array.from({ length: 37 }, (_, i) => i * 44);
  protected readonly thoranam = spread(100, 800, 20);
  protected readonly gopuram = computed(() => (this.cover() ? gopuramTiers(450, 470, 360, 330) : gopuramTiers(450, 230, 170, 190, 5)));
  protected readonly niches = (x1: number, x2: number) => spread(x1 + (x2 - x1) * 0.14, x2 - (x2 - x1) * 0.14, Math.max(3, Math.round((x2 - x1) / 48)));
  protected readonly bandTeeth = Array.from({ length: 33 }, (_, i) => 100 + i * 22);
  protected readonly kolam = (() => {
    const pts: { x: number; y: number }[] = [];
    for (const [row, n] of [[0, 3], [1, 5], [2, 3]] as const) for (const x of spread(450 - (n - 1) * 28, 450 + (n - 1) * 28, n)) pts.push({ x, y: row * 40 });
    return pts;
  })();

  // ----- Royal -----
  protected readonly damask = ring(4, 45);

  // ----- Floral -----
  protected readonly floral = computed(() => {
    const big = this.cover() ? 1 : 0.72;
    const roses = [
      { x: 168, y: 172, r: 96 * big, g: 'rose' }, { x: 330 * (big > 0.9 ? 1 : 0.86), y: 96, r: 60 * big, g: 'peach' }, { x: 92, y: 340 * (big > 0.9 ? 1 : 0.84), r: 56 * big, g: 'peach' },
      { x: 732, y: 1428, r: 96 * big, g: 'rose' }, { x: 570 + (big > 0.9 ? 0 : 60), y: 1506, r: 60 * big, g: 'peach' }, { x: 812, y: 1262 + (big > 0.9 ? 0 : 60), r: 56 * big, g: 'rose' },
    ];
    const leaves = [
      { x: 250, y: 230, a: 40, s: big }, { x: 210, y: 70, a: -20, s: big * 0.9 }, { x: 60, y: 210, a: 100, s: big * 0.85 }, { x: 410, y: 130, a: 10, s: big * 0.7 }, { x: 160, y: 420, a: 80, s: big * 0.7 },
      { x: 650, y: 1370, a: 220, s: big }, { x: 690, y: 1540, a: 160, s: big * 0.9 }, { x: 840, y: 1390, a: 280, s: big * 0.85 }, { x: 490, y: 1470, a: 190, s: big * 0.7 }, { x: 740, y: 1180, a: 260, s: big * 0.7 },
    ];
    const buds = [{ x: 430, y: 62 }, { x: 52, y: 470 }, { x: 470, y: 1540 }, { x: 848, y: 1130 }].map((b) => ({ ...b, r: 18 * big }));
    return { roses, leaves, buds };
  });
  protected readonly rosePetals = ring(5, -90);

  // ----- Mehndi -----
  protected readonly ring24 = ring(24);
  protected readonly ring36 = ring(36);
  protected readonly ring48 = ring(48);
  protected readonly ring12 = ring(12, 15);
  protected readonly vine = spread(330, 1270, 12);

  // ----- Phulkari -----
  protected readonly phulkari = computed(() => {
    const cover = this.cover();
    const h = cover ? 250 : 150;
    const { p, a } = this.c();
    const colours = [a, mixHex(p, '#ff5fa2', 0.45), '#ffd23f', '#16a06c'];
    const base = mixHex(p, '#22000c', 0.5);
    const dh = h * 0.42;
    const dw = 56;
    const rows = [h / 2, 1600 - h / 2];
    return { h, colours, base, dw, dh, rows, row: diamonds(0, dw * 2, dh, 0, 900) };
  });
  protected readonly sideDiamonds = spread(320, 1280, 13);
  protected readonly confetti = [
    { x: 150, y: 620, r: 20, k: 0 }, { x: 760, y: 560, r: -30, k: 1 }, { x: 120, y: 900, r: 45, k: 2 }, { x: 790, y: 960, r: 10, k: 3 },
    { x: 210, y: 1180, r: -15, k: 1 }, { x: 700, y: 1210, r: 35, k: 0 }, { x: 260, y: 420, r: 60, k: 3 }, { x: 650, y: 380, r: -50, k: 2 },
  ];

  // ----- Photo placeholder -----
  protected readonly lights = [60, 140, 220, 300, 380, 520, 600, 680, 760, 840].map((x) => ({ x, y: 650 + 40 * Math.sin((x / 900) * Math.PI) }));

  protected readonly diamond = diamond;
  protected readonly spread = spread;
  protected rot(a: number, x = 0, y = 0): string {
    return `rotate(${a} ${x} ${y})`;
  }
}
