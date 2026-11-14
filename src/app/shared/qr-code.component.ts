import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { qrMatrix } from '../core/qr';

/** Renders a QR code as crisp inline SVG (prints sharply at any size). */
@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + qr().size + ' ' + qr().size" shape-rendering="crispEdges" role="img"
         [attr.aria-label]="label()">
      <rect [attr.width]="qr().size" [attr.height]="qr().size" fill="#fff" />
      <path [attr.d]="qr().path" [attr.fill]="color()" />
    </svg>
  `,
  styles: `:host { display: block; line-height: 0; } svg { width: 100%; height: auto; display: block; }`,
})
export class QrCodeComponent {
  readonly value = input.required<string>();
  readonly label = input('QR code');
  readonly color = input('#2a1613');
  protected readonly qr = computed(() => qrMatrix(this.value()));
}
