import { BrowserContext } from '@playwright/test';
import { SupabaseMock } from './supabase-mock';

/**
 * A stand-in for Razorpay's checkout.js, served instead of https://checkout.razorpay.com.
 * It draws a small "test mode" sheet with the choices Razorpay's own test netbanking page
 * offers (Success, Failure) and a close button, and calls the app's handler / payment.failed /
 * ondismiss exactly like the real script. The options the app passed are kept in
 * `window.__rzpOptions` for assertions. No request ever reaches Razorpay.
 */
const CHECKOUT_JS = `
(() => {
  let n = 0;
  window.__rzpOptions = [];
  class Razorpay {
    constructor(options) { this.options = options; this.handlers = {}; window.__rzpOptions.push(options); }
    on(event, cb) { this.handlers[event] = cb; }
    open() {
      const o = this.options;
      const sheet = document.createElement('div');
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-label', 'Razorpay Checkout (e2e mock)');
      sheet.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:99999;background:#fff;color:#111;padding:16px;border-top:3px solid #0c2451;font:16px sans-serif';
      sheet.innerHTML = '<p>Razorpay test mode · ₹' + (o.amount / 100) + ' · ' + o.order_id + '</p>' +
        '<button data-m="netbanking">Netbanking</button> ' +
        '<div data-bank hidden><button data-r="success">Success</button> <button data-r="failure">Failure</button></div> ' +
        '<button data-close>Close checkout</button>';
      document.body.appendChild(sheet);
      const close = () => sheet.remove();
      sheet.querySelector('[data-m]').onclick = () => { sheet.querySelector('[data-bank]').hidden = false; };
      sheet.querySelector('[data-r=success]').onclick = () => {
        close();
        n++;
        o.handler({ razorpay_order_id: o.order_id, razorpay_payment_id: 'pay_E2EMOCK' + String(n).padStart(6, '0'), razorpay_signature: 'e2e-signature' });
      };
      sheet.querySelector('[data-r=failure]').onclick = () => {
        sheet.querySelector('[data-bank]').hidden = true;
        this.handlers['payment.failed'] && this.handlers['payment.failed']({ error: { description: 'Payment failed at the test bank.' } });
      };
      sheet.querySelector('[data-close]').onclick = () => { close(); o.modal && o.modal.ondismiss && o.modal.ondismiss(); };
    }
  }
  window.Razorpay = Razorpay;
})();
`;

export async function mockCheckoutJs(context: BrowserContext): Promise<{ loads: number }> {
  const stats = { loads: 0 };
  await context.route('https://checkout.razorpay.com/v1/checkout.js', (route) => {
    stats.loads++;
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: CHECKOUT_JS });
  });
  return stats;
}

/**
 * The razorpay-create-order and razorpay-verify Edge Functions, as the deployed ones behave in
 * test mode: create a pending contribution, then mark it paid after the signature check.
 */
export function mockRazorpayFunctions(mock: SupabaseMock, opts: { feeBearer?: 'couple' | 'guest'; verifyFails?: 'unreachable' } = {}): void {
  let orders = 0;
  mock.onFunction('razorpay-create-order', (body) => {
    const w = mock.table('shagun_weddings').find((x) => x['slug'] === body['slug']);
    if (!w || w['payment_mode'] !== 'razorpay') return { status: 400, json: { error: 'This wedding does not take Razorpay payments.' } };
    const amount = Number(body['amount']);
    const guestPays = opts.feeBearer === 'guest';
    const fee = guestPays ? Math.round(amount * 0.0236 * 100) / 100 : 0;
    const orderId = `order_E2EMOCK${String(++orders).padStart(4, '0')}`;
    mock.table('shagun_contributions').push({
      id: crypto.randomUUID(), wedding_id: w['id'], goal_id: body['goalId'], guest_name: body['guestName'], amount, message: body['message'] ?? '',
      phone: body['phone'] ?? null, side: body['side'] ?? null, status: 'pending', thanked_at: null, created_at: new Date().toISOString(),
      provider: 'razorpay', razorpay_order_id: orderId, razorpay_payment_id: null, charged_amount: amount + fee, guest_fee: fee, fee_amount: null, paid_at: null,
    });
    return { json: { orderId, keyId: 'rzp_test_E2EMockKey123', amount, amountPaise: Math.round((amount + fee) * 100), convenienceFee: fee, total: amount + fee, testMode: true, routed: true } };
  });
  mock.onFunction('razorpay-verify', (body) => {
    if (opts.verifyFails === 'unreachable') return { status: 503, json: {} };
    const c = mock.table('shagun_contributions').find((x) => x['razorpay_order_id'] === body['razorpay_order_id']);
    if (!c || body['razorpay_signature'] !== 'e2e-signature') return { status: 400, json: { error: 'Signature mismatch.' } };
    c['status'] = 'paid';
    c['razorpay_payment_id'] = body['razorpay_payment_id'];
    c['paid_at'] = new Date().toISOString();
    c['fee_amount'] = Math.round(Number(c['amount']) * 0.0236 * 100) / 100;
    mock.emitChange('shagun_contributions', 'UPDATE', c);
    return { json: { status: 'paid' } };
  });
}
