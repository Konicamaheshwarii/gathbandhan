import { inject } from '@angular/core';
import {
  PayoutForm, feeBreakdown, hmacSha256Hex, isTestKey, lastChars, paiseToRupees, verifyPaymentSignature,
} from '../../../../supabase/functions/_shared/razorpay-core';
import { RUNTIME_CONFIG } from '../config';
import { WeddingRepository } from '../data/wedding.repository';
import { Wedding } from '../models';
import { readJson, writeJson } from '../storage';
import { CheckoutResponse, CreatedOrder, OrderRequest, PaymentGateway, PaymentState, PayoutAccount, RazorpayAvailability } from './payments.models';

/**
 * Not a secret: the demo signs its pretend payments with this public string so the same
 * signature check the server uses runs in the browser too. Real keys never reach the app.
 */
export const DEMO_SIGNING_KEY = 'gathbandhan-demo-not-a-secret';

const randomId = (n = 14) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
};

/** What the simulated checkout returns on success, signed like Razorpay would. */
export async function signDemoPayment(orderId: string): Promise<CheckoutResponse> {
  const paymentId = `pay_DEMO${randomId(10)}`;
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: await hmacSha256Hex(DEMO_SIGNING_KEY, `${orderId}|${paymentId}`) };
}

const PAYOUT_KEY = (weddingId: string) => `sg.payout.${weddingId}`;
const PAID_KEY = 'sg.demoOrders';

/**
 * Demo mode: everything happens in this browser, no money moves and no server is called.
 * Payout details are kept masked (last four characters only), exactly like the backend.
 */
export class DemoPaymentGateway implements PaymentGateway {
  private readonly repo = inject(WeddingRepository);
  private readonly config = inject(RUNTIME_CONFIG);

  availability(): RazorpayAvailability {
    return 'simulated';
  }

  async createOrder(w: Wedding, req: OrderRequest): Promise<CreatedOrder> {
    const fees = feeBreakdown(req.amount, w.feeBearer ?? 'couple');
    return {
      orderId: `order_DEMO${randomId()}`,
      keyId: isTestKey(this.config.razorpayKeyId) ? this.config.razorpayKeyId : 'rzp_test_demo',
      amount: req.amount,
      amountPaise: fees.totalPaise,
      convenienceFee: paiseToRupees(fees.convenienceFeePaise),
      total: paiseToRupees(fees.totalPaise),
      testMode: true,
      routed: false,
      simulated: true,
    };
  }

  async verify(w: Wedding, order: CreatedOrder, response: CheckoutResponse, req: OrderRequest): Promise<PaymentState> {
    if (response.razorpay_order_id !== order.orderId || !(await verifyPaymentSignature(response, DEMO_SIGNING_KEY))) return 'failed';
    const done = readJson<Record<string, PaymentState>>(PAID_KEY, {});
    if (done[order.orderId] === 'paid') return 'paid'; // idempotent, like the server
    const fees = feeBreakdown(req.amount, w.feeBearer ?? 'couple');
    await this.repo.recordDemoPayment(
      { ...req, weddingId: w.id },
      {
        razorpayOrderId: order.orderId,
        razorpayPaymentId: response.razorpay_payment_id,
        chargedAmount: paiseToRupees(fees.totalPaise),
        guestFee: paiseToRupees(fees.convenienceFeePaise),
        fee: paiseToRupees(fees.gatewayFeePaise + fees.platformFeePaise),
      },
    );
    writeJson(PAID_KEY, { ...done, [order.orderId]: 'paid' });
    return 'paid';
  }

  async orderStatus(_w: Wedding, orderId: string): Promise<PaymentState | null> {
    return readJson<Record<string, PaymentState>>(PAID_KEY, {})[orderId] ?? null;
  }

  async getPayout(w: Wedding): Promise<PayoutAccount> {
    return readJson<PayoutAccount | null>(PAYOUT_KEY(w.id), null) ?? { status: 'not_set_up', detail: '', routeEnabled: true };
  }

  async savePayout(w: Wedding, form: PayoutForm): Promise<PayoutAccount> {
    const account: PayoutAccount = {
      status: 'under_review',
      detail: 'Demo: a real Razorpay review takes a few hours to a few days.',
      routeEnabled: true,
      legalName: form.legalName,
      email: form.email,
      phone: form.phone,
      bankLast4: lastChars(form.accountNumber),
      ifsc: form.ifsc,
      panLast4: lastChars(form.pan),
    };
    writeJson(PAYOUT_KEY(w.id), account);
    await this.setActive(w, false);
    return account;
  }

  async simulateApproval(w: Wedding): Promise<PayoutAccount> {
    const account: PayoutAccount = { ...(await this.getPayout(w)), status: 'active', detail: '' };
    writeJson(PAYOUT_KEY(w.id), account);
    await this.setActive(w, true);
    return account;
  }

  /** In demo mode the browser plays the server's part of keeping razorpayActive in sync. */
  private async setActive(w: Wedding, active: boolean): Promise<void> {
    const fresh = (await this.repo.getWeddingBySlug(w.slug)) ?? w;
    await this.repo.saveWedding({ ...fresh, razorpayActive: active });
  }
}
