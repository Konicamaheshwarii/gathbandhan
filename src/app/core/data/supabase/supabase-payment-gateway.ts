import { inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RUNTIME_CONFIG } from '../../config';
import { Wedding } from '../../models';
import { DemoPaymentGateway } from '../../payments/demo-payment-gateway';
import {
  CheckoutResponse, CreatedOrder, OrderRequest, PaymentGateway, PaymentState, PaymentsUnavailable, PayoutAccount, PayoutForm,
  RazorpayAvailability,
} from '../../payments/payments.models';
import { isDemoId } from '../seed';
import { SUPABASE_CLIENT } from './supabase.token';

export const FN = {
  createOrder: 'razorpay-create-order',
  verify: 'razorpay-verify',
  linkedAccount: 'razorpay-linked-account',
} as const;

const TIMEOUT_MS = 15_000;

/** Statuses that mean "the payment server is not there (yet)", not "your input was wrong". */
const UNAVAILABLE = new Set([0, 404, 405, 500, 502, 503, 504, 546]);

/**
 * Calls an Edge Function and turns its failures into errors the pages can act on:
 * PaymentsUnavailable when the function is missing, unconfigured or unreachable (the give page
 * then falls back to direct UPI), a plain Error with the server's message otherwise.
 */
export async function invokeFunction<T>(client: Pick<SupabaseClient, 'functions'>, name: string, body: unknown, timeoutMs = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PaymentsUnavailable('The payment server did not answer.')), timeoutMs);
  });
  try {
    const { data, error } = await Promise.race([client.functions.invoke<T>(name, { body: body as Record<string, unknown> }), timeout]);
    if (!error) return data as T;
    const res = (error as { context?: unknown }).context;
    const status = res instanceof Response ? res.status : 0;
    let message = '';
    if (res instanceof Response) {
      try {
        message = ((await res.clone().json()) as { error?: string }).error ?? '';
      } catch {
        // not JSON (for example the gateway's own 404 page)
      }
    }
    if (UNAVAILABLE.has(status) && !(status === 500 && message)) throw new PaymentsUnavailable(message || 'Payments are being set up.');
    throw new Error(message || 'Something went wrong. Please try again.');
  } catch (e) {
    if (e instanceof PaymentsUnavailable || (e instanceof Error && e.message && !(e instanceof TypeError))) throw e;
    throw new PaymentsUnavailable('Could not reach the payment server.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Razorpay through the Supabase Edge Functions. The sample wedding keeps the simulated
 * checkout, so the demo never touches real payments even when the backend is on.
 */
export class SupabasePaymentGateway implements PaymentGateway {
  private readonly client = inject(SUPABASE_CLIENT) as SupabaseClient;
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly demo = new DemoPaymentGateway();

  private simulated(w: Wedding): boolean {
    return !!w.demo || isDemoId(w.id);
  }

  availability(w: Wedding): RazorpayAvailability {
    if (this.simulated(w)) return 'simulated';
    return this.config.razorpayKeyId ? 'live' : 'unconfigured';
  }

  async createOrder(w: Wedding, req: OrderRequest): Promise<CreatedOrder> {
    if (this.simulated(w)) return this.demo.createOrder(w, req);
    const r = await invokeFunction<Omit<CreatedOrder, 'simulated'>>(this.client, FN.createOrder, { slug: w.slug, ...req });
    return { ...r, simulated: false };
  }

  async verify(w: Wedding, order: CreatedOrder, response: CheckoutResponse, req: OrderRequest): Promise<PaymentState> {
    if (this.simulated(w)) return this.demo.verify(w, order, response, req);
    const r = await invokeFunction<{ status: PaymentState }>(this.client, FN.verify, response);
    return r.status;
  }

  async orderStatus(w: Wedding, orderId: string): Promise<PaymentState | null> {
    if (this.simulated(w)) return this.demo.orderStatus(w, orderId);
    const { data, error } = await this.client.rpc('shagun_order_status', { p_order_id: orderId });
    if (error) return null;
    return data === 'paid' || data === 'failed' || data === 'pending' ? data : null;
  }

  async getPayout(w: Wedding): Promise<PayoutAccount> {
    if (this.simulated(w)) return this.demo.getPayout(w);
    return invokeFunction<PayoutAccount>(this.client, FN.linkedAccount, { weddingId: w.id, action: 'status' });
  }

  async savePayout(w: Wedding, form: PayoutForm): Promise<PayoutAccount> {
    if (this.simulated(w)) return this.demo.savePayout(w, form);
    return invokeFunction<PayoutAccount>(this.client, FN.linkedAccount, { weddingId: w.id, action: 'save', form });
  }

  async simulateApproval(w: Wedding): Promise<PayoutAccount> {
    if (!this.simulated(w)) throw new Error('Only the sample wedding can simulate approval.');
    return this.demo.simulateApproval(w);
  }
}
