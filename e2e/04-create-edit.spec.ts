import { SAMPLE, expect, expectToast, test } from './fixtures';
import { test as live } from './live-fixtures';
import { demoSignIn, photoFile } from './support/helpers';
import { COUPLE, LIVE_ID, LIVE_SLUG, PARTNER, liveTables, profileRow } from './support/live-data';

// FLOWS.md › C6 Create a wedding page, C7 Edit, C8 Co-owners
test.describe('Create a wedding page (demo)', () => {
  test('from scratch: names, functions, families, gallery, story and dreams with AI, then the dashboard @desktop', async ({ page, go }) => {
    await go('/create');
    await expect(page.getByRole('heading', { name: 'Create your shagun page' })).toBeVisible();

    // Submitting empty shows what is missing.
    await page.getByRole('button', { name: 'Create my page' }).click();
    await expect(page.getByRole('alert')).toHaveText('Some details are missing. Check the fields marked in red.');
    await expect(page.getByText('Add a name.').first()).toBeVisible();
    await expect(page.getByText('Add at least two dreams.')).toHaveCount(0); // two blank rows exist, so the rows themselves complain
    await expect(page.getByText('Give this dream a title.').first()).toBeVisible();

    await page.getByLabel('Partner one').fill('Ishita Kapoor');
    await page.getByLabel('Partner two').fill('Aditya Rao');
    await page.getByLabel('Wedding date').fill('2027-01-24');
    await page.getByPlaceholder('Jagmandir Island Palace').fill('Chokhi Dhani');
    await page.getByLabel('City').fill('Jaipur');
    await page.getByRole('radio', { name: 'rose' }).click();
    await page.getByLabel("Bride's parents").fill('Mrs. Neeta & Mr. Rajiv Kapoor');
    await page.getByLabel("Groom's parents").fill('Mrs. Shobha & Mr. Prakash Rao');

    // Story with AI (offline templates: the free cloud AI is blocked in tests).
    await page.getByRole('button', { name: '✨ Write it with AI' }).click();
    await page.getByLabel('How did you meet?').fill('we met at a book fair in Jaipur arguing over the last copy of a novel');
    await page.getByRole('radiogroup', { name: 'Language' }).first().getByRole('radio', { name: 'Hinglish' }).click();
    await page.getByRole('button', { name: 'Write our story' }).click();
    const story = page.getByLabel('Shown at the top of your page');
    await expect(story).not.toHaveValue('');
    await expect(story).toHaveValue(/book fair/i);

    // Story timeline with AI
    await page.getByRole('button', { name: '✨ Draft with AI' }).click();
    await page.getByRole('button', { name: 'Draft our timeline' }).click();
    await expect(page.getByLabel('Title, moment 1')).not.toHaveValue('');

    // Gallery
    await page.locator('app-gallery-editor input[type=file]').setInputFiles([photoFile('one.png'), photoFile('two.png')]);
    await expect(page.getByLabel('Caption for photo 2')).toBeVisible();
    await page.getByLabel('Caption for photo 1').fill('Roka at Nani’s house');

    // Functions
    const fn = page.getByRole('group', { name: 'Add a function' });
    await fn.getByRole('button', { name: /Haldi/ }).click();
    await fn.getByRole('button', { name: /Sangeet/ }).click();
    await fn.getByRole('button', { name: /Wedding/ }).click();
    await expect(page.locator('app-events-editor').getByRole('button', { name: /^Remove / })).toHaveCount(3);
    await page.locator('app-events-editor').getByRole('button', { name: /^Remove Sangeet/ }).click();
    await expect(page.locator('app-events-editor').getByRole('button', { name: /^Remove / })).toHaveCount(2);
    // Every function except the wedding itself needs its own venue.
    await page.locator('app-events-editor li').first().getByLabel('Venue').fill('Kapoor Haveli courtyard');

    // Dreams: AI suggestions, then reorder and edit
    await page.getByRole('button', { name: '✨ Suggest with AI' }).click();
    await page.getByLabel('What are you saving for?').fill('honeymoon in Bali, a scooter, and a reading nook');
    await page.getByRole('button', { name: 'Suggest dreams and amounts' }).click();
    await expect(page.locator('.suggestions li').first()).toBeVisible();
    await page.getByRole('button', { name: 'Replace my dreams with these' }).click();
    // The form fills in after the click; wait for it instead of reading straight away.
    await expect(page.getByLabel('Dream 1 title')).not.toHaveValue('');
    const firstTitle = await page.getByLabel('Dream 1 title').inputValue();
    await page.getByRole('button', { name: 'Move dream 1 down' }).click();
    await expect(page.getByLabel('Dream 2 title')).toHaveValue(firstTitle);

    await page.getByLabel('UPI ID').fill('ishita.aditya@demo');
    await page.getByLabel('Name on the account').fill('Ishita Kapoor');
    await page.getByRole('button', { name: 'Create my page' }).click();

    await expectToast(page, 'Your page is ready. Share it with your family!');
    await expect(page).toHaveURL(/#\/w\/ishita-weds-aditya\/dashboard$/);
    await expect(page.getByRole('heading', { name: /^Namaste, / })).toBeVisible();

    // The guest page shows what was entered.
    await go('/w/ishita-weds-aditya');
    await expect(page.locator('h1.names')).toContainText('Ishita');
    await expect(page.getByText('Mrs. Neeta & Mr. Rajiv Kapoor')).toBeVisible();
    // Captions show when a photo is opened.
    await page.getByRole('button', { name: 'Open photo: Roka at Nani’s house' }).click();
    await expect(page.getByText('Roka at Nani’s house')).toBeVisible();
  });

  test('prefills the name and UPI ID from the account profile', async ({ page, go }) => {
    await demoSignIn(page, { email: 'prefill.demo@example.com', name: 'Hetal Shah', role: 'Bride', upi: 'hetal.shah@demo' });
    await go('/create');
    await expect(page.getByRole('status').filter({ hasText: /Filled in .* from your account/ })).toBeVisible();
    await expect(page.getByLabel('Partner one')).toHaveValue('Hetal Shah');
    await expect(page.getByLabel('UPI ID')).toHaveValue('hetal.shah@demo');
  });

  test('edit the sample page: changes show on the guest page; Cancel goes back', async ({ page, go }) => {
    await go(`/w/${SAMPLE.riya.slug}/edit`);
    await expect(page.getByRole('heading', { name: 'Update your shagun page' })).toBeVisible();
    await expect(page.getByLabel('Partner one')).toHaveValue('Riya Sharma');
    // The sample cannot be deleted.
    await expect(page.getByRole('button', { name: 'Delete page' })).toHaveCount(0);
    await page.getByPlaceholder('Jagmandir Island Palace').fill('City Palace, Udaipur');
    await page.getByLabel('Show amounts on the blessing wall').check();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Changes saved');
    await expect(page).toHaveURL(new RegExp(`#/w/${SAMPLE.riya.slug}/dashboard$`));
    await go(`/w/${SAMPLE.riya.slug}`);
    await expect(page.locator('.where')).toContainText('City Palace, Udaipur');
    // Amounts now show on the wall.
    await expect(page.locator('.blessing').first()).toContainText('₹');

    await go(`/w/${SAMPLE.riya.slug}/edit`);
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard$`));
  });
});

live.describe('Create, edit and co-owners (online mode, mocked Supabase)', () => {
  live.use({ mockOptions: { user: COUPLE, tables: { ...liveTables(), shagun_profiles: [profileRow(COUPLE)] } } });

  live('creating a page inserts the wedding, uploads photos and makes the creator owner', async ({ page, go, supa }) => {
    await go('/create');
    await expect(page.getByLabel('Partner one')).toHaveValue('Kavya Iyer');
    await page.getByLabel('Partner one').fill('Zoya Khan');
    await page.getByLabel('Partner two').fill('Varun Menon');
    await page.getByLabel('Wedding date').fill('2027-03-07');
    await page.getByPlaceholder('Jagmandir Island Palace').fill('Taj West End');
    await page.getByRole('button', { name: '✨ Suggest with AI' }).click();
    await page.getByRole('button', { name: 'Suggest dreams and amounts' }).click();
    await page.getByRole('button', { name: 'Replace my dreams with these' }).click();
    await page.locator('app-gallery-editor input[type=file]').setInputFiles([photoFile('one.png')]);
    await page.getByRole('button', { name: 'Create my page' }).click();
    await expect(page).toHaveURL(/#\/w\/zoya-weds-varun\/dashboard$/);

    const row = supa.tables['shagun_weddings'].find((w) => w['slug'] === 'zoya-weds-varun')!;
    expect(row).toBeTruthy();
    expect(row['upi_id']).toBe('kavya.iyer@demo');
    const gallery = (row['details'] as { gallery: { url: string }[] }).gallery;
    expect(gallery[0].url).toMatch(/\/storage\/v1\/object\/public\/shagun-photos\/.+\.(jpg|png|webp)$/);
    expect(supa.uploads.some((u) => u.startsWith(`${row['id']}/`))).toBe(true);
  });

  live('editing saves to shagun_weddings; co-owners can be added and removed @desktop', async ({ page, go, supa }) => {
    await go(`/w/${LIVE_SLUG}/edit`);
    await expect(page.getByLabel('Partner one')).toHaveValue('Kavya Iyer');
    await page.getByLabel('City').fill('Bangalore');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Changes saved');
    expect(supa.tables['shagun_weddings'].find((w) => w['id'] === LIVE_ID)!['city']).toBe('Bangalore');

    const owners = page.locator('app-co-owners');
    await expect(owners.getByText(COUPLE.email)).toBeVisible();
    await expect(owners.getByText('You')).toBeVisible();
    await owners.getByPlaceholder("Partner's email").fill('not-an-email');
    await owners.getByRole('button', { name: 'Add co-owner' }).click();
    await expect(owners.getByText(PARTNER.email)).toHaveCount(0);
    await owners.getByPlaceholder("Partner's email").fill(PARTNER.email.toUpperCase());
    await owners.getByRole('button', { name: 'Add co-owner' }).click();
    await expect(owners.getByText(PARTNER.email)).toBeVisible();
    expect(supa.tables['shagun_wedding_owners'].map((o) => o['email'])).toEqual([COUPLE.email, PARTNER.email]);

    await owners.locator('li').filter({ hasText: PARTNER.email }).getByRole('button', { name: 'Remove' }).click();
    await expect(owners.getByText(PARTNER.email)).toHaveCount(0);
    expect(supa.tables['shagun_wedding_owners']).toHaveLength(1);
  });

  live('someone who is not an owner sees the sign-in gate, not the dashboard', async ({ page, go, supa }) => {
    supa.tables['shagun_wedding_owners'] = [];
    await go(`/w/${LIVE_SLUG}/dashboard`);
    await expect(page.getByRole('heading', { name: 'Only the couple can see this dashboard' })).toBeVisible();
  });
});
