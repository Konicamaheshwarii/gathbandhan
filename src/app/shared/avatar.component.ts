import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A round avatar: the photo, or initials on a warm gradient. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--size.px]': 'size()', role: 'img', '[attr.aria-label]': 'label() || null', '[attr.aria-hidden]': 'label() ? null : true' },
  template: `
    @if (url()) {
      <img [src]="url()" alt="" [width]="size()" [height]="size()" decoding="async" />
    } @else {
      <span class="initials">{{ initials() }}</span>
    }
  `,
  styles: `
    :host {
      flex: none;
      display: inline-grid;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(145deg, #c4521f, #8a1c3b 70%);
      box-shadow: 0 0 0 2px var(--avatar-ring, transparent);
    }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .initials {
      font: 600 calc(var(--size) * 0.4) / 1 var(--font-display);
      color: #fff6e8;
      letter-spacing: 0.02em;
    }
  `,
})
export class AvatarComponent {
  readonly url = input('');
  readonly initials = input('?');
  readonly size = input(36);
  /** Accessible name; leave empty when a visible name sits next to it. */
  readonly label = input('');
}
