import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

export interface Toast { id: number; text: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private next = 0;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, ms = 2600): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, text }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), ms);
  }
}

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of service.toasts(); track t.id) { <div class="toast">{{ t.text }}</div> }
    </div>
  `,
  styles: `
    .toasts { position: fixed; left: 50%; bottom: calc(88px + env(safe-area-inset-bottom)); transform: translateX(-50%);
      display: grid; gap: 0.5rem; z-index: 50; width: max-content; max-width: calc(100vw - 32px); pointer-events: none; }
    .toast { background: #2a1613; color: #fff6ea; padding: 0.6rem 1.1rem; border-radius: 999px; font-weight: 600;
      box-shadow: 0 8px 24px rgb(0 0 0 / 25%); animation: rise 0.2s ease-out; text-align: center; }
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  `,
})
export class ToastsComponent {
  protected readonly service = inject(ToastService);
}
