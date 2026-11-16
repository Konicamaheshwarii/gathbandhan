import {
  corsHeaders, feeBreakdown, hmacSha256Hex, interpretWebhook, isAllowedOrigin, isCheckoutResponse, isTestKey, lastChars,
  linkedAccountRequests, mapAccountStatus, normalizePhone, orderRequest, payoutFormErrors, timingSafeEqual, validateOrderInput,
  validatePayoutForm, verifyPaymentSignature, verifyWebhookSignature,
} from '../../../../supabase/functions/_shared/razorpay-core';

/** Known-answer vectors: RFC 4231 and values computed with Node's crypto.createHmac. */
const ORDER = 'order_9A33XWu170gUtm';
const PAYMENT = 'pay_29QQoUBi66xm2f';
const KEY_SECRET = 'rzp_test_secret_K3y';
const PAYMENT_SIG = 'd23ccd327014e18cdb984fd0b231b89d47c0e70f3d737682817b489c12277194';
const WEBHOOK_SECRET = 'whsec_test_123';
const WEBHOOK_BODY = `{"event":"payment.captured","payload":{"payment":{"entity":{"id":"${PAYMENT}","order_id":"${ORDER}","amount":210000}}}}`;
const WEBHOOK_SIG = '6b14064c72bc66ba92de36ef967e0b7110afd23087a926bcf47bc895f8d5fa2a';

describe('Razorpay core', () => {
  describe('HMAC-SHA256', () => {
    it('matches RFC 4231 test cases 1 and 2', async () => {
      expect(await hmacSha256Hex('\x0b'.repeat(20), 'Hi There')).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
      expect(await hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    });

    it('compares in constant time and handles different lengths', () => {
      expect(timingSafeEqual('abcdef', 'abcdef')).toBeTrue();
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBeFalse();
      expect(timingSafeEqual('abcdef', 'abcde')).toBeFalse();
      expect(timingSafeEqual('', '')).toBeTrue();
    });
  });

  describe('checkout signature', () => {
    const response = { razorpay_order_id: ORDER, razorpay_payment_id: PAYMENT, razorpay_signature: PAYMENT_SIG };

    it('accepts HMAC(order_id|payment_id, key secret)', async () => {
      expect(await verifyPaymentSignature(response, KEY_SECRET)).toBeTrue();
      expect(await verifyPaymentSignature({ ...response, razorpay_signature: PAYMENT_SIG.toUpperCase() }, KEY_SECRET)).toBeTrue();
    });

    it('rejects a wrong secret, a swapped payment, a bad signature or an empty secret', async () => {
      expect(await verifyPaymentSignature(response, 'another_secret')).toBeFalse();
      expect(await verifyPaymentSignature({ ...response, razorpay_payment_id: 'pay_29QQoUBi66xm2g' }, KEY_SECRET)).toBeFalse();
      expect(await verifyPaymentSignature({ ...response, razorpay_signature: '0'.repeat(64) }, KEY_SECRET)).toBeFalse();
      expect(await verifyPaymentSignature(response, '')).toBeFalse();
    });

    it('only accepts well-formed checkout responses', () => {
      expect(isCheckoutResponse({ razorpay_order_id: ORDER, razorpay_payment_id: PAYMENT, razorpay_signature: PAYMENT_SIG })).toBeTrue();
      expect(isCheckoutResponse({ razorpay_order_id: "order_x' or 1=1", razorpay_payment_id: PAYMENT, razorpay_signature: PAYMENT_SIG })).toBeFalse();
      expect(isCheckoutResponse({ razorpay_order_id: ORDER, razorpay_payment_id: PAYMENT, razorpay_signature: 'short' })).toBeFalse();
      expect(isCheckoutResponse(null)).toBeFalse();
    });
  });

  describe('webhooks', () => {
    it('verifies X-Razorpay-Signature over the exact raw body', async () => {
      expect(await verifyWebhookSignature(WEBHOOK_BODY, WEBHOOK_SIG, WEBHOOK_SECRET)).toBeTrue();
      expect(await verifyWebhookSignature(WEBHOOK_BODY + '\n', WEBHOOK_SIG, WEBHOOK_SECRET)).toBeFalse();
      expect(await verifyWebhookSignature(JSON.stringify(JSON.parse(WEBHOOK_BODY), null, 2), WEBHOOK_SIG, WEBHOOK_SECRET)).toBeFalse();
      expect(await verifyWebhookSignature(WEBHOOK_BODY, WEBHOOK_SIG, 'wrong')).toBeFalse();
      expect(await verifyWebhookSignature(WEBHOOK_BODY, null, WEBHOOK_SECRET)).toBeFalse();
      expect(await verifyWebhookSignature(WEBHOOK_BODY, WEBHOOK_SIG, '')).toBeFalse();
    });

    it('turns events into idempotent actions', () => {
      expect(interpretWebhook(JSON.parse(WEBHOOK_BODY))).toEqual({ kind: 'paid', orderId: ORDER, paymentId: PAYMENT, amountPaise: 210000 });
      expect(interpretWebhook({
        event: 'order.paid',
        payload: { order: { entity: { id: ORDER, amount_paid: 210000 } }, payment: { entity: { id: PAYMENT, order_id: ORDER, amount: 210000 } } },
      })).toEqual({ kind: 'paid', orderId: ORDER, paymentId: PAYMENT, amountPaise: 210000 });
      expect(interpretWebhook({ event: 'payment.failed', payload: { payment: { entity: { id: PAYMENT, order_id: ORDER, error_description: 'Bank declined' } } } }))
        .toEqual({ kind: 'failed', orderId: ORDER, paymentId: PAYMENT, reason: 'Bank declined' });
      expect(interpretWebhook({ event: 'transfer.processed', payload: { transfer: { entity: { id: 'trf_1', source: PAYMENT, recipient: 'acc_ABC123' } } } }))
        .toEqual({ kind: 'transfer', transferId: 'trf_1', source: PAYMENT, accountId: 'acc_ABC123', status: 'processed' });
      expect(interpretWebhook({ event: 'account.activated', payload: { account: { entity: { id: 'acc_ABC123' } } } }))
        .toEqual({ kind: 'account', accountId: 'acc_ABC123', status: 'active', detail: '' });
      expect(interpretWebhook({ event: 'refund.created' })).toEqual({ kind: 'ignore', event: 'refund.created' });
      expect(interpretWebhook('garbage')).toEqual({ kind: 'ignore', event: '' });
    });

    it('maps Route activation statuses to what the couple sees', () => {
      expect(mapAccountStatus('activated')).toBe('active');
      expect(mapAccountStatus('needs_clarification')).toBe('needs_info');
      expect(mapAccountStatus('under_review')).toBe('under_review');
      expect(mapAccountStatus('requested')).toBe('under_review');
      expect(mapAccountStatus(undefined)).toBe('not_set_up');
    });
  });

  describe('order input', () => {
    const good = { slug: 'riya-weds-arjun-2', goalId: 'g1', amount: 2100, guestName: '  Pooja   Bua ', message: ' Khoob ghoomo! ', side: 'bride', phone: '+91 98765 43210' };

    it('normalises a valid request', () => {
      const r = validateOrderInput(good);
      expect(r).toEqual({ ok: true, value: { slug: 'riya-weds-arjun-2', goalId: 'g1', amount: 2100, guestName: 'Pooja Bua', message: 'Khoob ghoomo!', side: 'bride', phone: '919876543210' } });
    });

    it('rejects amounts outside ₹1 to ₹1,00,000 and fractional rupees', () => {
      for (const amount of [0, -5, 100_001, 21.5, '2100', NaN]) expect(validateOrderInput({ ...good, amount }).ok).withContext(String(amount)).toBeFalse();
      expect(validateOrderInput({ ...good, amount: 1 }).ok).toBeTrue();
      expect(validateOrderInput({ ...good, amount: 100_000 }).ok).toBeTrue();
    });

    it('enforces name, message, side, phone and slug limits', () => {
      expect(validateOrderInput({ ...good, guestName: 'A' }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, guestName: 'x'.repeat(81) }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, message: 'x'.repeat(281) }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, message: 'x'.repeat(280) }).ok).toBeTrue();
      expect(validateOrderInput({ ...good, message: 42 }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, side: 'both' }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, phone: '12345' }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, slug: '../etc' }).ok).toBeFalse();
      expect(validateOrderInput({ ...good, goalId: '' }).ok).toBeFalse();
      expect(validateOrderInput(null).ok).toBeFalse();
    });

    it('normalises Indian phone numbers', () => {
      expect(normalizePhone('09876543210')).toBe('919876543210');
      expect(normalizePhone('')).toBeNull();
      expect(normalizePhone('5876543210')).toBeUndefined();
    });
  });

  describe('fees and the Route transfer', () => {
    it('couple bears fees: the guest pays the shagun, the couple receives it minus about 2.36%', () => {
      const f = feeBreakdown(2100, 'couple');
      expect(f).toEqual({ amountPaise: 210000, convenienceFeePaise: 0, totalPaise: 210000, gatewayFeePaise: 4956, platformFeePaise: 0, payoutPaise: 205044 });
    });

    it('guest bears fees: a convenience fee is added so the couple receives the full shagun', () => {
      const f = feeBreakdown(2100, 'guest');
      expect(f.payoutPaise).toBe(210000);
      expect(f.totalPaise).toBe(215076);
      expect(f.convenienceFeePaise).toBe(5076);
      // What remains after Razorpay's 2.36% still covers the transfer.
      expect(f.totalPaise - Math.ceil((f.totalPaise * 236) / 10_000)).toBeGreaterThanOrEqual(f.payoutPaise - 1);
    });

    it('applies a platform fee when configured and is 0 by default', () => {
      expect(feeBreakdown(1000, 'guest').platformFeePaise).toBe(0);
      expect(feeBreakdown(1000, 'guest', 236, 100).payoutPaise).toBe(99_000);
    });

    it('builds an order with notes and a transfer to the linked account', () => {
      const input = validateOrderInput({ slug: 'a-weds-b', goalId: 'g1', amount: 2100, guestName: 'Pooja' });
      if (!input.ok) throw new Error(input.error);
      const fees = feeBreakdown(2100, 'guest');
      const body = orderRequest({ input: input.value, weddingId: 'w1', couple: 'A & B', fees, linkedAccountId: 'acc_ABC123', receipt: 'sg_' + 'x'.repeat(60) });
      expect(body['amount']).toBe(215076);
      expect(body['currency']).toBe('INR');
      expect((body['receipt'] as string).length).toBe(40);
      expect(body['transfers']).toEqual([jasmine.objectContaining({ account: 'acc_ABC123', amount: 210000, currency: 'INR', on_hold: false })]);
      // Test mode without Route: no transfer at all.
      expect(orderRequest({ input: input.value, weddingId: 'w1', couple: 'A & B', fees, linkedAccountId: null, receipt: 'r' })['transfers']).toBeUndefined();
    });
  });

  describe('payout onboarding', () => {
    const form = {
      legalName: 'Riya Sharma', email: 'Riya@Example.com', phone: '+91 98765 43210', pan: 'abcde1234f', accountNumber: '1234 5678 9012',
      ifsc: 'hdfc0001234', beneficiaryName: 'Riya Sharma', street: '12 MG Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001',
    };

    it('validates and normalises the form', () => {
      const r = validatePayoutForm(form);
      expect(r.ok).toBeTrue();
      if (r.ok) expect(r.value).toEqual(jasmine.objectContaining({ email: 'riya@example.com', phone: '9876543210', pan: 'ABCDE1234F', accountNumber: '123456789012', ifsc: 'HDFC0001234', state: 'MAHARASHTRA' }));
      expect(Object.keys(payoutFormErrors({ ...form, pan: 'ABC', ifsc: 'HDFC1234', postalCode: '011001' }))).toEqual(['pan', 'ifsc', 'postalCode']);
    });

    it('keeps only the last four characters of bank account and PAN', () => {
      expect(lastChars('1234 5678 9012')).toBe('9012');
      expect(lastChars('ABCDE1234F')).toBe('234F');
    });

    it('builds the Route linked-account, stakeholder and settlement requests', () => {
      const r = validatePayoutForm(form);
      if (!r.ok) throw new Error(r.error);
      const req = linkedAccountRequests(r.value, 'wedding-123');
      expect(req.account).toEqual(jasmine.objectContaining({ type: 'route', business_type: 'individual', reference_id: 'wedding-123', email: 'riya@example.com' }));
      expect(req.stakeholder).toEqual({ name: 'Riya Sharma', email: 'riya@example.com', kyc: { pan: 'ABCDE1234F' } });
      expect(req.productConfig).toEqual({ settlements: { account_number: '123456789012', ifsc_code: 'HDFC0001234', beneficiary_name: 'Riya Sharma' }, tnc_accepted: true });
    });
  });

  describe('keys and CORS', () => {
    it('tells test keys from live keys', () => {
      expect(isTestKey('rzp_test_U0ji8fNKqRx1PE')).toBeTrue();
      expect(isTestKey('rzp_live_U0ji8fNKqRx1PE')).toBeFalse();
      expect(isTestKey('')).toBeFalse();
    });

    it('allows only the Pages site and localhost', () => {
      expect(isAllowedOrigin('https://konicamaheshwarii.github.io')).toBeTrue();
      expect(isAllowedOrigin('http://localhost')).toBeTrue();
      expect(isAllowedOrigin('http://localhost:4302')).toBeTrue();
      expect(isAllowedOrigin('https://konicamaheshwarii.github.io.evil.com')).toBeFalse();
      expect(isAllowedOrigin('http://localhost.evil.com')).toBeFalse();
      expect(isAllowedOrigin('https://localhost:4200')).toBeFalse();
      expect(isAllowedOrigin(null)).toBeFalse();
      expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBeUndefined();
      expect(corsHeaders('http://localhost:4200')['Access-Control-Allow-Origin']).toBe('http://localhost:4200');
    });
  });
});
