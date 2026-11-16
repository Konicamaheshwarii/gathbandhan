import { SAMPLE, demoConfig, expect, guardNetwork, test } from './fixtures';

// FLOWS.md › P1 Install the app, P2 Offline, P3 Update toast
// These run against the real production service worker (ngsw), so it is switched back on here.
test.describe('Installable app (PWA)', () => {
  test.use({ serviceWorkers: 'allow' });

  async function waitForServiceWorker(page: import('@playwright/test').Page): Promise<void> {
    // ngsw registers once the app is stable (or after 5 s); then the page must be controlled.
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 20_000 });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20_000 });
  }

  test('has a valid manifest and icons', async ({ page, go, request }) => {
    await go('/');
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(href).toBe('manifest.webmanifest');
    const manifest = await (await request.get(`manifest.webmanifest`)).json();
    expect(manifest.name).toContain('Gathbandhan');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    const sizes = (manifest.icons as { sizes: string; purpose?: string }[]).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect((manifest.icons as { purpose?: string }[]).some((i) => i.purpose?.includes('maskable'))).toBe(true);
  });

  test('works offline: pages opened before still load, and actions say they need the internet @desktop', async ({ page, go, context }) => {
    await go('/');
    await waitForServiceWorker(page);
    await go(`/w/${SAMPLE.riya.slug}`);
    await expect(page.locator('h1.names')).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText("You're offline.", { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.locator('h1.names')).toHaveText(/Riya\s*&\s*Arjun/);
    await expect(page.getByText("You're offline.", { exact: false })).toBeVisible();
    await go(`/i/${SAMPLE.riya.slug}`);
    await expect(page.getByText('Riya & Arjun invite you to their wedding')).toBeVisible();
    await go('/');
    await expect(page.locator('.hero-copy h1')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("You're offline.", { exact: false })).toBeHidden();
  });

  test('a new deploy shows "A new version is ready" and Refresh loads it', async ({ page, go, request }) => {
    await go('/');
    await waitForServiceWorker(page);
    await expect(page.getByText('A new version of Gathbandhan is ready.')).toHaveCount(0);

    // "Deploy" a new version, then come back to the app (which checks for updates).
    expect((await request.get('/__e2e/bump')).ok()).toBe(true);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const banner = page.getByRole('status').filter({ hasText: 'A new version of Gathbandhan is ready.' });
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await Promise.all([page.waitForEvent('load'), banner.getByRole('button', { name: 'Refresh' }).click()]);
    await expect(page.locator('.hero-copy h1')).toBeVisible();
  });
});

test.describe('Install prompt', () => {
  test('Android / desktop Chrome: our own "Install app" banner uses the browser prompt; ✕ hides it for good', async ({ page, go }) => {
    await page.addInitScript(() => {
      (window as unknown as { __prompted: number }).__prompted = 0;
      window.addEventListener('load', () => {
        setTimeout(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
          e.prompt = async () => void ((window as unknown as { __prompted: number }).__prompted += 1);
          e.userChoice = Promise.resolve({ outcome: 'dismissed' });
          window.dispatchEvent(e);
        }, 0);
      });
    });
    await go('/');
    const banner = page.getByRole('complementary', { name: 'Install the app' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Install app' }).click();
    expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
    // Settings offers the same button.
    await go('/settings');
    await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();

    await go('/');
    await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('complementary', { name: 'Install the app' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Three steps, one WhatsApp link' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Install the app' })).toHaveCount(0);
  });

  test('iPhone: explains Share → Add to Home Screen', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true,
      serviceWorkers: 'block',
    });
    // This context is made by hand, so it gets the same network guard.
    const log = { escapes: [] as string[], blocked: [] as string[] };
    await guardNetwork(context, log);
    await demoConfig(context);
    const page = await context.newPage();
    await page.goto('./#/');
    const banner = page.getByRole('complementary', { name: 'Install the app' });
    await expect(banner).toBeVisible();
    // Safari has no install prompt: the button shows how to do it by hand.
    await banner.getByRole('button', { name: 'Install app' }).click();
    await expect(banner).toContainText('Add to Home Screen');
    await expect(banner.getByRole('button', { name: 'Install app' })).toHaveCount(0);
    expect(log.escapes).toEqual([]);
    await context.close();
  });

  test('installed (standalone) shows the bottom tab bar', async ({ page, go }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q.includes('display-mode: standalone') ? ({ ...real(q), matches: true, media: q, addEventListener() {}, removeEventListener() {} } as MediaQueryList) : real(q));
    });
    await go('/');
    const tabs = page.getByRole('navigation', { name: 'App' });
    await expect(tabs).toBeVisible();
    await tabs.getByRole('link', { name: /Sample/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/i/${SAMPLE.riya.slug}$`));
    // Guests' pages hide the couple's tab bar.
    await expect(tabs).toHaveCount(0);
  });
});
