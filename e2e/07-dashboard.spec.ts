import { readFileSync } from 'node:fs';
import { SAMPLE, expect, expectToast, lastCopied, saveDownload, test } from './fixtures';
import { test as live, expect as liveExpect } from './live-fixtures';
import { COUPLE, LIVE_SLUG, liveTables, profileRow } from './support/live-data';

// FLOWS.md › C13 Dashboard
const dash = `/w/${SAMPLE.riya.slug}/dashboard`;

const stat = (page: import('@playwright/test').Page, label: string) => page.locator('.stat').filter({ has: page.locator('.label', { hasText: label }) });
const rupees = (s: string | null) => Number((s ?? '').replace(/[^\d]/g, ''));

test.describe('Couple dashboard (demo)', () => {
  test('hero, quick actions, stats, chart, side split, activity, checklist and RSVPs @desktop', async ({ page, go }, testInfo) => {
    await go(dash);
    await expect(page.getByRole('heading', { name: /^Namaste, / })).toBeVisible();
    await expect(page.locator('.countdown strong')).toHaveText(/^\d+$/);
    const quick = page.getByRole('navigation', { name: 'Quick actions' });
    for (const name of ['Send invites', 'E-invite', 'Share page', 'View page', 'Edit', 'QR card', 'Payments']) {
      await expect(quick.getByRole('link', { name })).toBeVisible();
    }
    await expect(page.getByText('This is the sample wedding.', { exact: false })).toBeVisible();

    const raised = rupees(await stat(page, 'Shagun blessed').locator('strong').textContent());
    expect(raised).toBeGreaterThan(100_000);
    await expect(stat(page, 'Verified in bank').locator('.hint')).toContainText('to check');
    await expect(stat(page, 'Guests invited').locator('strong')).toHaveText(/^\d+\/\d+$/);
    await expect(stat(page, 'Coming').locator('.hint')).toHaveText(/^\d+ RSVPs$/);

    // Chart with a crosshair tooltip and a table view
    const chart = page.locator('app-trend-chart');
    const svg = chart.getByRole('img');
    await expect(svg).toHaveAttribute('aria-label', /^Shagun over the last 30 days, now /);
    await svg.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    if (page.viewportSize()!.width < 600) await page.touchscreen.tap(box.x + box.width * 0.9, box.y + box.height / 2);
    else await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
    await expect(chart.getByRole('status')).toBeVisible();
    await chart.getByText('Show as a table').click();
    await expect(chart.locator('table tr').nth(1)).toBeVisible();

    // Bride's side vs groom's side
    const split = page.locator('app-side-split');
    await expect(split.getByRole('img')).toHaveAttribute('aria-label', /bride|groom/i);
    await expect(split.locator('.legend li')).toHaveCount(await split.locator('.legend li').count());
    expect(await split.locator('.legend li').count()).toBeGreaterThanOrEqual(2);

    await expect(page.locator('.feed li').first()).toBeVisible();
    await expect(page.locator('.checklist li').first()).toBeVisible();
    await expect(page.locator('#check-h + .spacer + .chip, .row:has(#check-h) .chip')).toHaveText(/^\d+\/\d+$/);

    // RSVPs per function, and the caterer's CSV
    const rsvp = page.locator('app-rsvp-summary');
    await expect(rsvp.locator('.counts li')).toHaveCount(5);
    await expect(rsvp.locator('.counts li').filter({ hasText: 'Sangeet' }).locator('strong')).toHaveText(/^\d+$/);
    const csv = await saveDownload(page, () => rsvp.getByRole('button', { name: 'Export CSV' }).click(), testInfo);
    expect(csv.name).toMatch(new RegExp(`^rsvps-${SAMPLE.riya.slug}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    const lines = readFileSync(csv.file, 'utf8').trim().split(/\r?\n/);
    expect(lines.length).toBeGreaterThan(10);
  });

  test('verify contributions, filter, search, export the CSV', async ({ page, go }, testInfo) => {
    await go(dash);
    const list = page.locator('section.list');
    await expect(list.locator('li.contribution').first()).toBeVisible(); // loaded
    const tabs = list.getByRole('tablist', { name: 'Filter contributions' });
    const toVerify = tabs.getByRole('tab', { name: /To verify/ });
    const before = Number(await toVerify.locator('.count').textContent());
    expect(before).toBeGreaterThan(0);
    await toVerify.click();
    await expect(list.locator('li.contribution')).toHaveCount(before);

    const row = list.locator('li.contribution').first();
    const name = (await row.locator('.c-who strong').textContent())!.trim();
    // The switch's label is what people tap.
    await row.locator('label.switch').click();
    await expect(toVerify.locator('.count')).toHaveText(String(before - 1));

    // Razorpay-paid blessings carry a payment id instead of a switch.
    await tabs.getByRole('tab', { name: /^All/ }).click();
    await expect(list.locator('.paid-badge').first()).toHaveText('✓ Paid · Razorpay');
    await expect(list.locator('.pay-id').first()).toHaveText(/^pay_/);

    await list.getByRole('radio', { name: "Groom's side" }).click();
    for (const hint of await list.locator('li.contribution .c-who .hint').allTextContents()) expect(hint).toContain("Groom's side");
    await list.getByRole('radio', { name: 'Both sides' }).click();
    await list.getByLabel('Search contributions').fill('Nana');
    await expect(list.locator('li.contribution').first()).toContainText('Nana');
    await list.getByLabel('Search contributions').fill('');

    const csv = await saveDownload(page, () => list.getByRole('button', { name: 'Export CSV' }).click(), testInfo);
    expect(csv.name).toMatch(new RegExp(`^shagun-${SAMPLE.riya.slug}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    const text = readFileSync(csv.file, 'utf8');
    expect(text.split(/\r?\n/)[0].toLowerCase()).toContain('amount');
    expect(text).toContain('pay_DEMO');
    expect(text).toContain(name);
  });

  test('thank-you notes in English, Hindi and Hinglish; mark thanked; post a goal update', async ({ page, go, context }) => {
    await go(dash);
    const list = page.locator('section.list');
    await list.getByRole('tab', { name: /Not thanked/ }).click();
    const row = list.locator('li.contribution').first();
    const name = (await row.locator('.c-who strong').textContent())!.trim();
    await row.getByRole('button', { name: 'Thank-you note' }).click();
    const note = row.getByLabel(`Thank-you note for ${name}`);
    await expect(note).not.toHaveValue('');
    const langs = row.getByRole('radiogroup', { name: 'Note language' });
    await langs.getByRole('radio', { name: 'हिन्दी' }).click();
    await expect(note).toHaveValue(/[ऀ-ॿ]/);
    await langs.getByRole('radio', { name: 'Hinglish' }).click();
    await expect(note).not.toHaveValue(/[ऀ-ॿ]/);
    await expect(note).toHaveValue(/(shagun|dhanyavaad|thank|pyaar)/i);
    await langs.getByRole('radio', { name: 'English' }).click();
    await row.getByLabel('Mention the amount').check();
    await expect(note).toHaveValue(/₹/);
    await note.fill(`Dear ${name}, thank you!`);
    await row.getByRole('button', { name: 'Copy' }).click();
    expect(await lastCopied(page)).toBe(`Dear ${name}, thank you!`);
    const wa = row.getByRole('link', { name: /WhatsApp/ });
    await expect(wa).toHaveAttribute('href', /^https:\/\/api\.whatsapp\.com\/send\?.*text=Dear/);
    await row.getByRole('button', { name: 'Mark thanked' }).click();
    // Thanked now, so it leaves the "Not thanked" list.
    await list.getByRole('tab', { name: /^All/ }).click();
    await expect(list.locator('li.contribution').filter({ hasText: name }).getByRole('button', { name: 'Thanked ✓' }).first()).toBeVisible();

    // Goal update guests will see
    const goal = page.locator('.goal-card').filter({ hasText: 'Cherry blossoms in Kyoto' });
    await goal.getByRole('button', { name: '+ Post an update guests will see' }).click();
    await goal.getByLabel('Update for Cherry blossoms in Kyoto').fill('Ryokan booked for April!');
    await goal.getByRole('button', { name: 'Post update' }).click();
    await expect(goal.getByText('Ryokan booked for April!')).toBeVisible();
    const guest = await context.newPage();
    await guest.goto(`./#/w/${SAMPLE.riya.slug}`);
    await expect(guest.locator('.goal').filter({ hasText: 'Cherry blossoms in Kyoto' })).toContainText('Ryokan booked for April!');
  });

  test('the other samples have their own dashboards (Gujarati, Razorpay)', async ({ page, go }) => {
    await go(`/w/${SAMPLE.hetal.slug}/dashboard`);
    await expect(page.locator('.hero-date')).toContainText('Ahmedabad');
    await expect(stat(page, 'Paid via Razorpay')).toContainText('Test mode');
    await expect(page.getByText('Razorpay test mode:', { exact: false })).toBeVisible();
    await go(`/w/${SAMPLE.meenakshi.slug}/dashboard`);
    await expect(page.locator('.hero-date')).toContainText('Bengaluru');
    await expect(page.locator('app-rsvp-summary .counts li')).toHaveCount(5);
  });
});

live.describe('Dashboard (online mode, mocked Supabase)', () => {
  live.use({ mockOptions: { user: COUPLE, tables: { ...liveTables(), shagun_profiles: [profileRow(COUPLE)] } } });

  live('reads contributions and RSVPs from the backend; verifying updates the row', async ({ page, go, supa }) => {
    await go(`/w/${LIVE_SLUG}/dashboard`);
    await liveExpect(page.getByRole('heading', { name: 'Namaste, Kavya' })).toBeVisible();
    await liveExpect(stat(page, 'Shagun blessed').locator('strong')).toHaveText('₹7,200');
    await liveExpect(stat(page, 'Coming').locator('strong')).toHaveText('3');
    const row = page.locator('li.contribution').filter({ hasText: 'Sushma Aunty' });
    await row.locator('label.switch').click();
    await liveExpect(row.getByRole('checkbox', { name: 'Verified Sushma Aunty in bank app' })).toBeChecked();
    await liveExpect(row.getByText('Verified', { exact: true })).toBeVisible();
    liveExpect(supa.tables['shagun_contributions'].find((c) => c['guest_name'] === 'Sushma Aunty')!['status']).toBe('verified');
    await liveExpect(page.locator('app-co-owners')).toBeVisible();
    await expectToastLive(page);
  });
});

async function expectToastLive(page: import('@playwright/test').Page): Promise<void> {
  // Copying the share link works with the backend too.
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expectToast(page, /copied/i);
  liveExpect(await lastCopied(page)).toMatch(new RegExp(`#/w/${LIVE_SLUG}$`));
}
