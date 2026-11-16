import { readFileSync } from 'node:fs';
import { SAMPLE, expect, expectToast, saveDownload, test } from './fixtures';

// FLOWS.md › C9 Invite designer and the animated web invite
test.describe('Invite designer (demo)', () => {
  test('styles, language, tone, colours, pages and saving @desktop', async ({ page, go }) => {
    await go(`/w/${SAMPLE.riya.slug}/invite`);
    await expect(page.getByRole('heading', { name: 'Design your invitation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeDisabled();

    // Ten styles in the slider; the sample uses the Rajasthani one.
    const styles = page.getByRole('region', { name: 'Invite styles' });
    await expect(styles.getByRole('group', { name: 'Choose a slide' }).getByRole('button')).toHaveCount(10);
    await expect(styles.getByText('✓ Your invite uses this style')).toBeVisible();
    await styles.getByRole('group', { name: 'Choose a slide' }).getByRole('button', { name: 'South Indian temple' }).click();
    await styles.getByRole('button', { name: 'Use this style' }).click();
    await expect(styles.getByText('✓ Your invite uses this style')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save invite' })).toBeEnabled();

    // Language and tone rewrite the words (offline templates).
    const words = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Words' }) });
    await words.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'हिन्दी' }).click();
    await expect(words.getByLabel('Title')).toHaveValue(/[ऀ-ॿ]/);
    await expect(page.locator('.pages app-invite-page').first()).toContainText(/[ऀ-ॿ]/);
    await words.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'ગુજરાતી' }).click();
    await expect(words.getByLabel('Title')).toHaveValue(/[઀-૿]/);
    await words.getByRole('radiogroup', { name: 'Tone' }).getByRole('radio', { name: 'fun' }).click();
    await words.getByRole('button', { name: '✨ Write with AI' }).click();
    await expect(words.getByText(/^Written by /)).toBeVisible();
    await words.getByLabel('Closing line').fill('Aavjo, padharjo!');
    await expect(page.locator('.pages')).toContainText('Aavjo, padharjo!');

    // Families
    await page.getByLabel("Bride's grandparents").fill('Smt. Kamla Devi');
    await expect(page.locator('.pages')).toContainText('Smt. Kamla Devi');

    // Colours: change the ink, then reset to the style's palette.
    const ink = page.getByLabel('Ink');
    await ink.fill('#123456');
    await expect(ink).toHaveValue('#123456');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(ink).not.toHaveValue('#123456');

    // Cover photo choice and the personal preview
    await page.getByRole('radiogroup', { name: 'Cover photo' }).getByRole('radio', { name: 'No photo' }).click();
    await page.getByLabel(/Preview a personal invite/).check();
    await expect(page.locator('.pages')).toContainText('Sharma Parivar');

    // Pages: cover, invitation, families, functions (3 per page), closing.
    await expect(page.locator('.export strong')).toHaveText(/^\d+ pages$/);
    const count = Number((await page.locator('.export strong').textContent())!.split(' ')[0]);
    expect(count).toBeGreaterThanOrEqual(5);
    await expect(page.locator('figure.pg')).toHaveCount(count);

    await page.getByRole('button', { name: 'Save invite' }).click();
    await expectToast(page, 'Invite saved');
    await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

    // It sticks.
    await page.reload();
    await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Words' }) }).getByLabel('Closing line')).toHaveValue('Aavjo, padharjo!');
  });

  test('AI design picks suggest a style for the wedding and apply it', async ({ page, go }) => {
    await go(`/w/${SAMPLE.hetal.slug}/invite`);
    await page.getByLabel(/Tell us about your wedding/).fill('traditional Gujarati, family from Surat, red and green');
    await page.getByRole('button', { name: 'Suggest a design' }).click();
    const pick = page.locator('.pick');
    await expect(pick).toBeVisible();
    await expect(pick.getByText(/Suggested by/)).toBeVisible();
    await pick.getByRole('button', { name: 'Apply' }).click();
    await expectToast(page, /Design applied/);
  });

  test('exports a page as PNG and the invite as PDF', async ({ page, go }, testInfo) => {
    testInfo.setTimeout(90_000);
    await go(`/w/${SAMPLE.riya.slug}/invite`);
    const png = await saveDownload(page, () => page.locator('figure.pg').first().getByRole('button', { name: 'PNG' }).click(), testInfo);
    expect(png.name).toBe(`invite-${SAMPLE.riya.slug}-1.png`);
    const bytes = readFileSync(png.file);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    // 1080 × 1920, WhatsApp status size
    expect(bytes.readUInt32BE(16)).toBe(1080);
    expect(bytes.readUInt32BE(20)).toBe(1920);
    await expectToast(page, 'Downloaded. Share it on WhatsApp!');

    const pdf = await saveDownload(page, () => page.getByRole('button', { name: 'PDF', exact: true }).click(), testInfo);
    expect(pdf.name).toBe(`invite-${SAMPLE.riya.slug}.pdf`);
    const text = readFileSync(pdf.file).toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    const pages = Number((await page.locator('.export strong').textContent())!.split(' ')[0]);
    expect((text.match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(pages);
  });

  test('"Open web invite" shows the animated invite', async ({ page, go, context }) => {
    await go(`/w/${SAMPLE.riya.slug}/invite`);
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Open web invite ↗' }).click()]);
    await expect(tab).toHaveURL(new RegExp(`#/i/${SAMPLE.riya.slug}$`));
    await expect(tab.getByText('Riya & Arjun invite you to their wedding')).toBeVisible();
  });
});
