import type { CheckoutResponse, PaymentState, PayoutForm, PayoutStatus } from '../../../../supabase/functions/_shared/razorpay-core';
import { Side, Wedding } from '../models';

export type { CheckoutResponse, PaymentState, PayoutForm, PayoutStatus };

/**
 * Whether Razorpay can be used for a wedding:
 * - `live`: the backend is online and the owner put a Razorpay Key ID in config.json;
 * - `simulated`: demo mode or the sample wedding, with a clearly labelled pretend checkout;
 * - `unconfigured`: the backend is online but the owner has not set Razorpay up.
 */
export type RazorpayAvailability = 'live' | 'simulated' | 'unconfigured';

export interface OrderRequest {
  goalId: string;
  amount: number;
  guestName: string;
  message: string;
  side?: Side;
  /** 91XXXXXXXXXX */
  phone?: string;
}

export interface CreatedOrder {
  orderId: string;
  keyId: string;
  /** Shagun in rupees. */
  amount: number;
  /** What Checkout charges, in paise (shagun + convenience fee). */
  amountPaise: number;
  convenienceFee: number;
  total: number;
  testMode: boolean;
  /** The order carries a Route transfer to the couple's linked account. */
  routed: boolean;
  simulated: boolean;
}

export interface PayoutAccount {
  status: PayoutStatus;
  detail: string;
  /** False only in test mode when Route could not be set up (no transfer to the couple). */
  routeEnabled: boolean;
  legalName?: string;
  email?: string;
  phone?: string;
  bankLast4?: string;
  ifsc?: string;
  panLast4?: string;
}

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  not_set_up: 'Not set up',
  under_review: 'Under review',
  active: 'Active',
  needs_info: 'Needs info',
};

/**
 * The payment server cannot be used (functions not deployed, secrets missing, offline). The
 * give page falls back to direct UPI and the couple's settings say Razorpay is being set up.
 */
export class PaymentsUnavailable extends Error {}

/** Everything the app needs from Razorpay, behind one interface (demo or Edge Functions). */
export interface PaymentGateway {
  availability(w: Wedding): RazorpayAvailability;
  /** Creates a Razorpay order and a pending contribution. Throws PaymentsUnavailable. */
  createOrder(w: Wedding, req: OrderRequest): Promise<CreatedOrder>;
  /** Server-side signature check; marks the contribution paid. */
  verify(w: Wedding, order: CreatedOrder, response: CheckoutResponse, req: OrderRequest): Promise<PaymentState>;
  /** For polling while verification is slow (the webhook may confirm it meanwhile). */
  orderStatus(w: Wedding, orderId: string): Promise<PaymentState | null>;
  /** Couple only. */
  getPayout(w: Wedding): Promise<PayoutAccount>;
  savePayout(w: Wedding, form: PayoutForm): Promise<PayoutAccount>;
  /** Demo only: pretends Razorpay approved the payout account. */
  simulateApproval?(w: Wedding): Promise<PayoutAccount>;
}

/** Rupees with paise when there are any: ₹2,150.75, ₹2,100. */
export function formatRupees(amount: number): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(amount);
}
