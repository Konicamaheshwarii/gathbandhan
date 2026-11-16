// razorpay-linked-account: the couple's payout onboarding (Razorpay Route linked account).
// Couple only: the caller's Supabase session token is checked and their email must own the
// wedding. Bank account and PAN go to Razorpay and are never stored or logged; the database
// keeps only the account ids, the status and the last four characters.
//
// Body: { weddingId, action: 'status' }            -> current status (refreshed from Razorpay)
//       { weddingId, action: 'save', form: {...} }  -> creates or updates the linked account
// Deploy with JWT verification off; this function verifies the token itself.
import { HttpError, admin, env, isRazorpayError, json, razorpay, serve } from '../_shared/edge.ts';
import {
  type PayoutStatus, isAllowedOrigin, isTestKey, lastChars, linkedAccountRequests, mapAccountStatus, requirementsText, validatePayoutForm,
} from '../_shared/razorpay-core.ts';

interface PayoutRow {
  wedding_id: string;
  razorpay_account_id: string | null;
  stakeholder_id: string | null;
  product_id: string | null;
  status: PayoutStatus;
  status_detail: string | null;
  route_enabled: boolean;
  legal_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  bank_last4: string | null;
  ifsc: string | null;
  pan_last4: string | null;
  updated_at?: string;
}

const view = (r: PayoutRow | null) => r
  ? {
      status: r.status,
      detail: r.status_detail ?? '',
      routeEnabled: r.route_enabled,
      accountId: r.razorpay_account_id,
      legalName: r.legal_name ?? '',
      email: r.contact_email ?? '',
      phone: r.contact_phone ?? '',
      bankLast4: r.bank_last4 ?? '',
      ifsc: r.ifsc ?? '',
      panLast4: r.pan_last4 ?? '',
      updatedAt: r.updated_at ?? null,
    }
  : { status: 'not_set_up' as PayoutStatus, detail: '', routeEnabled: true };

serve(async (req, origin) => {
  if (!isAllowedOrigin(origin)) throw new HttpError(403, 'Origin not allowed');
  const db = admin();

  // ---- who is calling, and do they own this wedding?
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const email = auth.user?.email?.toLowerCase();
  if (!email) throw new HttpError(401, 'Please sign in as the couple.');
  const body = await req.json().catch(() => null) as { weddingId?: unknown; action?: unknown; form?: unknown } | null;
  const weddingId = typeof body?.weddingId === 'string' ? body.weddingId : '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(weddingId)) throw new HttpError(400, 'Unknown wedding.');
  const { data: owner } = await db.from('shagun_wedding_owners').select('email').eq('wedding_id', weddingId).eq('email', email).maybeSingle();
  if (!owner) throw new HttpError(403, 'Only the couple can set up payouts for this page.');

  const { data: existing } = await db.from('shagun_payout_accounts').select('*').eq('wedding_id', weddingId).maybeSingle();
  const current = existing as PayoutRow | null;
  const testMode = isTestKey(env('RAZORPAY_KEY_ID'));

  // ---- status: refresh from Razorpay when an account exists
  if (body?.action === 'status') {
    if (current?.razorpay_account_id && current.product_id) {
      try {
        const product = await razorpay('GET', `/v2/accounts/${current.razorpay_account_id}/products/${current.product_id}`);
        const status = mapAccountStatus(product['activation_status']);
        const detail = status === 'needs_info' ? `Razorpay needs: ${requirementsText(product) || 'more details'}` : '';
        const { data } = await db.from('shagun_payout_accounts').update({ status, status_detail: detail || null }).eq('wedding_id', weddingId).select('*').single();
        return json(view(data as PayoutRow), 200, origin);
      } catch (e) {
        if (!isRazorpayError(e)) throw e;
        console.warn('Status refresh failed:', e.status);
      }
    }
    return json(view(current), 200, origin);
  }

  if (body?.action !== 'save') throw new HttpError(400, 'Unknown action.');
  const parsed = validatePayoutForm(body.form);
  if (!parsed.ok) throw new HttpError(400, parsed.error);
  const form = parsed.value;
  const req4 = linkedAccountRequests(form, weddingId, Deno.env.get('RAZORPAY_ROUTE_CATEGORY') ?? 'others', Deno.env.get('RAZORPAY_ROUTE_SUBCATEGORY') ?? 'others');

  const masked = {
    wedding_id: weddingId,
    legal_name: form.legalName,
    contact_email: form.email,
    contact_phone: form.phone,
    bank_last4: lastChars(form.accountNumber),
    ifsc: form.ifsc,
    pan_last4: lastChars(form.pan),
  };

  let row: Partial<PayoutRow>;
  try {
    let accountId = current?.razorpay_account_id ?? null;
    let stakeholderId = current?.stakeholder_id ?? null;
    let productId = current?.product_id ?? null;
    if (!accountId) {
      accountId = (await razorpay<{ id: string }>('POST', '/v2/accounts', req4.account)).id;
    } else {
      const { email: _e, type: _t, reference_id: _r, business_type: _b, ...patch } = req4.account;
      await razorpay('PATCH', `/v2/accounts/${accountId}`, patch);
    }
    stakeholderId = stakeholderId
      ? (await razorpay<{ id: string }>('PATCH', `/v2/accounts/${accountId}/stakeholders/${stakeholderId}`, req4.stakeholder)).id
      : (await razorpay<{ id: string }>('POST', `/v2/accounts/${accountId}/stakeholders`, req4.stakeholder)).id;
    if (!productId) productId = (await razorpay<{ id: string }>('POST', `/v2/accounts/${accountId}/products`, req4.product)).id;
    const product = await razorpay('PATCH', `/v2/accounts/${accountId}/products/${productId}`, req4.productConfig);
    const status = mapAccountStatus(product['activation_status']);
    row = {
      ...masked,
      razorpay_account_id: accountId,
      stakeholder_id: stakeholderId,
      product_id: productId,
      status: status === 'not_set_up' ? 'under_review' : status,
      status_detail: status === 'needs_info' ? `Razorpay needs: ${requirementsText(product) || 'more details'}` : null,
      route_enabled: true,
    };
  } catch (e) {
    if (!isRazorpayError(e)) throw e;
    console.warn('Route onboarding failed:', e.status, e.description);
    if (!testMode) {
      await db.from('shagun_payout_accounts').upsert({ ...masked, status: 'needs_info', status_detail: e.description.slice(0, 480) });
      throw new HttpError(422, `Razorpay could not set up your payout account: ${e.description}`);
    }
    // Test mode without Route: payments still work end to end, but the test money stays in
    // the platform's test account instead of being transferred to the couple.
    row = {
      ...masked,
      status: 'active',
      route_enabled: false,
      status_detail: 'Test mode: Route was not available, so test payments are not transferred.',
    };
  }

  const { data, error } = await db.from('shagun_payout_accounts').upsert(row).select('*').single();
  if (error) {
    console.error('Could not save payout account:', error.code);
    throw new HttpError(500, 'Could not save your payout details. Please try again.');
  }
  return json(view(data as PayoutRow), 200, origin);
});
