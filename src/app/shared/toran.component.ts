import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A marigold-and-mango-leaf toran (door garland), drawn as a repeating SVG pattern. */
@Component({
  selector: 'app-toran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg width="100%" height="38" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="toran" width="56" height="38" patternUnits="userSpaceOnUse">
          <g transform="translate(0 4)">
          <path d="M0 4 Q28 18 56 4" fill="none" stroke="#f6c453" stroke-width="1.5" />
          <path d="M28 11 q-6 9 0 20 q6-11 0-20z" fill="#4f8a3c" />
          <path d="M28 13 v15" stroke="#2f5f25" stroke-width="0.8" />
          <circle cx="0" cy="4" r="5.5" fill="#f29a12" />
          <circle cx="0" cy="4" r="2.6" fill="#ffcf4d" />
          <circle cx="56" cy="4" r="5.5" fill="#f29a12" />
          <circle cx="56" cy="4" r="2.6" fill="#ffcf4d" />
          <circle cx="14" cy="9.5" r="4" fill="#e8501a" />
          <circle cx="42" cy="9.5" r="4" fill="#e8501a" />
          <circle cx="14" cy="9.5" r="1.7" fill="#ffb347" />
          <circle cx="42" cy="9.5" r="1.7" fill="#ffb347" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="38" fill="url(#toran)" />
    </svg>
  `,
  styles: `:host { display: block; line-height: 0; pointer-events: none; }`,
})
export class ToranComponent {}
