// Deno-free checks of the Razorpay core with Node's own crypto as the reference.
// Run: node --test supabase/functions/_shared/razorpay-core.node-test.mjs   (Node 22.18+)
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  feeBreakdown, hmacSha256Hex, interpretWebhook, isAllowedOrigin, timingSafeEqual, validateOrderInput,
  verifyPaymentSignature, verifyWebhookSignature,
} from './razorpay-core.ts';

const nodeHmac = (key, msg) => createHmac('sha256', key).update(msg).digest('hex');

test('HMAC-SHA256 matches RFC 4231 test case 2 and node:crypto', async () => {
  assert.equal(await hmacSha256Hex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  for (const [k, m] of [['s3cr3t', 'order_ABC123|pay_XYZ789'], ['k', ''], ['ключ', 'शगुन ₹2100']]) {
    assert.equal(await hmacSha256Hex(k, m), nodeHmac(k, m));
  }
});

test('payment signature: accepts the real one, rejects tampering', async () => {
  const secret = 'test_key_secret_123';
  const r = { razorpay_order_id: 'order_9A33XWu170gUtm', razorpay_payment_id: 'pay_29QQoUBi66xm2f' };
  const good = { ...r, razorpay_signature: nodeHmac(secret, `${r.razorpay_order_id}|${r.razorpay_payment_id}`) };
  assert.equal(await verifyPaymentSignature(good, secret), true);
  assert.equal(await verifyPaymentSignature({ ...good, razorpay_payment_id: 'pay_29QQoUBi66xm2g' }, secret), false);
  assert.equal(await verifyPaymentSignature(good, 'other_secret'), false);
  assert.equal(await verifyPaymentSignature(good, ''), false);
});

test('webhook signature over the raw body', async () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_29QQoUBi66xm2f', order_id: 'order_9A33XWu170gUtm', amount: 210000 } } } });
  const sig = nodeHmac('whsec', body);
  assert.equal(await verifyWebhookSignature(body, sig, 'whsec'), true);
  assert.equal(await verifyWebhookSignature(body + ' ', sig, 'whsec'), false);
  assert.equal(await verifyWebhookSignature(body, null, 'whsec'), false);
  assert.deepEqual(interpretWebhook(JSON.parse(body)), { kind: 'paid', orderId: 'order_9A33XWu170gUtm', paymentId: 'pay_29QQoUBi66xm2f', amountPaise: 210000 });
});

test('constant-time compare, order validation, fees and CORS', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'abcd'), false);
  assert.equal(validateOrderInput({ slug: 'a-weds-b', goalId: 'g1', amount: 100001, guestName: 'Pooja' }).ok, false);
  assert.equal(validateOrderInput({ slug: 'a-weds-b', goalId: 'g1', amount: 2100, guestName: 'Pooja', phone: '98765 43210' }).ok, true);
  const f = feeBreakdown(2100, 'guest');
  assert.equal(f.payoutPaise, 210000);
  assert.ok(f.totalPaise - Math.ceil((f.totalPaise * 236) / 10000) >= 210000 - 1);
  assert.equal(isAllowedOrigin('https://konicamaheshwarii.github.io'), true);
  assert.equal(isAllowedOrigin('http://localhost:4302'), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);
});
