import { expect, expectToast, saveDownload, test } from './fixtures';
import { test as live } from './live-fixtures';
import { createSamplePage, demoSignIn, photoFile, upiQrFile } from './support/helpers';
import { COUPLE, LIVE_ID, LIVE_SLUG, liveTables, profileRow } from './support/live-data';
import { readFileSync } from 'node:fs';

// FLOWS.md › C4 Account page
test.describe('Account page (demo account)', () => {
  test.beforeEach(async ({ page }) => {
    await demoSignIn(page, { email: 'riya.demo@example.com', name: 'Riya Sharma' });
  });

  test('profile: edit, validate, crop a photo, remove it @desktop', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Namaste, Riya' })).toBeVisible();
    await expect(page.getByText('Demo account.', { exact: false })).toBeVisible();
    const profile = page.locator('#profile');

    await profile.getByLabel('Mobile number').fill('12345');
    await profile.getByRole('button', { name: 'Save profile' }).click();
    await expect(profile.locator('.error-text')).toContainText(/10-digit|mobile/i);

    await profile.getByLabel('Mobile number').fill('+91 90000 54321');
    await profile.getByLabel('Display name').fill('Riyu');
    await profile.getByLabel('City').fill('Udaipur');
    await profile.getByRole('radio', { name: /Planner/ }).click();
    await profile.getByRole('radio', { name: 'हिन्दी' }).click();
    await expect(profile.getByText('Unsaved changes')).toBeVisible();
    await profile.getByRole('button', { name: 'Save profile' }).click();
    await expectToast(page, 'Profile saved');
    await expect(profile.getByRole('status')).toContainText('Saved');
    await expect(page.getByRole('heading', { name: 'Namaste, Riyu' })).toBeVisible();

    // Photo: pick, crop (zoom + keyboard nudge), use.
    await profile.locator('[data-test=avatar-file]').setInputFiles(photoFile());
    const cropper = page.getByRole('group', { name: 'Crop your photo' });
    await expect(cropper).toBeVisible();
    await cropper.getByLabel('Zoom').fill('1.6');
    await cropper.getByLabel(/Photo position/).press('ArrowRight');
    await cropper.getByRole('button', { name: 'Use this photo' }).click();
    await expectToast(page, 'Photo updated');
    await expect(cropper).toBeHidden();
    await expect(profile.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(page.locator('header.hero img').first()).toHaveAttribute('src', /^data:image\/jpeg/);

    await profile.getByRole('button', { name: 'Remove' }).click();
    await expectToast(page, 'Photo removed');
    await expect(profile.getByText('Add a photo')).toBeVisible();

    // Survives a reload (localStorage in demo mode).
    await page.reload();
    await expect(page.locator('#profile').getByLabel('City')).toHaveValue('Udaipur');
  });

  test('payment defaults: UPI ID check, read it from a QR, and prefill a new page', async ({ page }) => {
    const pay = page.locator('#payments');
    await pay.getByLabel('Default UPI ID').fill('not-a-upi');
    await pay.getByRole('button', { name: 'Save payment details' }).click();
    await expect(pay.locator('.error-text')).toBeVisible();

    await pay.locator('[data-test=upi-qr-file]').setInputFiles(upiQrFile('upi://pay?pa=riya.sharma%40demo&pn=Riya%20Sharma&cu=INR'));
    await expect(pay.getByRole('status')).toContainText('Found: riya.sharma@demo (Riya Sharma), is this correct?');
    await pay.getByRole('button', { name: 'Yes, use it' }).click();
    await expectToast(page, 'UPI ID filled in from your QR. Save to keep it.');
    await expect(pay.getByLabel('Default UPI ID')).toHaveValue('riya.sharma@demo');
    await pay.getByRole('button', { name: 'Save payment details' }).click();
    await expectToast(page, 'Payment details saved');

    // A QR that is not a UPI QR is explained, not accepted.
    await pay.locator('[data-test=upi-qr-file]').setInputFiles(upiQrFile('https://example.com/menu', 'menu.png'));
    await expect(pay.getByRole('alert')).toBeVisible();

    // New pages start with these details.
    await page.locator('#weddings').getByRole('link', { name: /Create a new wedding page/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'from your account' })).toBeVisible();
    await expect(page.getByLabel('UPI ID')).toHaveValue('riya.sharma@demo');
    await expect(page.getByLabel('Name on the account')).toHaveValue('Riya Sharma');
  });

  test('my pages, notifications, data download, sign out', async ({ page }, testInfo) => {
    const pages = page.locator('#weddings');
    await expect(pages.locator('.page-row')).toHaveCount(3);
    await expect(pages.getByText('Sample').first()).toBeVisible();
    await expect(pages.getByText('Riya & Arjun')).toBeVisible();
    await expect(pages.getByText('Hetal & Parth')).toBeVisible();
    await expect(pages.getByText('Meenakshi & Rohan')).toBeVisible();
    await expect(pages.getByText('No wedding pages of your own yet.')).toBeVisible();

    const notify = page.locator('#notifications');
    await expect(notify.getByText('Coming soon')).toBeVisible();
    await notify.locator('[data-test=notify-rsvp]').uncheck();
    await expect(notify.getByRole('status')).toContainText('Saved');
    await page.reload();
    await expect(page.locator('[data-test=notify-rsvp]')).not.toBeChecked();
    await expect(page.locator('[data-test=notify-shagun]')).toBeChecked();

    const { name, file } = await saveDownload(page, () => page.locator('[data-test=download]').click(), testInfo);
    expect(name).toMatch(/^gathbandhan-.*\.json$/);
    const data = JSON.parse(readFileSync(file, 'utf8'));
    expect(JSON.stringify(data)).toContain('riya.demo@example.com');
    expect(JSON.stringify(data)).toContain('Riya Sharma');

    // In demo mode both buttons sign out this browser.
    await expect(page.getByText('In demo mode both sign out this browser.')).toBeVisible();
    await page.locator('[data-test=signout-global]').click();
    await expect(page).toHaveURL(/#\/login/);
  });

  test('delete account: type DELETE, keep or delete own pages', async ({ page, go }) => {
    // Make a page of our own first, so there is something to choose about.
    await createSamplePage(page);
    await go('/account');

    const zone = page.locator('#privacy');
    await zone.locator('[data-test=delete-open]').click();
    await expect(zone.getByRole('heading', { name: 'Delete your account?' })).toBeVisible();
    const confirm = zone.locator('[data-test=delete-confirm]');
    await expect(confirm).toBeDisabled();
    await zone.locator('[data-test=delete-word]').fill('DELET');
    await expect(confirm).toBeDisabled();
    await zone.locator('[data-test=delete-word]').fill('delete'); // any case works
    await expect(confirm).toBeEnabled();
    await zone.getByRole('button', { name: 'Keep my account' }).click();
    await expect(zone.locator('[data-test=delete-open]')).toBeVisible();

    await zone.locator('[data-test=delete-open]').click();
    await zone.locator('[data-test=delete-weddings]').check();
    await zone.locator('[data-test=delete-word]').fill('DELETE');
    await confirm.click();
    await expectToast(page, /Your account and 1 wedding page were deleted/);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { name: 'Your wedding pages' })).toHaveCount(0);
  });
});

live.describe('Account page (online mode, mocked Supabase)', () => {
  live.use({ mockOptions: { user: COUPLE, tables: { ...liveTables(), shagun_profiles: [profileRow(COUPLE)] } } });

  live('loads the profile, saves edits, uploads the photo to storage, and lists owned pages @desktop', async ({ page, go, supa }) => {
    await go('/account');
    await expect(page.getByRole('heading', { name: 'Namaste, Kavya' })).toBeVisible();
    await expect(page.locator('#weddings').getByText('Kavya & Nikhil')).toBeVisible();
    await expect(page.locator('#weddings .page-row').filter({ hasText: 'Kavya & Nikhil' }).getByText('Owner')).toBeVisible();

    await page.locator('#profile').getByLabel('City').fill('Mysuru');
    await page.locator('#profile').getByRole('button', { name: 'Save profile' }).click();
    await expectToast(page, 'Profile saved');
    expect(supa.tables['shagun_profiles'][0]['city']).toBe('Mysuru');

    await page.locator('[data-test=avatar-file]').setInputFiles(photoFile());
    await page.getByRole('button', { name: 'Use this photo' }).click();
    await expectToast(page, 'Photo updated');
    expect(supa.uploads.some((u) => u.startsWith(`avatars/${COUPLE.id}/`))).toBe(true);
    expect(String(supa.tables['shagun_profiles'][0]['avatar_path'])).toMatch(new RegExp(`^avatars/${COUPLE.id}/.+\\.jpg$`));
    await expect(page.locator('header.hero img').first()).toHaveAttribute('src', /storage\/v1\/object\/public\/shagun-photos\/avatars\//);
  });

  live('sign out of all devices revokes every session', async ({ page, go, supa }) => {
    await go('/account');
    await page.locator('[data-test=signout-global]').click();
    await expect(page).toHaveURL(/#\/login/);
    expect(supa.signOuts).toContain('global');
  });

  live('delete account calls the Edge Function with the choice, then signs out', async ({ page, go, supa }) => {
    supa.onFunction('shagun-delete-account', (body) => {
      if (body['deleteWeddings']) supa.tables['shagun_weddings'] = supa.tables['shagun_weddings'].filter((w) => w['id'] !== LIVE_ID);
      return { json: { weddingsDeleted: body['deleteWeddings'] ? 1 : 0, weddingsLeft: 0 } };
    });
    await go('/account');
    const zone = page.locator('#privacy');
    await zone.locator('[data-test=delete-open]').click();
    await expect(zone.getByText(/Also delete the wedding page I own/)).toBeVisible();
    await zone.locator('[data-test=delete-weddings]').check();
    await zone.locator('[data-test=delete-word]').fill('DELETE');
    await zone.locator('[data-test=delete-confirm]').click();
    await expectToast(page, 'Your account and 1 wedding page were deleted. Take care!');
    await expect(page).toHaveURL(/#\/$/);
    const call = supa.functionCalls.find((c) => c.name === 'shagun-delete-account')!;
    expect(call.body).toEqual({ deleteWeddings: true });
    expect(call.auth).toMatch(/^Bearer ey/);
    expect(supa.tables['shagun_weddings'].find((w) => w['slug'] === LIVE_SLUG)).toBeUndefined();
  });

  live('delete account explains when the function is not deployed, and deletes nothing', async ({ page, go }) => {
    await go('/account');
    const zone = page.locator('#privacy');
    await zone.locator('[data-test=delete-open]').click();
    await zone.locator('[data-test=delete-word]').fill('DELETE');
    await zone.locator('[data-test=delete-confirm]').click();
    await expect(zone.getByRole('alert')).toContainText('Account deletion is not switched on yet');
    await expect(page).toHaveURL(/#\/account$/);
  });
});
