import { SAMPLE, expect, expectToast, lastCopied, openedUrls, test } from './fixtures';
import { createSamplePage } from './support/helpers';

// FLOWS.md › C10 Guest list, C11 WhatsApp message composer, C12 "Send next 10" and tracking
const guestsUrl = `/w/${SAMPLE.riya.slug}/guests`;

async function stageCount(page: import('@playwright/test').Page, label: string): Promise<number> {
  const stage = page.getByRole('region', { name: 'Invite progress' }).getByRole('button').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) });
  return Number(await stage.locator('strong').textContent());
}

test.describe('Guest list (demo)', () => {
  test('tracking funnel, filters by status and group, and search @desktop', async ({ page, go }) => {
    await go(guestsUrl);
    await expect(page.locator('li.guest').first()).toBeVisible(); // the list has loaded
    await expect(page.getByRole('heading', { name: 'Send your invitation' })).toBeVisible();
    const funnel = page.getByRole('region', { name: 'Invite progress' });
    for (const label of ['Not sent', 'Sent', 'Opened', "RSVP'd", 'Gave shagun']) {
      expect(await stageCount(page, label), `${label} count`).toBeGreaterThan(0);
    }
    const total = Number((await page.locator('#list-h .hint').textContent())!.match(/of (\d+)/)![1]);
    expect(total).toBeGreaterThanOrEqual(40);

    // Filter by a status
    const notSent = await stageCount(page, 'Not sent');
    await funnel.getByRole('button').filter({ hasText: /Not sent/ }).click();
    await expect(page.locator('li.guest')).toHaveCount(notSent);
    await expect(page.locator('li.guest .chip.st').first()).toHaveText('Not sent');
    await funnel.getByRole('button').filter({ hasText: /Not sent/ }).click();
    await expect(page.locator('li.guest')).toHaveCount(total);

    // Group filter and search
    await page.getByLabel('Filter by group').selectOption('Office');
    const office = await page.locator('li.guest').count();
    expect(office).toBeGreaterThan(0);
    expect(office).toBeLessThan(total);
    for (const hint of await page.locator('li.guest .who .hint').allTextContents()) expect(hint).toContain('Office');
    await page.getByLabel('Filter by group').selectOption('');
    await page.getByLabel('Search guests').fill('Nana');
    await expect(page.locator('li.guest').first()).toContainText('Nana');
  });

  test('add one guest with greeting, language, side and group; copy their link; remove them', async ({ page, go }) => {
    await go(guestsUrl);
    await expect(page.locator('li.guest').first()).toBeVisible(); // the list has loaded
    const add = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Add guests' }) });
    await add.getByRole('button', { name: 'Add guest' }).click();
    await expectToast(page, 'Add the guest’s name.');

    await add.getByLabel('Name').fill('Bhavna Trivedi');
    await add.getByLabel(/Greet them as/).fill('Trivedi Parivar');
    await add.getByLabel('WhatsApp number').fill('12345');
    await add.getByRole('button', { name: 'Add guest' }).click();
    await expectToast(page, 'Enter a 10-digit Indian mobile number, or leave it empty.');

    await add.getByLabel('WhatsApp number').fill('90000 77777');
    await add.getByLabel(/Invite language/).selectOption('gujarati');
    await add.getByRole('radio', { name: "Bride's side" }).click();
    await add.getByLabel(/^Group/).fill('Gujarat cousins');
    await add.getByRole('button', { name: 'Add guest' }).click();
    await expectToast(page, 'Bhavna Trivedi added');

    // Duplicates (same phone) are refused.
    await add.getByLabel('Name').fill('Bhavna T.');
    await add.getByLabel('WhatsApp number').fill('9000077777');
    await add.getByRole('button', { name: 'Add guest' }).click();
    await expectToast(page, 'Bhavna T. is already on your list.');

    await page.getByLabel('Search guests').fill('Trivedi');
    const row = page.locator('li.guest').filter({ hasText: 'Trivedi Parivar' });
    await expect(row).toContainText('Gujarat cousins');
    await expect(row).toContainText("Bride's side");
    await expect(row.locator('.chip.st')).toHaveText('Not sent');
    await expect(row.getByLabel('Invite language for Bhavna Trivedi')).toHaveValue('gujarati');
    await expect(page.getByLabel('Filter by group').locator('option', { hasText: 'Gujarat cousins' })).toHaveCount(1);

    await row.getByRole('button', { name: 'Link' }).click();
    await expectToast(page, "Bhavna Trivedi's link copied");
    expect(await lastCopied(page)).toMatch(new RegExp(`#/i/${SAMPLE.riya.slug}/[A-Za-z0-9]{8,}`));

    // Per-guest language: change it, then back to the message's language.
    await row.getByLabel('Invite language for Bhavna Trivedi').selectOption('hindi');
    await expectToast(page, 'Trivedi Parivar gets the invite in हिन्दी');
    await row.getByLabel('Invite language for Bhavna Trivedi').selectOption('');
    await expectToast(page, 'Trivedi Parivar follows the chosen language');

    await row.getByRole('button', { name: 'Remove Bhavna Trivedi' }).click();
    await expect(row).toHaveCount(0);
  });

  test('paste a list, import a CSV, and pick phone contacts', async ({ page, go }) => {
    // Android Chrome's contact picker, stubbed: the couple picks two people.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'contacts', {
        configurable: true,
        value: { select: async () => [{ name: ['Contact Didi'], tel: ['+91 90000 11001'] }, { name: ['Contact Jiju'], tel: ['90000 11002'] }] },
      });
    });
    await go(guestsUrl);
    await expect(page.locator('li.guest').first()).toBeVisible(); // the list has loaded
    const before = Number((await page.locator('#list-h .hint').textContent())!.match(/of (\d+)/)![1]);
    const add = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Add guests' }) });

    await add.getByRole('button', { name: 'Paste a list' }).click();
    await add.getByLabel(/One guest per line/).fill('Sunil Mama, 90000 22001, bride, Mama\'s family\nGupta Ji +91 90000 22002\n\n,,,\nNana & Nani, 919000012345');
    await add.getByRole('button', { name: 'Add these guests' }).click();
    await expectToast(page, /^2 guests added|^3 guests added/);

    await add.locator('input[type=file]').setInputFiles({
      name: 'guests.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,phone,side,group,greeting\nRekha Bua,90000 33001,groom,Papa\'s side,Rekha Bua & family\nOffice Team,90000 33002,groom,Office,\n'),
    });
    await expectToast(page, '2 guests added');
    await page.getByLabel('Search guests').fill('Rekha');
    await expect(page.locator('li.guest').filter({ hasText: 'Rekha Bua & family' })).toContainText("Papa's side");
    await page.getByLabel('Search guests').fill('');

    await add.getByRole('button', { name: 'From phone contacts' }).click();
    await expectToast(page, '2 guests added');
    const after = Number((await page.locator('#list-h .hint').textContent())!.match(/of (\d+)/)![1]);
    expect(after - before).toBeGreaterThanOrEqual(6);
  });
});

test.describe('WhatsApp message composer (demo)', () => {
  test('language, tone, shagun link, AI rewrite, edit, copy and open @desktop', async ({ page, go }) => {
    await go(guestsUrl);
    await expect(page.locator('li.guest').first()).toBeVisible(); // the list has loaded
    const composer = page.locator('app-invite-composer');
    const bubble = composer.locator('[data-test=wa-preview]');
    await composer.getByLabel('Preview the message for').selectOption({ label: 'Nana-Nani' });
    await expect(bubble).toContainText('Nana-Nani');
    await expect(bubble).toContainText(`#/i/${SAMPLE.riya.slug}/demo0001tk`);
    await expect(bubble).not.toContainText('/give');

    await composer.getByRole('radio', { name: 'हिन्दी' }).click();
    await expect(bubble).toContainText(/[ऀ-ॿ]/);
    await composer.getByRole('radio', { name: 'ગુજરાતી' }).click();
    await expect(bubble).toContainText(/[઀-૿]/);
    await composer.getByRole('radio', { name: 'English' }).click();
    const traditional = await bubble.textContent();
    await composer.getByRole('radio', { name: 'Fun' }).click();
    await expect(bubble).not.toHaveText(traditional!);

    await composer.locator('[data-test=include-shagun]').check();
    await expect(bubble).toContainText(`#/w/${SAMPLE.riya.slug}/give`);

    await composer.getByRole('button', { name: '✨ Rewrite with AI' }).click();
    await expect(composer.getByText(/^Written by /)).toBeVisible();
    await expect(bubble).toContainText('Nana-Nani');

    await composer.getByRole('button', { name: '✏️ Edit text' }).click();
    await composer.getByLabel('Edit the message').fill('Namaste {name}! Please come: {link}');
    await expect(bubble).toHaveText(new RegExp(`^Namaste Nana-Nani! Please come: .*#/i/${SAMPLE.riya.slug}/demo0001tk`));
    await composer.locator('[data-test=copy-message]').click();
    await expectToast(page, 'Message copied. Paste it in WhatsApp.');
    expect(await lastCopied(page)).toContain('Namaste Nana-Nani! Please come:');

    const open = composer.locator('[data-test=open-whatsapp]');
    await expect(open).toHaveAttribute('href', /^https:\/\/wa\.me\/|^https:\/\/api\.whatsapp\.com\//);
    await composer.getByRole('button', { name: 'Use the standard message' }).click();
    await expect(composer.getByLabel('Edit the message')).not.toHaveValue(/Please come/);

    // A guest with their own language is previewed in it.
    await composer.getByLabel('Preview the message for').selectOption({ label: 'Bhatt Parivar' });
    await expect(composer.getByText(/gets their invite in/)).toBeVisible();
  });
});

test.describe('"Send next 10" and tracking (demo)', () => {
  test('queue opens WhatsApp one guest at a time and marks them sent', async ({ page, go }) => {
    await go(guestsUrl);
    await expect(page.locator('li.guest').first()).toBeVisible(); // the list has loaded
    const notSentBefore = await stageCount(page, 'Not sent');
    const sentBefore = await stageCount(page, 'Sent');
    await page.getByRole('button', { name: 'Send next 10' }).click();
    const queue = page.locator('section.queue');
    await expect(queue.getByText(/^Sending 1 of \d+$/)).toBeVisible();
    const total = Number((await queue.locator('.eyebrow').textContent())!.match(/of (\d+)/)![1]);
    expect(total).toBeGreaterThan(1);
    expect(total).toBeLessThanOrEqual(10);

    const first = (await queue.locator('h2').textContent())!.trim();
    await queue.getByRole('button', { name: /^Open WhatsApp for / }).click();
    await expect(queue.getByText(/^Sending 2 of /)).toBeVisible();
    const opened = await openedUrls(page);
    expect(opened.at(-1)).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=91\d{10}&text=/);
    expect(decodeURIComponent(opened.at(-1)!)).toContain(first);

    await queue.getByRole('button', { name: 'Skip' }).click();
    await expect(queue.getByText(/^Sending 3 of /)).toBeVisible();
    await queue.getByRole('button', { name: 'Stop' }).click();
    await expect(queue).toBeHidden();

    expect(await stageCount(page, 'Not sent')).toBe(notSentBefore - 1);
    expect(await stageCount(page, 'Sent')).toBe(sentBefore + 1);
  });

  test('a page with no guests explains how to start', async ({ page }) => {
    const slug = await createSamplePage(page);
    await page.goto(`./#/w/${slug}/guests`);
    await expect(page.getByText('Add your first guests on the left.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send next 10' })).toBeDisabled();
  });
});
