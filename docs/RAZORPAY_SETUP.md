# Optional: Razorpay payments in **test mode** (free, about 30 minutes)

By default, guests pay the couple **directly by UPI**: Gathbandhan opens their UPI app with the amount filled in, the guest taps "I've paid", and the couple ticks each blessing off against their bank app. That stays the default and needs nothing from this guide.

This guide switches on a second, optional way to pay: **Razorpay (instant confirmation)**. Guests can then pay by UPI, card or netbanking through Razorpay's own checkout window, and each blessing is marked **"✓ Paid"** automatically, only after the server has checked Razorpay's signature. The couple chooses per wedding which way their guests pay (**Dashboard → 💳 Payments**).

> **Everything in this guide is free and uses Razorpay Test Mode.** Test mode needs no KYC, no business documents and no money. Guests see a clear **"Test mode, no real money"** badge, and only Razorpay's test UPI ID and test cards work. Taking real money is a separate, later step, in the short section at the end.

> **What is already done:** the Razorpay **test Key ID** (`rzp_test_U0ji8fNKqRx1PE`) is already in `public/config.json`. That key is public by design. What is left is steps 1 to 7 below, which need the **Key Secret**, and that you keep yourself.

> **Before you start:** Razorpay mode needs the online backend. Finish [`docs/SUPABASE_SETUP.md`](SUPABASE_SETUP.md) first (at least step 3, "paste `schema.sql` and Run"). If you ran `schema.sql` before Razorpay was added, **run it again**: it is safe to run twice and adds the payment columns.

**Until these steps are done, nothing breaks.** The app notices that the payment server is missing, says "being set up" to couples, and guests simply pay by UPI directly.

### The one rule about keys

Razorpay gives you two values:

| Value | Looks like | Where it goes | Secret? |
|---|---|---|---|
| **Key ID** | `rzp_test_U0ji8fNKqRx1PE` | `public/config.json` (already there) | No, it is public |
| **Key Secret** | a long random string | **only** Supabase → Edge Functions → Secrets | **Yes. Never** put it in GitHub, config.json, a chat or an email |

Gathbandhan's code never contains the Key Secret, and the app ignores anything in `config.json` that is not a Key ID.

---

## Step 1. Sign up at Razorpay (free) and stay in Test Mode

1. Go to **https://razorpay.com** and click **Sign Up**. Use your email and mobile number; it is free.
2. Razorpay may ask business questions to "activate your account". **You can skip them for now**: test mode works without them.
3. In the Razorpay Dashboard, look at the **mode switch** at the top (it says **Test Mode** or **Live Mode**). Make sure it says **Test Mode**. Everything below happens in test mode.

## Step 2. Get your test API keys

1. In the Dashboard (Test Mode): **Account & Settings** → **API Keys** (on older screens: **Settings → API Keys**).
2. Click **Generate Test Key** (or **Regenerate**, if a key exists and you no longer have its secret).
3. A box shows the **Key Id** and the **Key Secret**. Click **Download Key Details** and keep that file somewhere private. **Razorpay shows the secret only once.**
4. Check that the Key Id matches the one in `public/config.json` (`rzp_test_U0ji8fNKqRx1PE`). If you generated a new key, put the new **Key Id** (never the secret) into `public/config.json`; see step 7.

## Step 3. Turn on Route (test mode)

Route is the Razorpay feature that sends each guest's payment on to the couple's own bank account.

1. Dashboard (Test Mode): left menu **Route** (sometimes under **Payments → Route**, or **Products**).
2. If you see **Activate** or **Request access**, click it. In test mode it usually turns on at once.
3. If Route is not offered in your test account, carry on anyway. Gathbandhan then uses a **test-only fallback**: payments still work end to end and are marked paid, but they are not transferred to the couple (it is pretend money anyway). The couple's payment page says "Test-only setup" when this happens.

## Step 4. Deploy the four Edge Functions

The payment server is four small "Edge Functions" in your Supabase project:

| Function | What it does |
|---|---|
| `razorpay-create-order` | Checks the guest's amount and details, records a pending blessing, creates the Razorpay order |
| `razorpay-verify` | Checks Razorpay's signature after checkout and marks the blessing paid |
| `razorpay-webhook` | Razorpay calls it directly, so payments confirm even if the guest closes the tab |
| `razorpay-linked-account` | Couple only: sets up the account where their shagun settles |

**Important for all four:** turn **off** "Enforce JWT verification" (also called "Verify JWT"). Guests are not signed in, and Razorpay's webhook has no Supabase token. The functions do their own checks: signatures, allowed websites, and for `razorpay-linked-account`, the couple's sign-in.

### Option A: in the Supabase dashboard (no tools needed)

Do this four times, once per function name above:

1. Supabase → your project → left menu **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. **Function name:** type the name exactly, e.g. `razorpay-create-order`.
3. In the repository on GitHub, open **`supabase/functions-paste/razorpay-create-order.ts`** (same name), click **Copy raw file**.
4. In the Supabase editor, select everything in the code box (**Ctrl + A**), paste (**Ctrl + V**).
5. Open the function's **Details / Settings** and switch **Enforce JWT verification** **off**.
6. Click **Deploy function**. Wait for "Deployed".

The files in `supabase/functions-paste/` are the same code as `supabase/functions/`, joined into one file each so they can be pasted.

### Option B: with the Supabase CLI (for people comfortable with a terminal)

1. Install it: https://supabase.com/docs/guides/cli (or use `npx supabase`).
2. In a terminal, inside the Gathbandhan folder:

   ```bash
   npx supabase login
   npx supabase link --project-ref ktajpcjnkiyvfjmihspq
   npx supabase functions deploy razorpay-create-order --no-verify-jwt
   npx supabase functions deploy razorpay-verify --no-verify-jwt
   npx supabase functions deploy razorpay-webhook --no-verify-jwt
   npx supabase functions deploy razorpay-linked-account --no-verify-jwt
   ```

## Step 5. Add the secrets in Supabase

1. Supabase → **Edge Functions** → **Secrets** (sometimes **Manage secrets** or **Project Settings → Edge Functions**).
2. Add these, one by one (**Add new secret** → name → value → **Save**):

   | Name | Value |
   |---|---|
   | `RAZORPAY_KEY_ID` | your test Key Id, `rzp_test_…` |
   | `RAZORPAY_KEY_SECRET` | your test Key Secret (from step 2) |
   | `RAZORPAY_WEBHOOK_SECRET` | a password you make up now, e.g. 24 random letters and numbers. Write it down for step 6 |

3. Optional ones (leave them out to use the defaults): `GATEWAY_FEE_BPS` (fee estimate, default `236` = 2% + GST), `PLATFORM_FEE_BPS` (your own platform fee, default `0` = none), and `RAZORPAY_ROUTE_CATEGORY` / `RAZORPAY_ROUTE_SUBCATEGORY` if Razorpay rejects the default business category (`others`).

Supabase adds `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` by itself; do not add them. The file `supabase/functions/.env.example` lists the same names with placeholder values, for local testing.

## Step 6. Add the webhook in Razorpay

1. Razorpay Dashboard (Test Mode) → **Account & Settings** → **Webhooks** → **Add New Webhook**.
2. **Webhook URL:**

   ```
   https://ktajpcjnkiyvfjmihspq.supabase.co/functions/v1/razorpay-webhook
   ```

3. **Secret:** the same `RAZORPAY_WEBHOOK_SECRET` you made up in step 5.
4. **Active events:** tick
   - `payment.captured`, `payment.failed`
   - `order.paid`
   - `transfer.processed`, `transfer.failed` (if listed)
   - `account.activated`, `account.under_review`, `account.needs_clarification` (if listed, for Route)
5. **Alert email:** your email. Click **Create Webhook**.

## Step 7. Check `public/config.json`

It should look like this (the Supabase values are already there):

```json
{
  "supabaseUrl": "https://ktajpcjnkiyvfjmihspq.supabase.co",
  "supabaseAnonKey": "sb_publishable_…",
  "razorpayKeyId": "rzp_test_U0ji8fNKqRx1PE"
}
```

If you changed it: on GitHub open the file, click the pencil (**Edit**), change only the Key Id, **Commit changes**. The site redeploys in about two minutes. **Only the Key Id goes here, never the secret.**

## Step 8. Try it with Razorpay's test details

1. Sign in on the site as a couple, open your **Dashboard → 💳 Payments**.
2. Choose **Razorpay (instant confirmation)**, pick who pays the fee, click **Save**.
3. Fill in **Where your shagun settles** and click **Send to Razorpay**. In test mode any real-looking details work (a PAN like `ABCDE1234F`, IFSC like `HDFC0001234`); nothing is checked or charged.
4. Open your wedding page on another phone (or a private window) and give shagun. In the Razorpay window use:
   - **UPI:** `success@razorpay` (pays) or `failure@razorpay` (fails);
   - **Card:** `4100 2800 0000 1007`, any future expiry date, any CVV, and any OTP of 4 or more digits on the test bank page.
5. You should see **"✓ Payment confirmed"**, the blessing shows **"✓ Paid"** on the wall, and your dashboard shows it under **Paid via Razorpay** with its payment ID (CSV export includes it too).
6. Also try closing the window, or `failure@razorpay`: the guest sees "nothing was charged" and **Try again**.

Razorpay keeps the list of test cards here: https://razorpay.com/docs/payments/payments/test-card-details/

### If something does not work

| You see | Likely cause |
|---|---|
| Guests are sent to "pay by UPI directly" with "still being set up" | A function is not deployed, its JWT check is still on, or a secret is missing (step 4 or 5) |
| Couple's payments page says "being set up by the site owner" | `razorpay-linked-account` is not deployed or its JWT check is on |
| Payment succeeds but stays "being confirmed" | Webhook URL or secret differs from step 6; `RAZORPAY_KEY_SECRET` is wrong |
| "Origin not allowed" | The site was opened from an address other than `konicamaheshwarii.github.io` or `localhost` |

Logs: Supabase → **Edge Functions** → pick a function → **Logs**. The functions never log keys, bank numbers or PAN.

---

## Fees and settlement, plainly

- **Test mode: no fees, no money.** Nothing on this page costs anything while you are in test mode.
- **Live mode (later):** Razorpay charges a fee per payment, **about 2% + 18% GST** for most UPI, cards and netbanking payments in India; some cards cost more, and Route transfers can have their own small fee. **Check the current prices at https://razorpay.com/pricing/**. Gathbandhan's estimate (2.36%) is only an estimate.
- **Who pays the fee** is the couple's choice on their Payments page: **the couple** (the guest pays ₹2,100, the couple receives about ₹2,050) or **the guest** (a "convenience fee" line is added, about ₹2,151 for ₹2,100, and the couple receives the full ₹2,100).
- **Platform fee:** none by default (`PLATFORM_FEE_BPS` = 0).
- **Settlement:** Razorpay pays the couple's linked account in about **2 working days** after each payment (Route schedule). Direct UPI is instant and free, which is why it stays the default.

> **This is not legal or tax advice.** Shagun is generally a personal gift, but collecting payments through a gateway may have tax or compliance implications for you as the platform owner and for the couple. If you are unsure, ask a chartered accountant.

---

## Later: taking real money

Only when the test flow works and you really want to accept real payments:

1. **Activate your Razorpay account (KYC).** Razorpay Dashboard → **Activate Account**. You need your **PAN**, a **bank account**, business details, and a **website**: use `https://konicamaheshwarii.github.io/gathbandhan/`. Approval takes a few days.
2. **Ask for Route in live mode.** Dashboard (Live Mode) → **Route** → request activation. Razorpay reviews the use case (shagun passed on to the couple) and may ask questions.
3. **Generate live keys.** Switch the Dashboard to **Live Mode** → **API Keys** → **Generate Live Key**.
4. **Swap the secrets** in Supabase (step 5): `RAZORPAY_KEY_ID` = `rzp_live_…`, `RAZORPAY_KEY_SECRET` = the live secret.
5. **Add the webhook again in Live Mode** (step 6; live and test webhooks are separate) and use the same `RAZORPAY_WEBHOOK_SECRET`.
6. **Put the live Key Id** into `public/config.json` (step 7). The "Test mode" badges disappear.
7. Each couple then fills in **Where your shagun settles** with their real details. In live mode Razorpay checks PAN and bank (KYC), so guests only see Razorpay once the couple's account is **Active**; until then they pay by UPI directly.
