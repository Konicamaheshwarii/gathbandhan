// razorpay-verify: called by the give page right after Razorpay Checkout succeeds.
// Checks razorpay_signature = HMAC_SHA256(order_id|payment_id, key secret) in constant time,
// then marks the pending contribution "paid". Safe to call twice: a paid row stays paid.
// Deploy with JWT verification off (guests are not signed in).
import { HttpError, admin, env, json, serve } from '../_shared/edge.ts';
import { isAllowedOrigin, isCheckoutResponse, verifyPaymentSignature } from '../_shared/razorpay-core.ts';

serve(async (req, origin) => {
  if (!isAllowedOrigin(origin)) throw new HttpError(403, 'Origin not allowed');
  const body = await req.json().catch(() => null);
  if (!isCheckoutResponse(body)) throw new HttpError(400, 'Missing payment details.');
  if (!(await verifyPaymentSignature(body, env('RAZORPAY_KEY_SECRET')))) {
    throw new HttpError(400, 'This payment could not be verified.');
  }

  const db = admin();
  const { data: row } = await db
    .from('shagun_contributions')
    .select('id, status, razorpay_payment_id')
    .eq('provider', 'razorpay')
    .eq('razorpay_order_id', body.razorpay_order_id)
    .maybeSingle();
  if (!row) throw new HttpError(404, 'We could not find this payment.');
  if (row.status === 'paid') return json({ status: 'paid', paymentId: row.razorpay_payment_id }, 200, origin);

  const { error } = await db
    .from('shagun_contributions')
    .update({ status: 'paid', razorpay_payment_id: body.razorpay_payment_id, paid_at: new Date().toISOString(), failure_reason: null })
    .eq('id', row.id)
    .neq('status', 'paid');
  if (error) {
    console.error('Could not mark paid:', error.code);
    throw new HttpError(500, 'Your payment went through; it will show as confirmed shortly.');
  }
  return json({ status: 'paid', paymentId: body.razorpay_payment_id }, 200, origin);
});
