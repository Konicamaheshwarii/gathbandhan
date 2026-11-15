import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { mixHex } from '../../core/invite';

export type MotifName = 'ganesh' | 'peacocks' | 'crest' | 'knot' | 'rose' | 'mandala' | 'dhol' | 'kolam' | 'flourish';

/**
 * Original line-art emblems that sit in the text flow (the full-page scenery is in InviteArtComponent).
 * Drawn in SVG so they print sharply, export cleanly and need no image rights. Colours are passed in
 * as real values: SVG attributes must survive the PNG/PDF export.
 */
@Component({
  selector: 'app-invite-motif',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (name()) {
      @case ('ganesh') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="primary()" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="60" cy="60" r="56" [attr.stroke]="accent()" stroke-width="1.2" stroke-dasharray="2 4" />
            <path d="M47 33 L52 18 L57 28 L60 12 L63 28 L68 18 L73 33 Z" [attr.fill]="accent()" fill-opacity="0.35" [attr.stroke]="accent()" />
            <circle cx="60" cy="9" r="2.4" [attr.fill]="accent()" [attr.stroke]="accent()" />
            <path d="M46 34 Q60 29 74 34" [attr.stroke]="accent()" />
            <path d="M46 36 C28 26 16 46 22 62 C26 72 38 76 45 68" />
            <path d="M74 36 C92 26 104 46 98 62 C94 72 82 76 75 68" />
            <path d="M46 36 C42 50 45 62 53 68" />
            <path d="M74 36 C78 50 75 62 67 68" />
            <path d="M60 37 v8" stroke-width="3.4" />
            <circle cx="60" cy="48" r="2" [attr.fill]="primary()" stroke="none" />
            <path d="M51 50 q3 -2.5 6 0 M63 50 q3 -2.5 6 0" />
            <path d="M53 68 C55 80 60 88 58 96 C56 104 46 106 44 99 C42 93 50 92 51 97" />
            <path d="M67 68 C66 78 63 86 62 92" />
            <path d="M54 66 l-6 6 M66 66 l5 5" stroke-width="1.8" />
            <path d="M34 104 Q60 114 86 104" stroke-width="1.6" [attr.stroke]="accent()" />
            <circle cx="77" cy="96" r="5" [attr.fill]="accent()" fill-opacity="0.45" [attr.stroke]="accent()" />
          </g>
        </svg>
      }
      @case ('peacocks') {
        <svg viewBox="0 0 240 120" aria-hidden="true">
          @for (side of [0, 1]; track side) {
            <g [attr.transform]="side ? 'translate(240 0) scale(-1 1)' : ''" stroke-linecap="round">
              @for (f of feathers; track $index) {
                <path [attr.d]="'M58 88 Q' + (f.x + 16) + ' ' + (f.y + 22) + ' ' + f.x + ' ' + f.y" fill="none" [attr.stroke]="teal()" stroke-width="1.6" />
                <ellipse [attr.cx]="f.x" [attr.cy]="f.y" rx="7" ry="9" [attr.fill]="accent()" [attr.transform]="'rotate(' + f.r + ' ' + f.x + ' ' + f.y + ')'" />
                <ellipse [attr.cx]="f.x" [attr.cy]="f.y" rx="4" ry="5.5" [attr.fill]="teal()" [attr.transform]="'rotate(' + f.r + ' ' + f.x + ' ' + f.y + ')'" />
                <circle [attr.cx]="f.x" [attr.cy]="f.y" r="1.8" [attr.fill]="primary()" />
              }
              <path d="M58 100 C44 82 54 62 74 64 C84 52 86 40 84 32 C82 22 92 16 100 22 L110 26 L100 30 C96 38 98 52 92 66 C86 86 76 100 58 100Z" [attr.fill]="teal()" />
              <path d="M66 92 C60 80 66 70 78 72" fill="none" [attr.stroke]="accent()" stroke-width="2" />
              <circle cx="96" cy="25" r="1.8" fill="#fff" />
              <path d="M92 18 L88 6 M95 18 L95 5 M98 19 L102 7" [attr.stroke]="teal()" stroke-width="1.4" />
              <circle cx="88" cy="5" r="2" [attr.fill]="accent()" /><circle cx="95" cy="4" r="2" [attr.fill]="accent()" /><circle cx="102" cy="6" r="2" [attr.fill]="accent()" />
              <path d="M70 100 L66 112 M80 98 L80 112" [attr.stroke]="primary()" stroke-width="2" />
            </g>
          }
          <g [attr.fill]="primary()">
            <path d="M120 70 C110 84 110 100 120 112 C130 100 130 84 120 70Z" />
            <path d="M120 112 C104 100 94 100 88 92 C100 90 112 98 120 112Z M120 112 C136 100 146 100 152 92 C140 90 128 98 120 112Z" [attr.fill]="accent()" />
          </g>
        </svg>
      }
      @case ('crest') {
        <svg viewBox="0 0 200 220" aria-hidden="true">
          <g fill="none" [attr.stroke]="primary()" stroke-linecap="round">
            @for (side of [0, 1]; track side) {
              <g [attr.transform]="side ? 'translate(200 0) scale(-1 1)' : ''">
                <path d="M78 200 C34 180 18 130 34 80" stroke-width="3" />
                @for (l of laurel; track $index) {
                  <ellipse [attr.cx]="l.x" [attr.cy]="l.y" rx="5" ry="12" [attr.fill]="primary()" stroke="none" [attr.transform]="'rotate(' + l.r + ' ' + l.x + ' ' + l.y + ')'" />
                }
              </g>
            }
            <circle cx="100" cy="124" r="62" stroke-width="4" />
            <circle cx="100" cy="124" r="54" stroke-width="1.5" [attr.stroke]="accent()" />
            <circle cx="100" cy="124" r="47" [attr.fill]="primary()" fill-opacity="0.12" stroke-width="1" />
          </g>
          <path d="M64 64 L58 30 L80 46 L100 20 L120 46 L142 30 L136 64 Z" [attr.fill]="primary()" />
          <rect x="62" y="60" width="76" height="10" rx="3" [attr.fill]="accent()" />
          <circle cx="58" cy="28" r="4" [attr.fill]="accent()" /><circle cx="100" cy="17" r="5" [attr.fill]="accent()" /><circle cx="142" cy="28" r="4" [attr.fill]="accent()" />
          <text x="100" y="140" text-anchor="middle" font-family="Cinzel, 'Cormorant Garamond', Georgia, serif" font-size="44" font-weight="700" [attr.fill]="primary()">{{ initials()[0] }}<tspan font-size="24" dy="-6" [attr.fill]="accent()"> &amp; </tspan><tspan dy="6">{{ initials()[1] }}</tspan></text>
          <path d="M40 196 L60 186 L140 186 L160 196 L140 206 L60 206 Z" [attr.fill]="primary()" />
        </svg>
      }
      @case ('knot') {
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="33" r="30" fill="none" [attr.stroke]="primary()" stroke-width="0.8" />
          <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" transform="translate(9 9) scale(0.72)">
            <path [attr.stroke]="primary()" d="M32 23.5C31.5 14 26.5 8.5 19.5 8.5C12 8.5 7 14 7 21C7 28 25 32 32 37C35.5 39.5 37.5 41 37.5 44C37.5 47 35.5 48.5 32 51C28.5 53.5 25 56 21.5 58.5" />
            <path [attr.stroke]="accent()" d="M32 23.5C32.5 14 37.5 8.5 44.5 8.5C52 8.5 57 14 57 21C57 28 39 32 32 37C28.5 39.5 26.5 41 26.5 44C26.5 47 28.5 48.5 32 51C35.5 53.5 39 56 42.5 58.5" />
          </g>
        </svg>
      }
      @case ('rose') {
        <svg viewBox="0 0 120 80" aria-hidden="true">
          <path d="M8 52 C30 30 50 60 60 44 C70 60 90 30 112 52" fill="none" stroke="#7fa585" stroke-width="2" />
          <path d="M24 44 c8 -12 22 -10 26 0 c-10 6 -20 6 -26 0z M96 44 c-8 -12 -22 -10 -26 0 c10 6 20 6 26 0z" fill="#9dbb98" />
          @for (a of petals; track a) { <circle cx="60" cy="27" r="12" [attr.fill]="accent()" fill-opacity="0.75" [attr.transform]="'rotate(' + a + ' 60 36)'" /> }
          <circle cx="60" cy="36" r="10" [attr.fill]="soft()" />
          <path d="M54 36 a6 6 0 1 1 6 6" fill="none" [attr.stroke]="primary()" stroke-width="1.6" opacity="0.6" />
        </svg>
      }
      @case ('mandala') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="primary()" stroke-linecap="round">
            <circle cx="60" cy="60" r="54" stroke-width="1.6" />
            @for (a of ring16; track a) {
              <path d="M60 14 C66 20 66 30 60 36 C54 30 54 20 60 14Z" stroke-width="1.6" [attr.transform]="'rotate(' + a + ' 60 60)'" />
              <circle cx="60" cy="9" r="1.6" [attr.fill]="primary()" stroke="none" [attr.transform]="'rotate(' + a + ' 60 60)'" />
            }
            <circle cx="60" cy="60" r="22" stroke-width="1.6" [attr.stroke]="accent()" />
            <circle cx="60" cy="60" r="15" stroke-width="3" stroke-dasharray="0 6" />
            <circle cx="60" cy="60" r="4" [attr.fill]="accent()" stroke="none" />
          </g>
        </svg>
      }
      @case ('dhol') {
        <svg viewBox="0 0 220 160" aria-hidden="true">
          <g stroke-linecap="round" stroke-linejoin="round">
            <path d="M40 54 C80 6 140 6 180 54" fill="none" [attr.stroke]="primary()" stroke-width="5" />
            <path d="M52 52 C42 74 42 114 52 136 L168 136 C178 114 178 74 168 52 Z" [attr.fill]="accent()" [attr.stroke]="primary()" stroke-width="4" />
            <path d="M62 54 L82 134 L102 54 L122 134 L142 54 L160 134" fill="none" [attr.stroke]="primary()" stroke-width="3" />
            <path d="M54 66 H166 M54 122 H166" [attr.stroke]="primary()" stroke-width="2" stroke-dasharray="3 5" />
            <ellipse cx="50" cy="94" rx="16" ry="44" [attr.fill]="paperish()" [attr.stroke]="primary()" stroke-width="5" />
            <ellipse cx="170" cy="94" rx="16" ry="44" [attr.fill]="paperish()" [attr.stroke]="primary()" stroke-width="5" />
            <path d="M186 22 C206 42 212 66 202 92" fill="none" [attr.stroke]="primary()" stroke-width="6" />
            <path d="M14 30 L42 76" [attr.stroke]="primary()" stroke-width="4" />
            <path d="M14 108 q-8 -12 0 -26 M206 108 q8 -12 0 -26 M22 122 q-12 -20 0 -44" fill="none" [attr.stroke]="accent()" stroke-width="3" />
          </g>
        </svg>
      }
      @case ('kolam') {
        <svg viewBox="0 0 120 60" aria-hidden="true">
          <g fill="none" [attr.stroke]="primary()" stroke-width="2" stroke-linejoin="round">
            @for (x of [30, 60, 90]; track x) { <path [attr.d]="'M' + x + ' 12 L' + (x + 18) + ' 30 L' + x + ' 48 L' + (x - 18) + ' 30Z'" /> }
            <ellipse cx="60" cy="30" rx="56" ry="22" [attr.stroke]="accent()" />
          </g>
          @for (x of [30, 60, 90]; track x) { <circle [attr.cx]="x" cy="30" r="3" [attr.fill]="accent()" /> }
        </svg>
      }
      @case ('flourish') {
        <svg viewBox="0 0 240 24" aria-hidden="true">
          <g fill="none" [attr.stroke]="primary()" stroke-width="1.8" stroke-linecap="round">
            <path d="M4 12 C40 12 54 2 78 6 C96 9 90 21 104 19 C110 18 112 14 108 12" />
            <path d="M236 12 C200 12 186 2 162 6 C144 9 150 21 136 19 C130 18 128 14 132 12" />
          </g>
          <path d="M120 3 L129 12 L120 21 L111 12Z" [attr.fill]="accent()" />
          <circle cx="120" cy="12" r="2.4" [attr.fill]="primary()" />
        </svg>
      }
    }
  `,
  styles: `:host { display: block; line-height: 0; } svg { width: 100%; height: auto; display: block; overflow: visible; }`,
})
export class InviteMotifComponent {
  readonly name = input.required<MotifName>();
  /** The couple's initials, for the crest. */
  readonly initials = input<[string, string]>(['', '']);
  /** Real colours, not CSS variables: SVG attributes must survive the PNG/PDF export. */
  readonly primary = input('#9c1c1c');
  readonly accent = input('#d4a017');
  readonly paper = input('#fff8ec');

  protected readonly teal = computed(() => mixHex('#11707f', this.primary(), 0.15));
  protected readonly soft = computed(() => mixHex(this.accent(), this.primary(), 0.35));
  protected readonly paperish = computed(() => mixHex(this.paper(), '#f3e2c0', 0.3));
  protected readonly feathers = [
    { x: 18, y: 50, r: -50 }, { x: 22, y: 30, r: -35 }, { x: 34, y: 14, r: -20 }, { x: 52, y: 6, r: -5 }, { x: 10, y: 72, r: -70 },
  ];
  protected readonly laurel = [
    { x: 34, y: 168, r: -60 }, { x: 26, y: 140, r: -40 }, { x: 24, y: 112, r: -20 }, { x: 28, y: 86, r: 0 }, { x: 54, y: 186, r: -80 },
    { x: 44, y: 152, r: 30 }, { x: 40, y: 124, r: 40 }, { x: 42, y: 98, r: 50 },
  ];
  protected readonly petals = [0, 72, 144, 216, 288];
  protected readonly ring16 = Array.from({ length: 16 }, (_, i) => i * 22.5);
}
