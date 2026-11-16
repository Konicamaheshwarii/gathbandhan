// razorpay-webhook: Razorpay calls this server to server, so payments confirm even when the
// guest closes the tab. The X-Razorpay-Signature header must equal HMAC_SHA256(raw body,
// webhook secret). Every update is conditional, so repeated deliveries change nothing.
// Deploy with JWT verification off (Razorpay sends no Supabase token).
import { admin, env, serve } from '../_shared/edge.ts';
import { interpretWebhook, verifyWebhookSignature } from '../_shared/razorpay-core.ts';

const ok = (body: Record<string, unknown> = { ok: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  const raw = await req.text();
  if (!(await verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'), env('RAZORPAY_WEBHOOK_SECRET')))) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return ok({ ignored: 'unreadable' });
  }
  const action = interpretWebhook(body);
  const db = admin();

  switch (action.kind) {
    case 'paid': {
      // pending or failed (a retry that later succeeded) becomes paid; paid stays as it was.
      const { error } = await db
        .from('shagun_contributions')
        .update({ status: 'paid', razorpay_payment_id: action.paymentId, paid_at: new Date().toISOString(), failure_reason: null })
        .eq('provider', 'razorpay')
        .eq('razorpay_order_id', action.orderId)
        .neq('status', 'paid');
      if (error) throw new Error(`update failed: ${error.code}`); // 500 makes Razorpay retry
      return ok();
    }
    case 'failed': {
      const { error } = await db
        .from('shagun_contributions')
        .update({ status: 'failed', failure_reason: action.reason })
        .eq('provider', 'razorpay')
        .eq('razorpay_order_id', action.orderId)
        .eq('status', 'pending');
      if (error) throw new Error(`update failed: ${error.code}`);
      return ok();
    }
    case 'account': {
      const { error } = await db
        .from('shagun_payout_accounts')
        .update({ status: action.status })
        .eq('razorpay_account_id', action.accountId);
      if (error) throw new Error(`update failed: ${error.code}`);
      return ok();
    }
    case 'transfer':
      // Settlement to the couple's bank is Razorpay's job; a failed transfer is visible in the
      // Razorpay dashboard (Route → Transfers). Only ids are logged, never personal details.
      if (action.status === 'failed') console.warn('Route transfer failed:', action.transferId, action.accountId);
      return ok();
    default:
      return ok({ ignored: action.event });
  }
}, { cors: false });
