import { InjectionToken } from '@angular/core';
import { CheckoutResponse } from './payments.models';

export const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
/** Gathbandhan maroon, so Checkout looks like part of the page. */
export const CHECKOUT_THEME = '#8a1c3b';

export interface CheckoutOptions {
  key: string;
  amount: number;
  currency: 'INR';
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; contact?: string };
  notes?: Record<string, string>;
  theme: { color: string };
}

export type CheckoutOutcome =
  | { kind: 'success'; response: CheckoutResponse }
  | { kind: 'failed'; reason: string }
  | { kind: 'dismissed' };

/** Opens Razorpay Checkout and resolves once the guest pays, fails or closes it. */
export interface CheckoutLauncher {
  open(options: CheckoutOptions): Promise<CheckoutOutcome>;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: { error?: { description?: string } }) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let scriptPromise: Promise<RazorpayCtor> | null = null;

/** Loads checkout.js once, only when a guest actually pays through Razorpay. */
export function loadCheckoutScript(doc: Document = document): Promise<RazorpayCtor> {
  const existing = (globalThis as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const s = doc.createElement('script');
    s.src = CHECKOUT_SCRIPT;
    s.async = true;
    s.onload = () => {
      const ctor = (globalThis as { Razorpay?: RazorpayCtor }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error('Razorpay Checkout did not load.'));
    };
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load Razorpay Checkout. Check your internet connection.'));
    };
    doc.head.appendChild(s);
  });
  return scriptPromise;
}

export class RazorpayCheckoutLauncher implements CheckoutLauncher {
  async open(options: CheckoutOptions): Promise<CheckoutOutcome> {
    const Razorpay = await loadCheckoutScript();
    return new Promise<CheckoutOutcome>((resolve) => {
      let lastFailure = '';
      const rzp = new Razorpay({
        ...options,
        handler: (response: CheckoutResponse) => resolve({ kind: 'success', response }),
        // Checkout lets the guest retry inside the window; a failure only ends things when it closes.
        modal: { ondismiss: () => resolve(lastFailure ? { kind: 'failed', reason: lastFailure } : { kind: 'dismissed' }), confirm_close: true },
        retry: { enabled: true },
      });
      rzp.on('payment.failed', (r) => (lastFailure = r.error?.description || 'The payment did not go through.'));
      rzp.open();
    });
  }
}

export const CHECKOUT_LAUNCHER = new InjectionToken<CheckoutLauncher>('CHECKOUT_LAUNCHER', {
  providedIn: 'root',
  factory: () => new RazorpayCheckoutLauncher(),
});
