import { readFileSync } from 'node:fs';
import { SAMPLE, expect, saveDownload, sharedData, test } from './fixtures';
import { test as live } from './live-fixtures';
import { GUEST_TOKEN, LIVE_SLUG, liveTables } from './support/live-data';

// FLOWS.md › G1 Personal invite link, G2 Animated invite + calendar, G3 RSVP per function
test.describe('Personal invite (demo)', () => {
  test('greets the guest by name, turns pages, plays shehnai, adds to calendar, shares, and ticks "opened" @desktop', async ({ page, go }, testInfo) => {
    await go(`/i/${SAMPLE.riya.slug}/demo0022tk`);
    await expect(page.locator('.hello')).toHaveText('Namaste, Swati Didi & Jiju. You are invited 🙏');
    // Guests see the wedding, not the couple's tools.
    await expect(page.getByRole('link', { name: 'Make a page for your wedding' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    const sheets = page.locator('section.sheet');
    const n = await sheets.count();
    expect(n).toBeGreaterThanOrEqual(5);
    await expect(sheets.first()).toHaveAttribute('aria-label', `Page 1 of ${n}`);
    await sheets.last().scrollIntoViewIfNeeded();
    await expect(sheets.last()).toBeInViewport();
    // The personal greeting is printed on the invitation page too.
    await expect(page.locator('.book')).toContainText('Swati Didi & Jiju');

    const actions = page.getByRole('navigation', { name: 'Invitation actions' });
    const music = actions.getByRole('button', { name: /Shehnai/ });
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'true');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'false');

    const ics = await saveDownload(page, () => actions.getByRole('button', { name: /Calendar/ }).click(), testInfo);
    expect(ics.name).toBe(`${SAMPLE.riya.slug}.ics`);
    const cal = readFileSync(ics.file, 'utf8');
    expect(cal).toMatch(/^BEGIN:VCALENDAR/);
    expect(cal.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(cal).toMatch(/DTSTART:\d{8}T\d{6}Z/); // IST converted to UTC

    await actions.getByRole('button', { name: /Share/ }).click();
    expect((await sharedData(page))[0].url).toMatch(new RegExp(`#/i/${SAMPLE.riya.slug}$`));

    // Demo mode: the open is recorded in this browser, so the couple's list shows it.
    await go(`/w/${SAMPLE.riya.slug}/guests`);
    await page.getByLabel('Search guests').fill('Swati');
    await expect(page.locator('li.guest').first().locator('.chip.st')).toContainText('Opened');
  });

  test('a link without a token invites everyone; a wrong token is simply ignored', async ({ page, go }) => {
    await go(`/i/${SAMPLE.riya.slug}`);
    await expect(page.locator('.hello')).toHaveText('Riya & Arjun invite you to their wedding');
    await go(`/i/${SAMPLE.riya.slug}/notarealtoken123`);
    await expect(page.locator('.hello')).toHaveText('Riya & Arjun invite you to their wedding');
    await go('/i/no-such-wedding');
    await expect(page.getByRole('heading', { name: 'We could not find this invitation' })).toBeVisible();
  });

  test('the Gujarati sample invite is in Gujarati', async ({ page, go }) => {
    await go(`/i/${SAMPLE.hetal.slug}/ahmd0038tk`);
    await expect(page.locator('.hello')).toContainText('Namaste,');
    await expect(page.locator('.book')).toContainText(/[઀-૿]/);
  });
});

test.describe('RSVP per function (demo)', () => {
  test('from the invite: choose functions, party size, side; the couple sees it @desktop', async ({ page, go }) => {
    await go(`/i/${SAMPLE.riya.slug}/demo0024tk`);
    await expect(page.locator('.hello')).toContainText('Lakshmi Aunty');
    await page.getByRole('navigation', { name: 'Invitation actions' }).getByRole('link', { name: /RSVP/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/w/${SAMPLE.riya.slug}/rsvp$`));
    await expect(page.getByRole('heading', { name: 'Will you join Riya & Arjun?' })).toBeVisible();
    await expect(page.getByText('Sample page: your reply is saved only in this browser.')).toBeVisible();

    const fns = page.locator('ul.events input[type=checkbox]');
    await expect(fns).toHaveCount(5);
    await page.getByRole('button', { name: 'Send RSVP' }).click();
    await expect(page.locator('.error-text').first()).toBeVisible();

    await page.getByLabel(/Your name/).fill('Lakshmi Aunty');
    await page.locator('ul.events label').filter({ hasText: 'Haldi' }).locator('input').uncheck();
    await page.locator('ul.events label').filter({ hasText: 'Reception' }).locator('input').uncheck();
    await page.getByRole('button', { name: 'One more' }).click();
    await page.getByRole('button', { name: 'One more' }).click();
    await expect(page.locator('.stepper output')).toHaveText('3');
    await page.getByRole('button', { name: 'One less' }).click();
    await page.getByRole('radio', { name: "Bride's side" }).click();
    await page.getByLabel(/WhatsApp number/).fill('123');
    await page.getByRole('button', { name: 'Send RSVP' }).click();
    await expect(page.locator('.error-text')).toContainText(/10-digit|mobile/i);
    await page.getByLabel(/WhatsApp number/).fill('90000 44001');
    await page.getByLabel(/Note for the couple/).fill('Pure veg please, arriving by the morning train.');
    await page.getByRole('button', { name: 'Send RSVP' }).click();

    await expect(page.getByRole('heading', { name: 'See you there, Lakshmi!' })).toBeVisible();
    await expect(page.locator('section.done')).toContainText('2 of you are coming to 3 functions');

    await go(`/w/${SAMPLE.riya.slug}/dashboard`);
    await page.locator('app-rsvp-summary').getByText('See every reply').click();
    await expect(page.locator('app-rsvp-summary .replies')).toContainText('Lakshmi Aunty');
    await go(`/w/${SAMPLE.riya.slug}/guests`);
    await page.getByLabel('Search guests').fill('Lakshmi');
    await expect(page.locator('li.guest').first().locator('.chip.st')).toHaveText("RSVP'd");
  });

  test('untick everything to send regrets', async ({ page, go }) => {
    await go(`/w/${SAMPLE.meenakshi.slug}/rsvp`);
    await page.getByLabel(/Your name/).fill('Ravi Shankar');
    for (const box of await page.locator('ul.events input[type=checkbox]').all()) await box.uncheck();
    await page.getByRole('button', { name: 'Send regrets' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you, Ravi!' })).toBeVisible();
    await expect(page.getByText('We will miss you.', { exact: false })).toBeVisible();
  });
});

live.describe('Invite and RSVP (online mode, mocked Supabase)', () => {
  live.use({ mockOptions: { tables: liveTables() } });

  live('a guest\'s link reveals only their greeting, marks "opened", and the RSVP is stored @desktop', async ({ page, go, supa }) => {
    await go(`/i/${LIVE_SLUG}/${GUEST_TOKEN}`);
    await expect(page.locator('.hello')).toHaveText('Namaste, Rao Parivar. You are invited 🙏');
    await expect.poll(() => supa.tables['shagun_guests'][0]['opened_at']).toBeTruthy();

    await page.getByRole('navigation', { name: 'Invitation actions' }).getByRole('link', { name: /RSVP/ }).click();
    await page.getByLabel(/Your name/).fill('Meera Rao');
    await page.locator('ul.events label').filter({ hasText: 'Mehndi' }).locator('input').uncheck();
    await page.getByRole('button', { name: 'One more' }).click();
    await page.getByRole('button', { name: 'Send RSVP' }).click();
    await expect(page.getByRole('heading', { name: 'See you there, Meera!' })).toBeVisible();

    const rsvp = supa.tables['shagun_rsvps'].find((r) => r['guest_name'] === 'Meera Rao')!;
    expect(rsvp).toMatchObject({ party_size: 2, event_ids: ['e-wedding', 'e-reception'] });
    await expect.poll(() => supa.tables['shagun_guests'][0]['rsvp_at']).toBeTruthy();
    // A guest's browser never reads the guest list, contributions or RSVPs.
    expect(supa.calls.filter((c) => /^GET shagun_(guests|contributions|rsvps)$/.test(c))).toEqual([]);
    expect(supa.calls).toContain('RPC shagun_guest_invite');
  });
});
