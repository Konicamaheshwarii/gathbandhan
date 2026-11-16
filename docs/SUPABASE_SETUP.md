# Put Gathbandhan online with Supabase (free, about 15 minutes)

Right now Gathbandhan runs in **demo mode**: every wedding page lives only in the browser where it was made. Guests on other phones can still pay by UPI, but the couple's dashboard does not see their blessings.

Connecting **Supabase** (a free online database) fixes that. After these steps:

- a wedding page opens on any phone with a short link like `…/#/w/riya-weds-arjun`;
- every guest's shagun, blessing and RSVP reaches the couple's dashboard, live;
- couples sign in with just their email (no password), and only they can edit their page and see guests' phone numbers.

> **Where things stand now:** the Supabase project already exists (`https://ktajpcjnkiyvfjmihspq.supabase.co`) and its URL and publishable key are already in `public/config.json`. What is left is **step 3 (paste `schema.sql` and click Run)**, then steps 4 to 6 and 9. Until step 3 is done, the site notices that the tables are missing and keeps running in demo mode, with a note at the top of every page.
>
> The project is shared with another app (Saarthi), so every Gathbandhan table, function and photo bucket starts with `shagun_`, from the app's original name, Shagun (`shagun_weddings`, `shagun_contributions`, `shagun-photos`…). The schema never touches anything else.

You do not need to write any code. You will click through Supabase's website, paste one file, and copy two values into one file on GitHub.

> **Cost:** Supabase's free plan is enough for many weddings (500 MB database, 1 GB photo storage). It asks for no credit card. A free project is paused after a week with no visits; open the site once and it wakes up again within a minute.

---

## Step 1. Create a Supabase account

1. Go to **https://supabase.com** and click **Start your project**.
2. Click **Continue with GitHub** and sign in with the same GitHub account that hosts Gathbandhan (`Konicamaheshwarii`). Allow access when GitHub asks.

## Step 2. Create the project

1. Click **New project**.
2. **Organization:** keep the one Supabase made for you (your name).
3. **Project name:** `gathbandhan`
4. **Database password:** click **Generate a password**, then **Copy** and save it somewhere safe (a notes app is fine). Gathbandhan never needs it, but Supabase may ask for it later.
5. **Region:** choose **South Asia (Mumbai)**. It is the closest to Indian guests, so pages load fastest.
6. Click **Create new project** and wait 1–2 minutes until the dashboard says the project is ready.

## Step 3. Create the tables (paste one file)

1. Open this file in the Gathbandhan repository on GitHub: **`supabase/schema.sql`**. Click the **Copy raw file** button (two overlapping squares, top right of the file).
2. In Supabase, click **SQL Editor** in the left menu (the icon looks like `>_`).
3. Click **New query** (or the **+** button). A big empty box appears.
4. Click inside it, press **Ctrl + V** (or **Cmd + V** on a Mac) to paste.
5. Click the green **Run** button (bottom right), or press **Ctrl + Enter**.
6. You should see **"Success. No rows returned"**. That is good. In **Table Editor** you should now see six tables starting with `shagun_` (the sixth, `shagun_payout_accounts`, is only used by the optional Razorpay payments in [RAZORPAY_SETUP.md](RAZORPAY_SETUP.md)).

   - If Supabase shows a warning about "destructive operations", click **Run this query**. The file only removes and re-creates its own security rules.
   - It is safe to run the file again later (for example after an update to Gathbandhan).

## Step 4. Turn on email sign-in

1. Left menu: **Authentication** → **Sign In / Providers** (on some accounts it is **Providers**).
2. Make sure **Email** is **Enabled**. Keep **Confirm email** turned on.
3. Click **Save** if you changed anything.

## Step 5. Tell Supabase where the site lives

1. Left menu: **Authentication** → **URL Configuration**.
2. **Site URL:** replace what is there with

   ```
   https://konicamaheshwarii.github.io/gathbandhan/
   ```

   and click **Save**.
3. Under **Redirect URLs**, click **Add URL**, paste the same address

   ```
   https://konicamaheshwarii.github.io/gathbandhan/
   ```

   and click **Save URLs**.
4. *(Optional, for testing on your own computer)* add `http://localhost:4200/` as a second redirect URL.

## Step 6 (optional). Let couples type a 6-digit code

The sign-in email contains a link. Some phones open email links inside the Gmail app's own browser, which is a different browser from the one the couple started in. A short code avoids that problem:

1. **Authentication** → **Emails** (or **Email Templates**).
2. Open the **Magic Link** template. Below the existing link, add a line:

   ```
   Or type this code in Gathbandhan: {{ .Token }}
   ```

3. Click **Save**. Do the same in the **Confirm signup** template (first-time sign-ins use that one).

## Step 7. Copy your two keys

1. Left menu: **Project Settings** (gear icon at the bottom) → **Data API** (on some accounts **API**).
   - Copy the **Project URL**. It looks like `https://abcdefghijklm.supabase.co`.
2. Still in Project Settings, open **API Keys**.
   - Copy the **anon** **public** key (a long text starting with `eyJ…`). If you see a newer **Publishable key** (starting with `sb_publishable_…`), you can use that instead.

   **Never copy the `service_role` / secret key.** Gathbandhan does not need it, and it must never be put on a website.

> **Is it safe to publish the anon key?** Yes. It is designed to be public: it is inside every Supabase website. What protects your data is **Row Level Security**, which `schema.sql` switched on. With the anon key a stranger can only do what a wedding guest can do: open a wedding page, see totals and blessings (never phone numbers), and add a blessing or an RSVP within sensible limits (₹1 to ₹1,00,000, messages up to 280 characters).

## Step 8. Paste the keys into Gathbandhan

1. On GitHub, open the Gathbandhan repository and go to the file **`public/config.json`**.
2. Click the **pencil** icon (Edit this file).
3. Put your two values between the quotes, so it looks like this (with your own values):

   ```json
   {
     "supabaseUrl": "https://abcdefghijklm.supabase.co",
     "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
   }
   ```

4. Click **Commit changes…** → **Commit changes**.
5. GitHub rebuilds the site automatically. Open the **Actions** tab and wait for the green tick (2–3 minutes).

## Step 9. Check that it works

1. Open **https://konicamaheshwarii.github.io/gathbandhan/**. The small "Demo mode: data stays in this browser" strip at the top should be **gone**, and the header shows **Sign in**. If the strip is still there, it says why (for example "the online database is not set up yet": run step 3).
2. Click **Create** → enter your email → open the email from Supabase → tap the link (or type the code).
3. Create a test wedding page. Open its link on another phone, give a test blessing with "I've paid", and watch it appear on the dashboard within a few seconds.
4. In the dashboard, under **Who can manage this page**, add your partner's email. They sign in with that email and see the same dashboard.

The sample wedding (Riya & Arjun) keeps working for everyone; it always stays in each visitor's own browser.

## Step 10 (optional but recommended). Let people delete their account

The account page (**#/account**) has **Delete my account**. Removing a Supabase sign-in needs the secret service-role key, which must never be in the website, so a tiny server function does it:

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**. Name it exactly `shagun-delete-account`.
2. Paste the whole file `supabase/functions-paste/shagun-delete-account.ts` and click **Deploy**. (With the Supabase CLI: `supabase functions deploy shagun-delete-account --no-verify-jwt`.)
3. In the function's **Settings**, turn **Verify JWT** off: the function checks the person's sign-in itself and only ever deletes the caller's own data.

It needs no secrets of its own (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase) and, like the Razorpay functions, answers only the GitHub Pages site and `localhost`. Until it is deployed, the button explains that deletion is not switched on yet and deletes nothing.

---

## Good to know

- **Emails:** Supabase's built-in email sender is meant for small projects and only sends a few sign-in emails per hour. That is plenty for a couple signing in. If you ever need more, Supabase lets you connect a free email service (Authentication → Emails → SMTP settings).
- **Profiles:** each signed-in person has one row in `shagun_profiles` (name, phone, city, role, language, default UPI ID, notification choices). Row Level Security lets each person read and change only their own row; guests cannot see any. Avatars are 256 px JPEGs in `shagun-photos/avatars/<user id>/`, a folder only that person can write.
- **Photos** are resized on the phone before upload (usually under 200 kB each) and stored in the `shagun-photos` storage bucket, in a folder per wedding.
- **Guest lists** for e-invites are private to the couple. Each guest's personal invite link carries a random code that only lets that guest see their own name and tick off "opened", "RSVP'd" and "gave shagun".
- **Going back to demo mode:** empty both values in `public/config.json` and commit. Nothing in Supabase is deleted.
- **Backups:** Supabase → **Table Editor** → pick a table → **Export to CSV**. The couple can also export shagun and RSVP lists from their dashboard.
- **Something went wrong?** Supabase → **Logs** shows recent errors. Running `schema.sql` again never deletes data.
