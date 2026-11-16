// razorpay-create-order: a guest starts a Razorpay payment for a shagun.
// Validates against the database, creates a Razorpay order whose Route transfer sends the
// couple's share to their linked account, records a "pending" contribution, and returns what
// Razorpay Checkout needs. Deploy with JWT verification off (guests are not signed in).
import { HttpError, admin, env, isRazorpayError, json, razorpay, serve } from '../_shared/edge.ts';
import {
  type FeeBearer, feeBreakdown, isAllowedOrigin, isTestKey, orderRequest, paiseToRupees, validateOrderInput,
} from '../_shared/razorpay-core.ts';

serve(async (req, origin) => {
  if (!isAllowedOrigin(origin)) throw new HttpError(403, 'Origin not allowed');
  const parsed = validateOrderInput(await req.json().catch(() => null));
  if (!parsed.ok) throw new HttpError(400, parsed.error);
  const input = parsed.value;

  const keyId = env('RAZORPAY_KEY_ID');
  env('RAZORPAY_KEY_SECRET'); // fail early (503) when the secret is missing
  const testMode = isTestKey(keyId);
  const db = admin();

  const { data: w } = await db
    .from('shagun_weddings')
    .select('id, partner1, partner2, payment_mode, fee_bearer, details')
    .eq('slug', input.slug)
    .maybeSingle();
  if (!w) throw new HttpError(404, 'We could not find this wedding page.');
  if (w.payment_mode !== 'razorpay') throw new HttpError(409, 'This couple takes shagun by UPI directly.');
  const goals: { id?: string }[] = Array.isArray(w.details?.goals) ? w.details.goals : [];
  if (!goals.some((g) => g.id === input.goalId)) throw new HttpError(400, 'This dream is not on the wedding page.');

  const { data: account } = await db
    .from('shagun_payout_accounts')
    .select('razorpay_account_id, status, route_enabled')
    .eq('wedding_id', w.id)
    .maybeSingle();
  const routed = account?.status === 'active' && account.route_enabled && account.razorpay_account_id ? account.razorpay_account_id as string : null;
  // Live payments must settle to the couple. Test mode may run without Route (no real money).
  if (!routed && !testMode) throw new HttpError(409, "The couple's payout account is not active yet. Please pay by UPI for now.");

  const fees = feeBreakdown(
    input.amount,
    (w.fee_bearer === 'guest' ? 'guest' : 'couple') as FeeBearer,
    Number(Deno.env.get('GATEWAY_FEE_BPS') ?? 236),
    Number(Deno.env.get('PLATFORM_FEE_BPS') ?? 0),
  );
  const receipt = `sg_${crypto.randomUUID().replace(/-/g, '').slice(0, 30)}`;

  let order: { id: string };
  try {
    order = await razorpay<{ id: string }>('POST', '/v1/orders', orderRequest({
      input,
      weddingId: w.id,
      couple: `${w.partner1} & ${w.partner2}`,
      fees,
      linkedAccountId: routed,
      receipt,
    }));
  } catch (e) {
    if (isRazorpayError(e)) {
      console.error('Razorpay order failed:', e.status, e.description);
      throw new HttpError(502, 'Razorpay could not start this payment. Please try again, or pay by UPI.');
    }
    throw e;
  }

  const contributionId = crypto.randomUUID();
  const { error } = await db.from('shagun_contributions').insert({
    id: contributionId,
    wedding_id: w.id,
    goal_id: input.goalId,
    guest_name: input.guestName,
    amount: input.amount,
    message: input.message,
    phone: input.phone,
    side: input.side,
    provider: 'razorpay',
    status: 'pending',
    razorpay_order_id: order.id,
    charged_amount: paiseToRupees(fees.totalPaise),
    guest_fee: paiseToRupees(fees.convenienceFeePaise),
    fee_amount: paiseToRupees(fees.gatewayFeePaise + fees.platformFeePaise),
  });
  if (error) {
    console.error('Could not record the pending contribution:', error.code);
    throw new HttpError(500, 'Could not start the payment. Please try again.');
  }

  return json({
    orderId: order.id,
    keyId,
    currency: 'INR',
    amount: input.amount,
    amountPaise: fees.totalPaise,
    convenienceFee: paiseToRupees(fees.convenienceFeePaise),
    total: paiseToRupees(fees.totalPaise),
    contributionId,
    testMode,
    routed: !!routed,
  }, 200, origin);
});
