import { SAMPLE, expect, test } from './fixtures';

// FLOWS.md › C1 Landing page and style slider
test.describe('Landing page', () => {
  test('shows the pitch, the sample wedding and the FAQ @desktop', async ({ page, go }) => {
    await go('/');
    await expect(page.locator('.hero-copy h1')).toHaveText(/from kankotri to shagun/i);
    await expect(page.getByText('Demo mode: data stays in this browser')).toBeVisible();
    await expect(page.getByText(/Sample invite ·/)).toBeVisible();

    // The live sample is always Riya & Arjun, even with more samples bundled.
    const live = page.locator('section.live');
    await expect(live.getByText('Riya & Arjun', { exact: false }).first()).toBeVisible();
    await expect(live.getByRole('link', { name: 'Open the sample page' })).toHaveAttribute('href', `#/w/${SAMPLE.riya.slug}`);

    const faq = page.locator('section.faq details').first();
    await faq.locator('summary').click();
    await expect(faq).toHaveAttribute('open', '');
  });

  test('"Create your wedding page" opens the editor in demo mode', async ({ page, go }) => {
    await go('/');
    await page.getByRole('link', { name: 'Create your wedding page' }).first().click();
    await expect(page).toHaveURL(/#\/create$/);
    await expect(page.getByRole('heading', { name: 'Create your shagun page' })).toBeVisible();
  });

  test('"See a sample invite" opens the animated web invite', async ({ page, go }) => {
    await go('/');
    await page.getByRole('link', { name: 'See a sample invite' }).click();
    await expect(page).toHaveURL(new RegExp(`#/i/${SAMPLE.riya.slug}$`));
    await expect(page.getByText('Riya & Arjun invite you to their wedding')).toBeVisible();
  });

  test('style slider: arrows, dots, keys, pause, and "Use this style" @desktop', async ({ page, go }) => {
    await go('/');
    const slider = page.getByRole('region', { name: 'Invite styles (sample content)' });
    await slider.scrollIntoViewIfNeeded();
    const caption = slider.locator('.style-name');
    // Autoplay would move on by itself; pause it first so the test drives the slider.
    const pause = slider.getByRole('button', { name: 'Pause the slideshow' });
    if (await pause.isVisible()) await pause.click();
    await expect(caption).toHaveText('Shree Ganesh classic');

    await slider.getByRole('button', { name: /^Next: / }).click();
    await expect(caption).toHaveText('Rajasthani jharokha');
    await slider.getByRole('button', { name: /^Previous: / }).click();
    await expect(caption).toHaveText('Shree Ganesh classic');

    await slider.getByRole('group', { name: 'Choose a slide' }).getByRole('button', { name: 'Gujarati kankotri' }).click();
    await expect(caption).toHaveText('Gujarati kankotri');

    await slider.locator('.viewport').focus();
    await page.keyboard.press('ArrowRight');
    await expect(caption).toHaveText('South Indian temple');
    await page.keyboard.press('ArrowLeft');
    await expect(caption).toHaveText('Gujarati kankotri');

    await slider.getByRole('link', { name: 'Use this style' }).click();
    await expect(page).toHaveURL(new RegExp(`#/w/${SAMPLE.riya.slug}/invite\\?template=gujarati$`));
    await expect(page.getByText('✓ Your invite uses this style')).toBeVisible();
  });

  test('autoplay stays off for people who prefer reduced motion', async ({ page, go }) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go('/');
    const slider = page.getByRole('region', { name: 'Invite styles (sample content)' });
    await slider.scrollIntoViewIfNeeded();
    // No autoplay, so no play / pause button, and the slide does not move on by itself.
    await expect(slider.getByRole('button', { name: /slideshow/ })).toHaveCount(0);
    await expect(slider.locator('.style-name')).toHaveText('Shree Ganesh classic');
    await page.clock.runFor(20_000);
    await expect(slider.locator('.style-name')).toHaveText('Shree Ganesh classic');
    await slider.getByRole('button', { name: /^Next: / }).click();
    await expect(slider.locator('.style-name')).toHaveText('Rajasthani jharokha');
  });
});
