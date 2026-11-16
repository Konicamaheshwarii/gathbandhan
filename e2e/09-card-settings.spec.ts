import { SAMPLE, expect, expectToast, test } from './fixtures';

// FLOWS.md › C15 Venue QR card, C16 Settings
test.describe('Venue QR card (demo)', () => {
  test('A6 / A5 card with a QR to the page, and Print @desktop', async ({ page, go }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => void ((window as unknown as { __printed: number }).__printed += 1);
    });
    await go(`/w/${SAMPLE.riya.slug}/card`);
    await expect(page.getByRole('heading', { name: 'Venue QR card' })).toBeVisible();
    const sheet = page.locator('article.sheet');
    await expect(sheet).toContainText('Riya');
    await expect(sheet.locator('svg, canvas, img').first()).toBeVisible();
    await expect(sheet).not.toHaveClass(/a5/);
    await page.getByRole('radio', { name: /A5/ }).click();
    await expect(sheet).toHaveClass(/a5/);
    await page.getByRole('button', { name: 'Print card' }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    // The card is a couple's tool, so it keeps the couple's header.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('AI chain, own key for Gemini, test AI with offline templates, theme and sample reset @desktop', async ({ page, go }) => {
    await go('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Where your data lives' }) })).toContainText('Data stays in this browser.');
    const providers = page.getByRole('radiogroup', { name: 'AI provider' });
    await expect(providers.getByRole('radio')).toHaveCount(4);

    await providers.getByRole('radio', { name: /Gemini/ }).click();
    const key = page.getByLabel('API key');
    await expect(key).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove key' })).toBeDisabled();
    await key.fill('test-key-not-real');
    await key.press('Tab');
    await expect(page.getByRole('button', { name: 'Remove key' })).toBeEnabled();
    await expect(providers.getByRole('radio', { name: /Gemini/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Remove key' }).click();
    await expect(page.getByRole('button', { name: 'Remove key' })).toBeDisabled();

    // Offline templates only: nothing leaves the browser.
    await providers.getByRole('radio', { name: /Offline only/ }).click();
    await page.getByRole('button', { name: 'Test AI' }).click();
    await expect(page.locator('.ok[role=status]')).toContainText('Working. Answers come from');

    // "Free AI (no key)" with every online tier blocked falls back to the templates, and says so.
    await providers.getByRole('radio', { name: /Free AI \(no key\)/ }).click();
    await page.getByRole('button', { name: 'Test AI' }).click();
    await expect(page.locator('.fail[role=status]')).toContainText('No online AI answered, so offline templates will be used.');

    // Free cloud AI can be turned off.
    const cloud = page.getByLabel(/Use free cloud AI/);
    await cloud.uncheck();
    await page.reload();
    await expect(page.getByLabel(/Use free cloud AI/)).not.toBeChecked();

    // Theme
    const theme = page.getByRole('radiogroup', { name: 'Theme' });
    await theme.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await theme.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Reset the samples after editing one.
    await page.getByRole('button', { name: 'Reset sample data' }).click();
    await expectToast(page, 'Sample weddings restored');
    await expect(page.getByText('Hetal & Parth in Ahmedabad', { exact: false })).toBeVisible();
  });
});
