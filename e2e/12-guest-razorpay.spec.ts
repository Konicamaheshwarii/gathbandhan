import { SAMPLE, expect, test } from './fixtures';
import { test as live } from './live-fixtures';
import { mockCheckoutJs, mockRazorpayFunctions } from './support/razorpay-mock';
import { LIVE_ID, LIVE_SLUG, liveTables } from './support/live-data';

// FLOWS.md › G6 Give shagun by Razorpay, G7 The wall shows ✓ Paid
async function fillDetails(page: import('@playwright/test').Page, name: string, amount: string, message = ''): Promise<void> {
  await page.getByRole('button', { name: amount, exact: true }).click();
  await page.getByLabel('Your name').fill(name);
  if (message) await page.getByLabel(/Message for the wall/).fill(message);
  await page.getByRole('button', { name: /^Continue to pay/ }).click();
}

test.describe('Razorpay, simulated checkout (demo sample in Razorpay mode)', () => {
  test('guest pays the fee; a failed attempt, a retry, then ✓ Paid on the wall @desktop', async ({ page, go }) => {
    await go(`/w/${SAMPLE.hetal.slug}/give`);
    await expect(page.getByText(/A convenience fee of ₹[\d.,]+ is added/)).toBeVisible();
    await fillDetails(page, 'Nirali Desai', '₹2,100', 'Khub khub abhinandan! 🌸');

    await expect(page.getByRole('note').filter({ hasText: 'Demo · test mode, no real money' })).toBeVisible();
    await expect(page.locator('.fee-lines')).toContainText('Convenience fee');
    const total = (await page.locator('.pay-amount').textContent())!.trim();
    expect(total).toMatch(/^₹2,1\d\d(\.\d\d)?$/);
    await expect(page.getByText('success@razorpay')).toBeVisible();

    await page.getByRole('button', { name: `Pay ${total} securely` }).click();
    const checkout = page.getByRole('dialog');
    await expect(checkout.getByText('DEMO · simulated test-mode checkout · no real money')).toBeVisible();
    await checkout.getByRole('tab', { name: /Netbanking/ }).click();
    await checkout.getByRole('button', { name: 'Simulate a failed payment' }).click();
    await expect(page.getByRole('alert')).toContainText('No money was taken; you can try again.');

    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Pay ${total}` }).click();
    await expect(page.getByRole('status').filter({ hasText: '✓ Payment confirmed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Nirali!' })).toBeVisible();
    await expect(page.locator('section.done code').first()).toHaveText(/^pay_/);

    await page.getByRole('link', { name: 'See the blessing wall' }).click();
    const first = page.locator('section.wall li.blessing').first();
    await expect(first).toContainText('Khub khub abhinandan!');
    await expect(first.locator('.paid-chip')).toHaveText('✓ Paid');
  });

  test('closing the checkout charges nothing and offers to try again, or to pay by UPI instead', async ({ page, go }) => {
    await go(`/w/${SAMPLE.meenakshi.slug}/give`);
    await fillDetails(page, 'Sundar Iyer', '₹501');
    await page.getByRole('button', { name: /securely$/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close checkout' }).click();
    await expect(page.getByRole('alert')).toHaveText('You closed the payment window. Nothing was charged; you can try again.');
    await page.getByRole('button', { name: 'Pay by UPI directly instead' }).click();
    await expect(page.getByText(/Paying .* directly/)).toBeVisible();
    await expect(page.getByRole('button', { name: "I've paid ₹501" })).toBeVisible();
  });
});

live.describe('Razorpay through the Edge Functions (online mode; Supabase and checkout.js mocked)', () => {
  live.use({ mockOptions: { tables: liveTables({ wedding: { payment_mode: 'razorpay', fee_bearer: 'couple', razorpay_active: true } }) } });

  live('Netbanking → Success: order, checkout, server verification, ✓ Paid on the wall @desktop', async ({ page, go, supa, context }) => {
    const checkout = await mockCheckoutJs(context);
    mockRazorpayFunctions(supa);
    await go(`/w/${LIVE_SLUG}/give`);
    await fillDetails(page, 'Pallavi Hegde', '₹5,100', 'Coorg pics please!');
    await expect(page.getByRole('note').filter({ hasText: 'Test mode, no real money' })).toBeVisible();
    await page.getByRole('button', { name: 'Pay ₹5,100 securely' }).click();

    const rzp = page.getByRole('dialog', { name: 'Razorpay Checkout (e2e mock)' });
    await expect(rzp).toContainText('order_E2EMOCK0001');
    const opts = await page.evaluate(() => (window as unknown as { __rzpOptions: Record<string, unknown>[] }).__rzpOptions[0]);
    expect(opts).toMatchObject({ key: 'rzp_test_E2EMockKey123', amount: 510000, currency: 'INR', order_id: 'order_E2EMOCK0001', prefill: { name: 'Pallavi Hegde' } });
    await rzp.getByRole('button', { name: 'Netbanking' }).click();
    await rzp.getByRole('button', { name: 'Success' }).click();

    await expect(page.getByRole('status').filter({ hasText: '✓ Payment confirmed' })).toBeVisible();
    await expect(page.locator('section.done')).toContainText('pay_E2EMOCK000001');
    expect(checkout.loads).toBe(1);
    const create = supa.functionCalls.find((c) => c.name === 'razorpay-create-order')!;
    expect(create.body).toMatchObject({ slug: LIVE_SLUG, goalId: 'g-trip', amount: 5100, guestName: 'Pallavi Hegde', message: 'Coorg pics please!' });
    const verify = supa.functionCalls.find((c) => c.name === 'razorpay-verify')!;
    expect(verify.body).toEqual({ razorpay_order_id: 'order_E2EMOCK0001', razorpay_payment_id: 'pay_E2EMOCK000001', razorpay_signature: 'e2e-signature' });
    expect(supa.tables['shagun_contributions'].find((c) => c['razorpay_order_id'] === 'order_E2EMOCK0001')!['status']).toBe('paid');

    await page.getByRole('link', { name: 'See the blessing wall' }).click();
    const first = page.locator('section.wall li.blessing').first();
    await expect(first).toContainText('Coorg pics please!');
    await expect(first.locator('.paid-chip')).toHaveText('✓ Paid');
  });

  live('a failed payment, then a retry on the same order', async ({ page, go, supa, context }) => {
    await mockCheckoutJs(context);
    mockRazorpayFunctions(supa);
    await go(`/w/${LIVE_SLUG}/give`);
    await fillDetails(page, 'Rahul Bansal', '₹1,100');
    await page.getByRole('button', { name: 'Pay ₹1,100 securely' }).click();
    const rzp = page.getByRole('dialog', { name: 'Razorpay Checkout (e2e mock)' });
    await rzp.getByRole('button', { name: 'Netbanking' }).click();
    await rzp.getByRole('button', { name: 'Failure' }).click();
    await rzp.getByRole('button', { name: 'Close checkout' }).click();
    await expect(page.getByRole('alert')).toHaveText('Payment failed at the test bank. No money was taken; you can try again.');
    // Pending and failed attempts never show on the wall or in the totals.
    expect(supa.tables['shagun_contributions'].find((c) => c['guest_name'] === 'Rahul Bansal')!['status']).toBe('pending');

    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('dialog', { name: 'Razorpay Checkout (e2e mock)' }).getByRole('button', { name: 'Netbanking' }).click();
    await page.getByRole('dialog', { name: 'Razorpay Checkout (e2e mock)' }).getByRole('button', { name: 'Success' }).click();
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Rahul!' })).toBeVisible();
    expect(supa.functionCalls.filter((c) => c.name === 'razorpay-create-order')).toHaveLength(1);
  });

  live('slow verification: the page polls the order until the webhook marks it paid', async ({ page, go, supa, context }) => {
    await mockCheckoutJs(context);
    mockRazorpayFunctions(supa, { verifyFails: 'unreachable' });
    await go(`/w/${LIVE_SLUG}/give`);
    await fillDetails(page, 'Webhook Wala', '₹501');
    await page.getByRole('button', { name: 'Pay ₹501 securely' }).click();
    await page.getByRole('dialog', { name: 'Razorpay Checkout (e2e mock)' }).getByRole('button', { name: 'Netbanking' }).click();
    await page.getByRole('dialog', { name: 'Razorpay Checkout (e2e mock)' }).getByRole('button', { name: 'Success' }).click();
    await expect(page.getByText('Confirming your payment…')).toBeVisible();
    // The webhook confirms the payment on the server.
    const row = supa.tables['shagun_contributions'].find((c) => c['guest_name'] === 'Webhook Wala')!;
    row['status'] = 'paid';
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Webhook!' })).toBeVisible({ timeout: 15_000 });
    expect(supa.calls).toContain('RPC shagun_order_status');
  });

  live('falls back to direct UPI when the payment functions are not deployed', async ({ page, go, supa, context }) => {
    const checkout = await mockCheckoutJs(context);
    await go(`/w/${LIVE_SLUG}/give`);
    await fillDetails(page, 'Fallback Fufa', '₹1,100');
    await page.getByRole('button', { name: 'Pay ₹1,100 securely' }).click();
    await expect(page.getByRole('note').filter({ hasText: 'Card and netbanking payments are still being set up.' })).toBeVisible();
    await page.getByRole('button', { name: "I've paid ₹1,100" }).click();
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Fallback!' })).toBeVisible();
    expect(checkout.loads).toBe(0);
    expect(supa.tables['shagun_contributions'].find((c) => c['guest_name'] === 'Fallback Fufa')).toMatchObject({ status: 'guest-confirmed', wedding_id: LIVE_ID });
  });
});
