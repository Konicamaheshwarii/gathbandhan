import { InjectionToken } from '@angular/core';
import { DemoPaymentGateway } from './demo-payment-gateway';
import { PaymentGateway } from './payments.models';

/** Demo by default; supabase-backend.ts provides the Edge Functions gateway when online. */
export const PAYMENT_GATEWAY = new InjectionToken<PaymentGateway>('PAYMENT_GATEWAY', {
  providedIn: 'root',
  factory: () => new DemoPaymentGateway(),
});
