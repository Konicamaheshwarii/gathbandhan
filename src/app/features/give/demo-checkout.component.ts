import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, output, signal } from '@angular/core';
import { formatRupees } from '../../core/payments/payments.models';
import { CheckoutOutcome } from '../../core/payments/razorpay-checkout';
import { signDemoPayment } from '../../core/payments/demo-payment-gateway';

type Method = 'upi' | 'card' | 'netbanking';

/**
 * A pretend Razorpay Checkout for demo mode and the sample wedding. Clearly labelled, it takes
 * no details and moves no money; it only lets people see the whole flow, success and failure.
 */
@Component({
  selector: 'app-demo-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="close()"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="demo-co-title" (keydown.escape)="close()">
      <header>
        <div>
          <p class="brand" id="demo-co-title">Gathbandhan · shagun for {{ couple() }}</p>
          <p class="amount num">{{ rupees(total()) }}</p>
        </div>
        <button type="button" class="x" aria-label="Close checkout" (click)="close()">×</button>
      </header>
      <p class="demo-badge" role="note">DEMO · simulated test-mode checkout · no real money</p>
      <div class="tabs" role="tablist" aria-label="Payment method">
        @for (m of methods; track m.id) {
          <button type="button" role="tab" [attr.aria-selected]="method() === m.id" (click)="method.set(m.id)">{{ m.label }}</button>
        }
      </div>
      <div class="panel">
        @switch (method()) {
          @case ('upi') { <p>UPI ID <code>success&#64;razorpay</code></p><p class="hint">Razorpay's test UPI ID for a successful payment.</p> }
          @case ('card') { <p>Card <code>4100 2800 0000 1007</code></p><p class="hint">Razorpay's test Visa card: any future expiry, any CVV.</p> }
          @case ('netbanking') { <p>Bank <code>Test bank</code></p><p class="hint">Razorpay's test netbanking page lets you pick success or failure.</p> }
        }
      </div>
      <button type="button" class="btn primary block pay" (click)="succeed()" [disabled]="busy()">Pay {{ rupees(total()) }}</button>
      <button type="button" class="btn ghost block" (click)="fail()" [disabled]="busy()">Simulate a failed payment</button>
      <p class="secured hint">In the live app this window is Razorpay Checkout. Gathbandhan never sees card or bank details.</p>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: end center; }
    @media (min-width: 640px) { :host { place-items: center; } }
    .backdrop { position: absolute; inset: 0; background: rgb(20 8 12 / 55%); }
    .sheet {
      position: relative; width: min(26rem, 100%); max-height: 100dvh; overflow: auto; background: var(--surface); color: var(--text);
      border-radius: 18px 18px 0 0; padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom)); display: grid; gap: 0.75rem;
      box-shadow: 0 -10px 40px rgb(0 0 0 / 25%);
    }
    @media (min-width: 640px) { .sheet { border-radius: 18px; } }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; background: var(--accent); color: #fff; margin: -1rem -1rem 0; padding: 1rem; border-radius: inherit; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
    .brand { margin: 0; font-size: 0.85rem; opacity: 0.9; }
    .amount { margin: 0.2rem 0 0; font-size: 1.6rem; font-weight: 700; }
    .x { font: inherit; font-size: 1.6rem; line-height: 1; background: none; border: 0; color: inherit; cursor: pointer; min-width: 44px; min-height: 44px; }
    .demo-badge { margin: 0; text-align: center; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; color: #7a4b00; background: #fff4d6; border: 1px dashed #c98a00; border-radius: 8px; padding: 0.35rem; }
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
    .tabs button { font: inherit; font-size: 0.85rem; padding: 0.5rem 0.25rem; min-height: 44px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: inherit; cursor: pointer; }
    .tabs button[aria-selected='true'] { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
    .panel { border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem; p { margin: 0; } p + p { margin-top: 0.25rem; } }
    code { font-size: 0.95em; }
    .secured { margin: 0; text-align: center; }
  `,
})
export class DemoCheckoutComponent {
  readonly orderId = input.required<string>();
  /** Rupees, fee included. */
  readonly total = input.required<number>();
  readonly couple = input('');
  readonly done = output<CheckoutOutcome>();

  protected readonly methods: { id: Method; label: string }[] = [
    { id: 'upi', label: 'UPI' },
    { id: 'card', label: 'Card' },
    { id: 'netbanking', label: 'Netbanking' },
  ];
  protected readonly method = signal<Method>('upi');
  protected readonly busy = signal(false);
  protected readonly rupees = formatRupees;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('.pay')?.focus());
  }

  protected async succeed(): Promise<void> {
    this.busy.set(true);
    // A short pause, like a real payment, so the "verifying" step is visible.
    await new Promise((r) => setTimeout(r, 400));
    this.done.emit({ kind: 'success', response: await signDemoPayment(this.orderId()) });
  }

  protected fail(): void {
    this.done.emit({ kind: 'failed', reason: 'Simulated failure: the test bank declined the payment.' });
  }

  protected close(): void {
    if (!this.busy()) this.done.emit({ kind: 'dismissed' });
  }
}
