import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { InviteTemplate } from '../../core/models';

/**
 * Original line-art motifs for each invite template, drawn in SVG so they print sharply, export
 * cleanly and need no image rights. Colours come from the page's CSS variables.
 */
@Component({
  selector: 'app-invite-motif',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (template()) {
      @case ('ganesh') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="accent()" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="60" cy="60" r="56" stroke-width="1" stroke-dasharray="2 4" />
            <path d="M47 33 L52 18 L57 28 L60 12 L63 28 L68 18 L73 33 Z" [attr.fill]="accent()" fill-opacity="0.18" />
            <circle cx="60" cy="10" r="2" [attr.fill]="accent()" />
            <path d="M46 34 Q60 29 74 34" />
            <path d="M46 36 C28 26 16 46 22 62 C26 72 38 76 45 68" />
            <path d="M74 36 C92 26 104 46 98 62 C94 72 82 76 75 68" />
            <path d="M46 36 C42 50 45 62 53 68" />
            <path d="M74 36 C78 50 75 62 67 68" />
            <path d="M60 37 v8" [attr.stroke]="primary()" stroke-width="3" />
            <circle cx="60" cy="48" r="1.8" [attr.fill]="primary()" stroke="none" />
            <path d="M51 50 q3 -2.5 6 0 M63 50 q3 -2.5 6 0" />
            <path d="M53 68 C55 80 60 88 58 96 C56 104 46 106 44 99 C42 93 50 92 51 97" />
            <path d="M67 68 C66 78 63 86 62 92" />
            <path d="M54 66 l-6 6 M66 66 l5 5" stroke-width="1.8" />
            <path d="M34 102 Q60 112 86 102" stroke-width="1.4" />
            <circle cx="77" cy="96" r="5" [attr.fill]="accent()" fill-opacity="0.25" />
            <path d="M74 93 q3 -4 6 0" stroke-width="1.4" />
          </g>
        </svg>
      }
      @case ('rajasthani') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="accent()" stroke-width="2" stroke-linejoin="round">
            <path d="M22 112 V58 C22 40 34 30 44 26 C48 18 54 14 60 6 C66 14 72 18 76 26 C86 30 98 40 98 58 V112" />
            <path d="M32 112 V62 C32 48 40 40 48 37 C52 30 56 27 60 21 C64 27 68 30 72 37 C80 40 88 48 88 62 V112" [attr.stroke]="primary()" />
            <path d="M14 112 H106" />
            <path d="M44 26 Q60 34 76 26" stroke-width="1.2" />
            <circle cx="60" cy="6" r="2.5" [attr.fill]="accent()" />
          </g>
          <g>
            @for (x of [30, 42, 54, 66, 78, 90]; track x) {
              <circle [attr.cx]="x" cy="47" r="3.4" fill="#f29a12" />
              <circle [attr.cx]="x" cy="47" r="1.4" fill="#ffd166" />
            }
            <path d="M27 47 Q60 58 93 47" fill="none" stroke="#3f7d3a" stroke-width="1" />
            @for (x of [36, 48, 60, 72, 84]; track x) {
              <path [attr.d]="'M' + x + ' 52 q-3 5 0 10 q3 -5 0 -10z'" fill="#3f7d3a" />
            }
          </g>
          <g [attr.fill]="accent()">
            <path d="M44 98 q6 -8 12 0 z" /><path d="M64 98 q6 -8 12 0 z" />
            <path d="M50 90 q-2 -4 0 -7 q2 3 0 7z" fill="#f29a12" /><path d="M70 90 q-2 -4 0 -7 q2 3 0 7z" fill="#f29a12" />
          </g>
        </svg>
      }
      @case ('gujarati') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="60" cy="60" r="56" [attr.stroke]="accent()" stroke-width="1" stroke-dasharray="1 5" />
            <path d="M38 62 C30 80 36 100 60 104 C84 100 90 80 82 62 Z" [attr.fill]="primary()" fill-opacity="0.12" [attr.stroke]="primary()" stroke-width="2.2" />
            <path d="M40 74 H80" [attr.stroke]="accent()" stroke-width="2" />
            <path d="M42 84 H78" [attr.stroke]="accent()" stroke-width="1.2" stroke-dasharray="2 3" />
            <path d="M44 62 H76" [attr.stroke]="primary()" stroke-width="2.2" />
            <path d="M48 62 Q60 52 72 62" [attr.stroke]="primary()" stroke-width="2" />
            <ellipse cx="60" cy="42" rx="11" ry="13" fill="#b7793a" fill-opacity="0.35" stroke="#8a5a2b" stroke-width="2" />
            <path d="M60 29 v-6" stroke="#8a5a2b" stroke-width="2" />
            <path d="M50 52 C36 46 30 36 34 30 C42 34 48 42 50 52Z" [attr.fill]="accent()" fill-opacity="0.35" [attr.stroke]="accent()" stroke-width="1.6" />
            <path d="M70 52 C84 46 90 36 86 30 C78 34 72 42 70 52Z" [attr.fill]="accent()" fill-opacity="0.35" [attr.stroke]="accent()" stroke-width="1.6" />
            <path d="M48 54 C40 54 32 50 28 44" [attr.stroke]="accent()" stroke-width="1.6" />
            <path d="M72 54 C80 54 88 50 92 44" [attr.stroke]="accent()" stroke-width="1.6" />
            <g [attr.stroke]="primary()" stroke-width="2">
              <path d="M54 88 v8 h12 M66 88 h-12 M60 86 v12" transform="rotate(0 60 92)" />
            </g>
          </g>
        </svg>
      }
      @case ('south') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="accent()" stroke-width="2" stroke-linejoin="round">
            <path d="M34 108 V92 H86 V108" />
            <path d="M38 92 V80 H82 V92" />
            <path d="M42 80 V68 H78 V80" />
            <path d="M46 68 V56 H74 V68" />
            <path d="M50 56 V45 H70 V56" />
            <path d="M52 45 C52 36 68 36 68 45" />
            <path d="M60 37 v-9" /><circle cx="60" cy="26" r="2.2" [attr.fill]="accent()" />
            <path d="M54 108 V98 Q60 92 66 98 V108" [attr.stroke]="primary()" />
            <path d="M24 108 H96" />
          </g>
          <g [attr.fill]="primary()" fill-opacity="0.85">
            <path d="M14 110 C10 84 14 60 26 40 C24 62 22 86 24 110Z" />
            <path d="M24 110 C22 90 26 72 34 58 C32 76 30 92 30 110Z" fill-opacity="0.6" />
            <path d="M106 110 C110 84 106 60 94 40 C96 62 98 86 96 110Z" />
            <path d="M96 110 C98 90 94 72 86 58 C88 76 90 92 90 110Z" fill-opacity="0.6" />
          </g>
          <g [attr.fill]="accent()">
            @for (x of [40, 50, 60, 70, 80]; track x) { <circle [attr.cx]="x" cy="116" r="1.6" /> }
          </g>
        </svg>
      }
      @case ('royal') {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="accent()" stroke-width="1.6" stroke-linecap="round">
            <circle cx="60" cy="60" r="20" [attr.stroke]="primary()" stroke-width="2" />
            <circle cx="60" cy="60" r="27" stroke-dasharray="1 4" />
            @for (a of [0, 45, 90, 135, 180, 225, 270, 315]; track a) {
              <g [attr.transform]="'rotate(' + a + ' 60 60)'">
                <path d="M60 33 C54 22 56 12 60 6 C64 12 66 22 60 33Z" [attr.fill]="primary()" fill-opacity="0.2" [attr.stroke]="primary()" />
                <path d="M60 33 C70 30 74 22 72 16 M60 33 C50 30 46 22 48 16" />
              </g>
            }
            <path d="M48 66 L52 52 L56 60 L60 48 L64 60 L68 52 L72 66 Z" [attr.fill]="primary()" fill-opacity="0.35" [attr.stroke]="primary()" />
            <path d="M48 70 H72" [attr.stroke]="primary()" stroke-width="2" />
          </g>
        </svg>
      }
      @default {
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" [attr.stroke]="accent()" stroke-width="1.4" stroke-linecap="round">
            <circle cx="60" cy="60" r="44" />
            <circle cx="60" cy="60" r="40" stroke-width="0.6" />
            <path d="M28 96 C40 86 48 84 60 88 C72 84 80 86 92 96" stroke-width="1" />
            <path d="M36 92 c2 -6 8 -8 12 -6 M84 92 c-2 -6 -8 -8 -12 -6" stroke-width="1" />
          </g>
          <text x="60" y="68" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="24" [attr.fill]="primary()" letter-spacing="1">{{ monogram() }}</text>
        </svg>
      }
    }
  `,
  styles: `:host { display: block; line-height: 0; } svg { width: 100%; height: auto; display: block; overflow: visible; }`,
})
export class InviteMotifComponent {
  readonly template = input.required<InviteTemplate>();
  /** Initials for the minimal template, e.g. "R & A". */
  readonly monogram = input('');
  /** Real colours, not CSS variables: SVG attributes must survive the PNG/PDF export. */
  readonly primary = input('#9c1c1c');
  readonly accent = input('#d4a017');
}
