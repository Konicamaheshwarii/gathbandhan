import { expect, test, expectToast } from './fixtures';
import { test as live } from './live-fixtures';
import { COUPLE, liveTables, profileRow } from './support/live-data';
import { authUser, fakeJwt } from './support/supabase-mock';

// FLOWS.md › C2 Sign in, C3 First-sign-in welcome, C5 Header menu
test.describe('Sign in (demo mode)', () => {
  test('a demo sign-in makes a local account, asks "Tell us about you", then opens the account @desktop', async ({ page, go }) => {
    await go('/account');
    await expect(page).toHaveURL(/#\/login\?next=%2Faccount$/);
    await expect(page.getByRole('heading', { name: 'Welcome to Gathbandhan' })).toBeVisible();
    await expect(page.getByText('no email is sent', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Sign in to the demo' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.');

    await page.getByLabel('Your email').fill('Pooja.Demo@Example.com');
    await page.getByRole('button', { name: 'Sign in to the demo' }).click();

    // First sign-in: the short welcome step.
    await expect(page).toHaveURL(/#\/welcome\?next=%2Faccount$/);
    await expect(page.getByRole('heading', { name: 'Namaste! Tell us about you' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('Add your name', { exact: false }).first()).toBeVisible();

    await page.getByLabel('Your name').fill('Pooja Desai');
    await page.getByRole('radio', { name: /Bride/ }).click();
    await page.getByLabel('Mobile number').fill('90000 12345');
    await page.getByRole('radio', { name: 'ગુજરાતી' }).click();
    await page.getByRole('button', { name: 'Save and continue' }).click();

    await expectToast(page, 'Lovely to meet you, Pooja!');
    await expect(page).toHaveURL(/#\/account$/);
    await expect(page.getByRole('heading', { name: 'Namaste, Pooja' })).toBeVisible();
    await expect(page.getByText('pooja.demo@example.com').first()).toBeVisible();

    // Header menu
    const trigger = page.getByRole('button', { name: /^Account menu for Pooja/ });
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'My account' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'My wedding pages' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('"Skip for now" keeps a gentle "Complete your profile" nudge in the header', async ({ page, go }) => {
    await go('/login');
    await page.getByLabel('Your email').fill('skip.demo@example.com');
    await page.getByRole('button', { name: 'Sign in to the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Namaste! Tell us about you' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/#\/account$/);

    const trigger = page.getByRole('button', { name: /Your profile is incomplete/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.getByRole('menuitem', { name: /Complete your profile/ }).click();
    await expect(page).toHaveURL(/#\/account$/);

    // Skipped once: other pages do not send them back to the welcome step.
    await go('/create');
    await expect(page.getByRole('heading', { name: 'Create your shagun page' })).toBeVisible();
  });
});

live.describe('Sign in with the magic link (online mode, mocked Supabase)', () => {
  live.use({ mockOptions: { tables: liveTables() } });

  live('asks for sign-in on couple pages, sends the link, counts down the resend, and signs in from the link @desktop', async ({ page, go, supa }) => {
    await page.clock.install();
    await go('/create');
    await expect(page).toHaveURL(/#\/login\?next=%2Fcreate$/);
    await expect(page.getByText('Sign in to create your wedding page.')).toBeVisible();
    await expect(page.getByText('Demo mode', { exact: false })).toHaveCount(0);

    await page.getByLabel('Your email').fill('Kavya.E2E@Example.com');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.locator('.addr')).toHaveText('Kavya.E2E@Example.com');
    expect(supa.emails).toEqual(['kavya.e2e@example.com']); // recorded by the mock, never sent
    await expect(page.getByRole('link', { name: /Open Gmail/ })).toHaveAttribute('href', /mail\.google\.com/);
    // The free plan's email has only the link: no code is offered.
    await expect(page.getByText('Have a code?')).toHaveCount(0);

    const resend = page.getByRole('button', { name: /You can resend in/ });
    await expect(resend).toBeDisabled();
    await expect(resend).toContainText('1:00');
    await page.clock.runFor(15_000);
    await expect(resend).toContainText('0:45');
    await page.clock.runFor(46_000);
    const again = page.getByRole('button', { name: 'Resend the link' });
    await expect(again).toBeEnabled();
    await again.click();
    await expectToast(page, 'Sent a new link');
    expect(supa.emails).toHaveLength(2);

    await page.getByRole('button', { name: 'Use a different email' }).click();
    await expect(page.getByLabel('Your email')).toHaveValue('Kavya.E2E@Example.com');

    // The couple taps the link in the email: Supabase sends them back with a token in the hash.
    supa.user = COUPLE;
    supa.tables['shagun_profiles'].push(profileRow(COUPLE));
    const token = fakeJwt(COUPLE);
    await page.goto('about:blank');
    await page.goto(`./#access_token=${token}&expires_at=${Math.floor(Date.now() / 1000) + 3600}&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink`);
    // The app returns to where the couple was going.
    await expect(page).toHaveURL(/#\/create$/);
    await expect(page.getByRole('heading', { name: 'Create your shagun page' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Account menu for Kavya/ })).toBeVisible();
    expect(authUser(COUPLE)['email']).toBe(COUPLE.email);
  });

  live('explains Supabase\'s email rate limit kindly', async ({ page, go, supa }) => {
    supa.rateLimitOtp = true;
    await go('/login');
    await page.getByLabel('Your email').fill('kavya.e2e@example.com');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByRole('alert')).toContainText('sends only a couple of sign-in emails an hour');
    await expect(page.getByRole('alert')).not.toContainText('code');
    expect(supa.emails).toEqual([]);
  });

  live('an expired link comes back to the sign-in page with the reason', async ({ page }) => {
    await page.goto('./#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('alert')).toContainText('Email link is invalid or has expired. Ask for a new link below.');
  });

  live('first sign-in without a profile goes to the welcome step, which saves to shagun_profiles', async ({ page, go, supa }) => {
    supa.user = COUPLE;
    await page.goto('about:blank');
    await page.goto(`./#access_token=${fakeJwt(COUPLE)}&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink`);
    await expect(page).toHaveURL(/#\/welcome\?next=%2F$/);
    await page.getByLabel('Your name').fill('Kavya Iyer');
    await page.getByRole('radio', { name: /Bride/ }).click();
    await page.getByLabel('Mobile number').fill('9000011111');
    await page.getByRole('radio', { name: 'हिन्दी' }).click();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expectToast(page, 'Lovely to meet you, Kavya!');
    await expect(page).toHaveURL(/#\/$/);
    const saved = supa.tables['shagun_profiles'].find((p) => p['id'] === COUPLE.id)!;
    expect(saved).toMatchObject({ full_name: 'Kavya Iyer', wedding_role: 'bride', phone: '+919000011111', language: 'hi' });
    void go;
  });
});
