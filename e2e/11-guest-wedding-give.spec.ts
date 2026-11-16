import { readFileSync } from 'node:fs';
import { SAMPLE, expect, expectToast, lastCopied, saveDownload, test } from './fixtures';
import { test as live } from './live-fixtures';
import { LIVE_ID, LIVE_SLUG, liveTables } from './support/live-data';
import { waitForRealtime } from './support/supabase-mock';

// FLOWS.md › G4 Wedding page and blessing wall, G5 Give shagun by direct UPI, G7 The wall
const page$ = `/w/${SAMPLE.riya.slug}`;

test.describe('Wedding page (demo)', () => {
  test('hero, families, story, gallery, functions with maps and calendar, dreams and the wall @desktop', async ({ page, go }, testInfo) => {
    await go(page$);
    await expect(page.locator('h1.names')).toHaveText(/Riya\s*&\s*Arjun/);
    await expect(page.locator('.countdown')).toBeVisible();
    await expect(page.locator('.families')).toContainText('Mrs. Sunita & Mr. Rakesh Sharma');
    await expect(page.getByText('This is a sample page.', { exact: false })).toBeVisible();
    await expect(page.locator('.raised')).toHaveText(/^₹[\d,]+$/);

    await expect(page.locator('.story-text')).toContainText('delayed Pune–Delhi train');
    await expect(page.locator('app-story-timeline li')).toHaveCount(4);
    await expect(page.locator('app-gallery img')).toHaveCount(4);

    const events = page.locator('app-events-timeline');
    await expect(events.locator('li').filter({ hasText: 'Sangeet' })).toBeVisible();
    await expect(events.getByRole('link', { name: '📍 Map' }).first()).toHaveAttribute('href', /maps\.google\.com/);
    await expect(events.getByRole('link', { name: 'Google Calendar' }).first()).toHaveAttribute('href', /calendar\.google\.com/);
    const one = await saveDownload(page, () => events.getByRole('button', { name: '.ics' }).first().click(), testInfo);
    expect(one.name).toBe(`${SAMPLE.riya.slug}-haldi.ics`);
    expect(readFileSync(one.file, 'utf8').match(/BEGIN:VEVENT/g)).toHaveLength(1);
    const all = await saveDownload(page, () => events.getByRole('button', { name: '📅 Add all to calendar' }).click(), testInfo);
    expect(readFileSync(all.file, 'utf8').match(/BEGIN:VEVENT/g)).toHaveLength(5);

    const honeymoon = page.locator('article.goal').filter({ hasText: 'Honeymoon in Santorini & Amalfi' });
    await expect(honeymoon.locator('.update')).toContainText('Flights booked!');
    await expect(page.locator('article.goal').filter({ hasText: '101 trees' }).getByText('Funded 🎉')).toBeVisible();

    const wall = page.locator('section.wall');
    await expect(wall.getByText('Live')).toBeVisible();
    const shown = await wall.locator('li.blessing').count();
    expect(shown).toBeGreaterThan(0);
    // Amounts are hidden unless the couple shows them; phone numbers never appear.
    await expect(wall).not.toContainText('₹');
    await expect(wall).not.toContainText(/9000\d{6}/);
    // Paid by Razorpay, and blessings without a message, both show.
    await expect(wall.locator('.paid-chip').first()).toHaveText('✓ Paid');
    const more = wall.getByRole('button', { name: 'Show more blessings' });
    while (await more.isVisible()) await more.click();
    await expect(wall.getByText('🌼 Blessed the couple with shagun').first()).toBeVisible();

    const share = page.locator('section.share');
    await expect(share.getByRole('link', { name: /Share on WhatsApp/ })).toHaveAttribute('href', /^https:\/\/api\.whatsapp\.com\/send\?text=/);
    await share.getByRole('button', { name: 'Copy link' }).click();
    expect(await lastCopied(page)).toContain(`#/w/${SAMPLE.riya.slug}`);
    await expect(page.getByRole('link', { name: 'Open your dashboard' })).toHaveAttribute('href', `#/w/${SAMPLE.riya.slug}/dashboard`);
  });

  test('an unknown page says so kindly', async ({ page, go }) => {
    await go('/w/nobody-weds-noone');
    await expect(page.getByRole('heading', { name: 'We could not find this wedding page' })).toBeVisible();
  });
});

test.describe('Give shagun by direct UPI (demo)', () => {
  test('on a phone: validation, UPI intent link, QR, copy UPI ID, "I\'ve paid", and the wall', async ({ page, go }) => {
    await go(`${page$}`);
    await page.locator('article.goal').filter({ hasText: 'Cherry blossoms in Kyoto' }).getByRole('link', { name: 'Bless this dream' }).click();
    await expect(page).toHaveURL(new RegExp(`#/w/${SAMPLE.riya.slug}/give\\?goal=g-kyoto$`));
    await expect(page.getByRole('heading', { name: 'Bless Riya & Arjun' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Cherry blossoms in Kyoto/ })).toHaveAttribute('aria-checked', 'true');

    const amount = page.getByLabel('Or any amount');
    await amount.fill('150000');
    await page.getByRole('button', { name: /^Continue to pay/ }).click();
    await expect(page.getByRole('alert')).toContainText('UPI allows up to ₹1,00,000 in one payment');
    await amount.fill('101.5');
    await expect(page.getByRole('alert')).toContainText('Please use whole rupees.');
    await amount.fill('');
    await expect(page.getByRole('alert')).toContainText('Enter an amount in rupees.');
    await page.getByRole('button', { name: '₹1,100', exact: true }).click();
    await expect(page.getByRole('button', { name: '₹1,100', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Tell the couple who this blessing is from.')).toBeVisible();

    await page.getByLabel('Your name').fill('Kiran Joshi');
    await page.getByRole('radio', { name: "Groom's side" }).click();
    await page.getByLabel(/Message for the wall/).fill('खूब खुश रहो, ढेर सारा प्यार!');
    await expect(page.getByText(/^\d+\/280$/)).toHaveText(`${'खूब खुश रहो, ढेर सारा प्यार!'.length}/280`);
    await page.getByLabel(/WhatsApp number/).fill('90000 55001');
    await page.getByRole('button', { name: 'Continue to pay ₹1,100' }).click();

    await expect(page.getByText('Paying Riya Sharma directly')).toBeVisible();
    await expect(page.getByText('Sample page:', { exact: false })).toBeVisible();
    const intent = page.getByRole('link', { name: 'Pay ₹1,100 with a UPI app' });
    const href = await intent.getAttribute('href');
    expect(href).toMatch(/^upi:\/\/pay\?/);
    const q = new URLSearchParams(href!.split('?')[1]);
    expect(q.get('pa')).toBe('riya.arjun@demo');
    expect(q.get('am')).toBe('1100.00'); // NPCI format: two decimals
    expect(q.get('cu')).toBe('INR');
    expect(q.get('tn')).toContain('Kiran');
    await expect(page.getByRole('img', { name: /UPI QR code to pay ₹1,100 to Riya Sharma/ })).toBeVisible();
    await page.locator('.vpa-row').getByRole('button', { name: 'Copy' }).click();
    await expectToast(page, 'UPI ID copied');
    expect(await lastCopied(page)).toBe('riya.arjun@demo');

    await page.getByRole('button', { name: "I've paid ₹1,100" }).click();
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Kiran!' })).toBeVisible();
    await expect(page.locator('section.done')).toContainText('Your blessing is now on their wall.');
    await page.getByRole('link', { name: 'See the blessing wall' }).click();
    const first = page.locator('section.wall li.blessing').first();
    await expect(first).toContainText('खूब खुश रहो, ढेर सारा प्यार!');
    await expect(first).toContainText('Kiran Joshi');
    await expect(first).toContainText("Groom's side");

    // The couple sees it as guest-confirmed, to verify against the bank app.
    await go(`/w/${SAMPLE.riya.slug}/dashboard`);
    const row = page.locator('li.contribution').filter({ hasText: 'Kiran Joshi' });
    await expect(row.getByText('Guest confirmed')).toBeVisible();
    await expect(row.locator('.c-amount')).toHaveText('₹1,100');
  });

  test('a blessing without a message still shows on the wall @desktop', async ({ page, go }) => {
    await go(`${page$}/give`);
    // On a laptop there is no UPI app: the QR is the way to pay.
    await page.getByLabel('Your name').fill('Quiet Cousin');
    await page.getByRole('button', { name: /^Continue to pay/ }).click();
    if (testInfoIsDesktop(page)) await expect(page.getByRole('heading', { name: 'Scan with any UPI app' })).toBeVisible();
    await page.getByRole('button', { name: /^I've paid/ }).click();
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Quiet!' })).toBeVisible();
    await expect(page.locator('section.done')).not.toContainText('Your blessing is now on their wall.');
    await page.getByRole('link', { name: 'See the blessing wall' }).click();
    const first = page.locator('section.wall li.blessing').first();
    await expect(first).toContainText('Quiet Cousin');
    await expect(first).toContainText('🌼 Blessed the couple with shagun');
  });
});

function testInfoIsDesktop(page: import('@playwright/test').Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1000;
}

live.describe('Wedding page and direct UPI (online mode, mocked Supabase)', () => {
  live.use({ mockOptions: { tables: liveTables() } });

  live('loads from the backend, records "I\'ve paid", and the wall updates live from another guest @desktop', async ({ page, go, supa }) => {
    await go(`/w/${LIVE_SLUG}`);
    await expect(page.locator('h1.names')).toHaveText(/Kavya\s*&\s*Nikhil/);
    await expect(page.locator('.raised')).toHaveText('₹7,200');
    const wall = page.locator('section.wall');
    await expect(wall.getByText('Coorg ki coffee hamare liye bhi laana!')).toBeVisible();
    await expect(wall.getByText('🌼 Blessed the couple with shagun')).toBeVisible(); // Sushma Aunty, no message
    await waitForRealtime(supa);

    // Another guest blesses on their own phone: the change arrives over realtime.
    const row = {
      id: 'c0000000-0000-4000-8000-0000000000aa', wedding_id: LIVE_ID, goal_id: 'g-trip', guest_name: 'Farida Khala', amount: 1100,
      message: 'Mubarak ho dono ko!', phone: null, side: 'groom', status: 'guest-confirmed', thanked_at: null, created_at: new Date().toISOString(), provider: 'upi_direct',
    };
    supa.tables['shagun_contributions'].push(row);
    supa.emitChange('shagun_contributions', 'INSERT', row);
    await expect(wall.locator('li.blessing').first()).toContainText('Mubarak ho dono ko!');
    await expect(page.locator('.raised')).toHaveText('₹8,300');

    // This guest gives by direct UPI.
    await page.locator('.sticky-cta, section.total').getByRole('link', { name: 'Give shagun' }).first().click();
    await page.getByRole('button', { name: '₹2,100', exact: true }).click();
    await page.getByLabel('Your name').fill('Arvind Nair');
    await page.getByLabel(/Message for the wall/).fill('Have a lovely trip!');
    await page.getByRole('button', { name: 'Continue to pay ₹2,100' }).click();
    await page.getByRole('button', { name: "I've paid ₹2,100" }).click();
    await expect(page.getByRole('heading', { name: 'Dhanyavaad, Arvind!' })).toBeVisible();
    const saved = supa.tables['shagun_contributions'].find((c) => c['guest_name'] === 'Arvind Nair')!;
    expect(saved).toMatchObject({ wedding_id: LIVE_ID, amount: 2100, message: 'Have a lovely trip!', status: 'guest-confirmed' });
    // Guests only insert; they never read contributions back.
    expect(supa.calls.filter((c) => c === 'GET shagun_contributions')).toEqual([]);
  });
});
