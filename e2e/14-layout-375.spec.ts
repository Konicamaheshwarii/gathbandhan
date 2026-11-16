import { Page } from '@playwright/test';
import { SAMPLE, expect, test } from './fixtures';
import { demoSignIn } from './support/helpers';

/**
 * Exploratory pass at 375 px (small Android / iPhone SE width), light and dark, with English,
 * Hindi and Gujarati content: every main screen must fit the width (no sideways scrolling), and
 * a full-page screenshot is saved for a human to look at (test-results/e2e/…/screens).
 */
const SCREENS: { name: string; path: string; ready: (p: Page) => Promise<void>; prepare?: (p: Page) => Promise<void> }[] = [
  { name: 'home', path: '/', ready: (p) => p.locator('.hero-copy h1').waitFor() },
  { name: 'login', path: '/login', ready: (p) => p.getByRole('heading', { name: 'Welcome to Gathbandhan' }).waitFor() },
  { name: 'create', path: '/create', ready: (p) => p.getByRole('heading', { name: 'Create your shagun page' }).waitFor() },
  { name: 'edit-riya', path: `/w/${SAMPLE.riya.slug}/edit`, ready: (p) => p.getByRole('heading', { name: 'Update your shagun page' }).waitFor() },
  { name: 'dashboard-riya', path: `/w/${SAMPLE.riya.slug}/dashboard`, ready: (p) => p.locator('section.list li.contribution').first().waitFor() },
  { name: 'dashboard-hetal', path: `/w/${SAMPLE.hetal.slug}/dashboard`, ready: (p) => p.locator('section.list li.contribution').first().waitFor() },
  { name: 'guests-riya', path: `/w/${SAMPLE.riya.slug}/guests`, ready: (p) => p.locator('li.guest').first().waitFor() },
  {
    name: 'composer-gujarati', path: `/w/${SAMPLE.hetal.slug}/guests`, ready: (p) => p.locator('[data-test=wa-preview]').waitFor(),
    prepare: async (p) => {
      await p.locator('app-invite-composer').getByRole('radio', { name: 'ગુજરાતી' }).click();
      await p.locator('app-invite-composer').scrollIntoViewIfNeeded();
    },
  },
  { name: 'designer-riya', path: `/w/${SAMPLE.riya.slug}/invite`, ready: (p) => p.locator('figure.pg').first().waitFor() },
  {
    name: 'designer-hindi', path: `/w/${SAMPLE.riya.slug}/invite`, ready: (p) => p.locator('figure.pg').first().waitFor(),
    prepare: async (p) => {
      await p.locator('section').filter({ has: p.getByRole('heading', { name: 'Words' }) }).getByRole('radio', { name: 'हिन्दी' }).click();
    },
  },
  { name: 'designer-gujarati', path: `/w/${SAMPLE.hetal.slug}/invite`, ready: (p) => p.locator('figure.pg').first().waitFor() },
  { name: 'payments-hetal', path: `/w/${SAMPLE.hetal.slug}/payments`, ready: (p) => p.getByRole('heading', { name: 'How guests pay' }).waitFor() },
  { name: 'card-riya', path: `/w/${SAMPLE.riya.slug}/card`, ready: (p) => p.locator('article.sheet').waitFor() },
  { name: 'settings', path: '/settings', ready: (p) => p.getByRole('heading', { name: 'Settings' }).waitFor() },
  { name: 'invite-riya-personal', path: `/i/${SAMPLE.riya.slug}/demo0022tk`, ready: (p) => p.locator('.hello strong').waitFor() },
  { name: 'invite-hetal-gujarati', path: `/i/${SAMPLE.hetal.slug}/ahmd0038tk`, ready: (p) => p.locator('.hello strong').waitFor() },
  { name: 'invite-meenakshi', path: `/i/${SAMPLE.meenakshi.slug}`, ready: (p) => p.locator('section.sheet').first().waitFor() },
  { name: 'wedding-riya', path: `/w/${SAMPLE.riya.slug}`, ready: (p) => p.locator('section.wall li.blessing').first().waitFor() },
  { name: 'wedding-hetal-gujarati', path: `/w/${SAMPLE.hetal.slug}`, ready: (p) => p.locator('section.wall li.blessing').first().waitFor() },
  { name: 'rsvp-hetal', path: `/w/${SAMPLE.hetal.slug}/rsvp`, ready: (p) => p.locator('ul.events li').first().waitFor() },
  { name: 'give-riya', path: `/w/${SAMPLE.riya.slug}/give`, ready: (p) => p.getByRole('heading', { name: /^Bless / }).waitFor() },
  {
    name: 'give-riya-upi', path: `/w/${SAMPLE.riya.slug}/give`, ready: (p) => p.getByRole('heading', { name: /^Bless / }).or(p.getByRole('button', { name: /^I've paid/ })).first().waitFor(),
    prepare: async (p) => {
      await p.getByLabel('Your name').fill('राधा अग्रवाल');
      await p.getByRole('button', { name: /^Continue to pay/ }).click();
      await p.getByRole('button', { name: /^I've paid/ }).waitFor();
    },
  },
  {
    name: 'give-hetal-razorpay', path: `/w/${SAMPLE.hetal.slug}/give`, ready: (p) => p.getByRole('heading', { name: /^Bless / }).or(p.getByRole('dialog')).first().waitFor(),
    prepare: async (p) => {
      await p.getByLabel('Your name').fill('નિરાલી દેસાઈ');
      await p.getByRole('button', { name: /^Continue to pay/ }).click();
      await p.getByRole('button', { name: /securely$/ }).click();
      await p.getByRole('dialog').waitFor();
    },
  },
];

const ACCOUNT_SCREENS = ['welcome', 'account'] as const;

test.describe('Layout at 375 px, light and dark', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone project only');
  test.use({ viewport: { width: 375, height: 812 } });

  for (const scheme of ['light', 'dark'] as const) {
    for (const s of SCREENS) {
      test(`${s.name} (${scheme}) fits 375 px`, async ({ page, go }, testInfo) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await go(s.path);
        await s.ready(page);
        await s.prepare?.(page);
        await s.ready(page);
        await expectNoSidewaysScroll(page);
        await page.screenshot({ path: testInfo.outputPath(`screens/${scheme}-${s.name}.png`), fullPage: s.name !== 'give-hetal-razorpay' });
      });
    }

    test(`welcome and account (${scheme}) fit 375 px`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('./#/login');
      await page.getByLabel('Your email').fill('layout.demo@example.com');
      await page.getByRole('button', { name: 'Sign in to the demo' }).click();
      await page.getByRole('heading', { name: 'Namaste! Tell us about you' }).waitFor();
      await expectNoSidewaysScroll(page);
      await page.screenshot({ path: testInfo.outputPath(`screens/${scheme}-${ACCOUNT_SCREENS[0]}.png`), fullPage: true });
      await page.getByLabel('Your name').fill('Bhavikaben Prajapati');
      await page.getByRole('radio', { name: 'ગુજરાતી' }).click();
      await page.getByRole('button', { name: 'Save and continue' }).click();
      await page.getByRole('heading', { name: 'Namaste, Bhavikaben' }).waitFor();
      await page.locator('#privacy [data-test=delete-open]').click();
      await expectNoSidewaysScroll(page);
      await page.screenshot({ path: testInfo.outputPath(`screens/${scheme}-${ACCOUNT_SCREENS[1]}.png`), fullPage: true });
      await page.getByRole('button', { name: /^Account menu for/ }).click();
      await expect(page.getByRole('menu', { name: 'Account' })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`screens/${scheme}-account-menu.png`) });
    });
  }

  test('the account page fits a long name and a long email', async ({ page }, testInfo) => {
    await demoSignIn(page, { email: 'a.very.long.email.address.for.testing@example.com', name: 'Venkataraghavan Subramaniam' });
    await expectNoSidewaysScroll(page);
    await page.screenshot({ path: testInfo.outputPath('screens/light-account-long-name.png'), fullPage: true });
  });
});

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= width + 1) return false;
        // Ignore what is clipped by a scrolling or hidden-overflow ancestor (sliders, tables).
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return false;
        }
        return getComputedStyle(el).position !== 'fixed' || r.left < width;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(el.getBoundingClientRect().right)}px`);
    return { scroll: document.documentElement.scrollWidth, width, wide };
  });
  expect(overflow.wide, `elements wider than the ${overflow.width}px screen`).toEqual([]);
  expect(overflow.scroll, 'page scrolls sideways').toBeLessThanOrEqual(overflow.width);
}
