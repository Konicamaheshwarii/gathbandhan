import { SAMPLE, expect, expectToast, test } from './fixtures';
import { test as live } from './live-fixtures';
import { COUPLE, LIVE_ID, LIVE_SLUG, liveTables, profileRow } from './support/live-data';

// FLOWS.md › C14 How guests pay (direct UPI or Razorpay), fee bearer and payout onboarding
// Field names of the payout form (each field's label also carries a hint, so names are steadier).
const PAYOUT = {
  legalName: 'Riya Sharma',
  email: 'riya.demo@example.com',
  phone: '9000012345',
  pan: 'ABCDE1234F',
  accountNumber: '000123456789',
  ifsc: 'HDFC0001234',
  beneficiaryName: 'Riya Sharma',
  street: '12 Lake View Road',
  city: 'Udaipur',
  state: 'Rajasthan',
  postalCode: '313001',
};

test.describe('How guests pay (demo, simulated Razorpay)', () => {
  test('switch to Razorpay, choose who pays the fee, onboard the payout account and simulate approval @desktop', async ({ page, go }) => {
    await go(`/w/${SAMPLE.riya.slug}/payments`);
    await expect(page.getByRole('heading', { name: 'How guests pay' })).toBeVisible();
    await expect(page.locator('.now')).toContainText(/UPI/);
    const modes = page.getByRole('radiogroup', { name: 'Payment mode' });
    await expect(modes.getByRole('radio', { name: /Direct UPI/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await modes.getByRole('radio', { name: /Razorpay \(instant confirmation\)/ }).click();
    await expect(modes.getByText('Test mode')).toBeVisible();
    await expect(page.getByText('Demo: the checkout is simulated', { exact: false })).toBeVisible();
    const fees = page.getByRole('radiogroup', { name: 'Who pays the fee' });
    await expect(fees.getByRole('radio', { name: /We do/ })).toContainText('you receive about');
    await fees.getByRole('radio', { name: /The guest does/ }).click();
    await expect(fees.getByRole('radio', { name: /The guest does/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Razorpay mode saved');

    // Payout onboarding: bank and PAN are never kept in full.
    const payout = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Where your shagun settles' }) });
    await expect(payout.locator('.chip.status')).toHaveText('Not set up');
    await payout.getByRole('button', { name: 'Send to Razorpay' }).click();
    await expect(payout.locator('.error-text').first()).toBeVisible();
    for (const [name, value] of Object.entries(PAYOUT)) await payout.locator(`input[name=${name}]`).fill(value);
    await payout.getByRole('button', { name: 'Send to Razorpay' }).click();
    await expectToast(page, 'Sent to Razorpay for review');
    await expect(payout.locator('.chip.status')).toHaveText('Under review');
    await expect(payout.locator('dl.summary')).toContainText('•••• 6789');
    await expect(payout.locator('dl.summary')).toContainText('••••••234F');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain('000123456789');
    expect(stored).not.toContain('ABCDE1234F');

    await payout.getByRole('button', { name: 'Demo: simulate Razorpay approval' }).click();
    await expectToast(page, 'Demo: payout account approved');
    await expect(payout.locator('.chip.status')).toHaveText('Active');

    // The give page now uses Razorpay with a convenience-fee line.
    await go(`/w/${SAMPLE.riya.slug}/give`);
    await expect(page.getByText(/A convenience fee of ₹[\d.,]+ is added/)).toBeVisible();

    // And back to direct UPI.
    await go(`/w/${SAMPLE.riya.slug}/payments`);
    await page.getByRole('radiogroup', { name: 'Payment mode' }).getByRole('radio', { name: /Direct UPI/ }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Guests will pay by UPI directly');
  });
});

live.describe('How guests pay (online mode, mocked Supabase + Edge Functions)', () => {
  live.use({ mockOptions: { user: COUPLE, tables: { ...liveTables(), shagun_profiles: [profileRow(COUPLE)] } } });

  live('saves the mode on the wedding and sends the payout form to razorpay-linked-account', async ({ page, go, supa }) => {
    supa.onFunction('razorpay-linked-account', (body) => {
      if (body['action'] === 'status') return { json: { status: 'not_set_up', detail: '', routeEnabled: true } };
      const f = body['form'] as Record<string, string>;
      return { json: { status: 'under_review', detail: 'Razorpay is checking your details.', routeEnabled: false, legalName: f['legalName'], bankLast4: f['accountNumber'].slice(-4), ifsc: f['ifsc'], panLast4: f['pan'].slice(-4) } };
    });
    await go(`/w/${LIVE_SLUG}/payments`);
    await page.getByRole('radiogroup', { name: 'Payment mode' }).getByRole('radio', { name: /Razorpay/ }).click();
    await page.getByRole('radiogroup', { name: 'Who pays the fee' }).getByRole('radio', { name: /The guest does/ }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Razorpay mode saved');
    const w = supa.tables['shagun_weddings'].find((x) => x['id'] === LIVE_ID)!;
    expect(w['payment_mode']).toBe('razorpay');
    expect(w['fee_bearer']).toBe('guest');

    const payout = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Where your shagun settles' }) });
    for (const [name, value] of Object.entries(PAYOUT)) await payout.locator(`input[name=${name}]`).fill(value);
    await payout.getByRole('button', { name: 'Send to Razorpay' }).click();
    await expectToast(page, 'Sent to Razorpay for review');
    await expect(payout.getByText('Test-only setup', { exact: false })).toBeVisible();
    const call = supa.functionCalls.find((c) => c.name === 'razorpay-linked-account' && c.body['action'] === 'save')!;
    expect(call.body['weddingId']).toBe(LIVE_ID);
    expect(call.auth).toMatch(/^Bearer /);
  });

  live('explains when the payment server is not deployed yet', async ({ page, go }) => {
    await go(`/w/${LIVE_SLUG}/payments`);
    await page.getByRole('radiogroup', { name: 'Payment mode' }).getByRole('radio', { name: /Razorpay/ }).click();
    await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Where your shagun settles' }) }).getByRole('note').first()).toBeVisible();
  });
});
