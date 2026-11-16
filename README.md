<img src="public/icons/icon.svg" width="72" height="72" alt="Gathbandhan logo: a maroon and a gold thread tied into one knot" align="right">

# Gathbandhan: wedding e-invites & digital shagun

![Angular](https://img.shields.io/badge/Angular-20-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Zoneless](https://img.shields.io/badge/change%20detection-zoneless%20%2B%20signals-0f766e)
![Supabase](https://img.shields.io/badge/backend-Supabase%20%2B%20RLS%20(optional)-3ECF8E?logo=supabase&logoColor=white)
![AI](https://img.shields.io/badge/AI-free%2C%20no%20key%20%7C%20Chrome%20AI%20%7C%20Gemini%20%7C%20Groq-8E75B2)
![PWA](https://img.shields.io/badge/PWA-installable%20%2B%20offline-5A0FC8)
![UPI](https://img.shields.io/badge/payments-UPI%20intent%20%2B%20QR-097939)
![CI](https://github.com/Konicamaheshwarii/gathbandhan/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)

At Indian weddings, guests give gifts the couple did not ask for: the fourth mixer-grinder, another dinner set. Gathbandhan turns the cash gift guests *already* give into something meaningful, and handles the rest of the wedding admin on the way. The couple designs a **digital kankotri** (wedding invitation) in English, हिन्दी or ગુજરાતી, sends every guest a personal invite on WhatsApp, collects **RSVPs per function** (haldi to reception), and lists two to five real dreams (a honeymoon, a first home) that guests bless with any amount, paid straight to the couple from their own UPI app.

The name is the *gathbandhan*, the sacred knot that ties the couple together during the pheras; the logo is that knot, a maroon and a gold thread tied into a heart. It is deliberately framed as **digital shagun**, not a fundraiser, because Indian couples hesitate to "ask for money". It is UPI-first, WhatsApp-native, free, and works as an installable phone app.

**[▶ Live demo](https://konicamaheshwarii.github.io/gathbandhan/)**: opens with a sample wedding (Riya & Arjun) with a finished invite and 25 guests. No sign-up needed.

![Landing page on desktop](docs/screenshots/desktop-home.png)

| Personal web invite | Exported invite (Gujarati, 1080 × 1920) | Guest list and sending |
|---|---|---|
| ![Web invite greeting a guest by name](docs/screenshots/mobile-invite.png) | ![Gujarati kankotri exported as PNG](docs/screenshots/invite-export-gujarati.png) | ![Guest tracker](docs/screenshots/mobile-guests.png) |

## Features

### E-invite: a digital kankotri
- **Ten styles, each with its own layout**, not one layout in different colours. All art is original SVG drawn in code (no stock art): *Shree Ganesh classic* (double-ruled frame, kumkum red on ivory), *Rajasthani jharokha* (haveli arches, marigold toran, elephants), *Gujarati kankotri* (full bandhani pattern, mirror work, red and green), *South Indian temple* (gopuram, banana leaves, kolam), *Royal monogram* (gold filigree crest on maroon), *Modern minimal* (editorial type, knot monogram), *Floral watercolour*, *Mehndi line-art* (henna mandala), *Photo-first* (the couple's photo as a poster) and *Phulkari* (Punjabi embroidery bands). Colours are editable.
- **Style slider** on the landing page and in the designer: the centred card shows each style, with arrows, dots, swipe, arrow keys, and an autoplay that pauses on touch and stays off for reduced motion. "Use this style" opens the designer with it selected.

![Invite style slider](docs/screenshots/desktop-styles-slider.png)
- **Multi-page invite**: cover (invocation, optional Ganesh shlok, *Shubh Vivah*, names, date), invitation ("With the blessings of… we cordially invite you and your family"), families (grandparents, both sets of parents, *Swagatotsuk* and *Darshanabhilashi* name lists), the functions three to a page, and a closing page with QR codes for RSVP, shagun and the venue map.
- **Four languages**: English, Hindi, Gujarati and Hinglish, with Tiro Devanagari Hindi, Rasa and Mukta Vaani loaded from Google Fonts only on invite pages (unicode-range subsets). Dates and times are localised (`गुरुवार, 10 दिसंबर 2026`, `ગુરુવાર, 10 ડિસેમ્બર, 2026`).
- **Animated web invite** at `#/i/:slug`, or `#/i/:slug/:guestToken` to greet one guest ("Namaste, Gupta Parivar"). Pages turn in as you scroll; a floating bar offers RSVP, give shagun, add to calendar, share, and a soft **shehnai** synthesised with the Web Audio API (off until tapped, no audio files).
- **Exports in the browser**: every page as a 1080 × 1920 PNG (WhatsApp status size) and the whole invite as a PDF, using html-to-image (lazy-loaded) and a small JPEG-to-PDF writer.

### Guest list and sending
- Add guests by hand, **import a CSV**, **paste** lines from contacts or Excel ("Pooja Bua +91 98765 01234"), or use the **phone contact picker** on Android. Duplicates are skipped by phone number or name.
- Each guest gets a personal link and a greeting ("Sharma Parivar"). **Send on WhatsApp** opens `wa.me` with a personalised message; AI can rewrite the message in any of the four languages and three tones.
- **Send next 10**: a queue that opens WhatsApp one guest at a time. Nothing is ever sent automatically.
- **Tracking**: not sent → sent → opened → RSVP'd → gave shagun, with counts and filters by status and group. With the backend, opens are recorded from every phone; in demo mode only opens in the same browser count.

### Wedding page, RSVPs and shagun
- **Public page** per wedding with the parents' names, a **functions timeline** (date, time, venue, Google Maps link, dress code) with **Add to Google Calendar** and **.ics** downloads, an **our story** timeline, a **photo gallery**, and progress per dream with the couple's **goal updates** ("Flights booked!").
- **RSVP** per function with party size, side and a note. The couple sees headcount per function and exports a CSV for the caterer.
- **Shagun by UPI**: pick a dream, tap ₹501, ₹1,100, ₹2,100 or ₹5,100 (or any amount up to the ₹1,00,000 UPI limit), choose bride's or groom's side, and pay with a standard NPCI `upi://pay` link or QR. The money never touches Shagun; the couple verifies each blessing against their bank app.
- **Blessing wall**, live across tabs (demo) or devices (backend). Amounts stay hidden unless the couple shows them; phone numbers are never public.
- **Printable venue QR card** in A6 or A5.

### Couple dashboard
Cover hero with days to go, quick actions, stat cards (shagun blessed, verified, guests invited, invites opened, people coming, blessings), **shagun over time** (single-series area chart with a crosshair tooltip and a table view), **bride's side vs groom's side** (100% bar; the two hues were checked for colour-blind separation in light and dark mode), photo goal cards with update posting, a **recent activity** feed, a **wedding checklist**, RSVPs by function, co-owners, CSV exports and AI thank-you notes in English, हिन्दी or Hinglish.

| Dashboard | Invite designer |
|---|---|
| ![Couple dashboard](docs/screenshots/desktop-dashboard.png) | ![Invite designer](docs/screenshots/desktop-invite-designer.png) |

| Functions timeline | RSVP | Paying by UPI | Installed app |
|---|---|---|---|
| ![Functions](docs/screenshots/mobile-functions.png) | ![RSVP](docs/screenshots/mobile-rsvp.png) | ![UPI](docs/screenshots/mobile-pay.png) | ![Installed app](docs/screenshots/mobile-installed-app.png) |

<details>
<summary>More screens</summary>

| Wedding page | Blessing wall | Dashboard on a phone | Offline |
|---|---|---|---|
| ![Wedding page](docs/screenshots/mobile-wedding.png) | ![Blessing wall](docs/screenshots/mobile-blessing-wall.png) | ![Dashboard](docs/screenshots/mobile-dashboard.png) | ![Offline notice](docs/screenshots/mobile-offline.png) |

| Wedding page on desktop | Web invite on desktop | Guest list on desktop | Venue QR card |
|---|---|---|---|
| ![Desktop wedding page](docs/screenshots/desktop-wedding.png) | ![Desktop invite](docs/screenshots/desktop-invite.png) | ![Desktop guests](docs/screenshots/desktop-guests.png) | ![Venue card](docs/screenshots/venue-card.png) |

</details>

### Free AI, no key needed
Every AI feature goes through one chain and uses the first tier that answers. A tier that errors, times out, or returns something that fails validation hands over to the next, so the couple always gets text.

| Tier | What it is | When it is used |
|---|---|---|
| 1. Your own key | Gemini or Groq, added in Settings (stays in the browser) | Only if the couple added a key |
| 2. Chrome built-in AI | Gemini Nano through the Prompt API (`window.LanguageModel`), on-device and private | Desktop Chrome with the model already downloaded (Gathbandhan never starts a download); English and Hinglish only |
| 3. Pollinations.ai | Free, keyless text API | Unless turned off in Settings. The text is sent to that third-party service, which the app says next to every AI button. Its free tier allows about one reply every 45 seconds per IP and answers browsers on the published site, so Shagun respects a cooldown instead of waiting |
| 4. Offline templates | Deterministic writers and keyword rules in all four languages | Always; the last word |

AI writes: invite text (language, tone: traditional / modern / fun; the Ganesh shlok is always the canonical text, never AI-written), personal WhatsApp invite messages, **AI design picks** (template, colours, tone and language from the city, venue and the couple's wishes; unreadable colour pairs fall back to the template palette), the page story, the story timeline, dream suggestions with realistic targets, and thank-you notes. Optional **AI backgrounds** for invites come from Pollinations' image service: off by default, labelled "beta", and always layered over the drawn motifs so a failed image changes nothing.

## Demo mode and the online backend

Gathbandhan runs in two modes, chosen at start-up from `public/config.json`:

- **Demo mode** (empty keys): everything lives in the browser's localStorage, share links carry the wedding page itself (deflated into the URL), and the sample wedding is seeded. A thin strip says "Demo mode: data stays in this browser".
- **Online mode** (Supabase keys present): weddings, shagun, RSVPs and guests live in Supabase, links are short (`#/w/:slug`), couples sign in by **email magic link or 6-digit code**, a partner can be added as **co-owner**, photos go to Supabase Storage, and the blessing wall and dashboard update **in realtime**. supabase-js is loaded only in this mode (a lazy chunk).

On start the app reads `shagun_weddings` once. If the tables are missing (schema not run yet), the key is wrong, the project is paused or the network is down, it **falls back to demo mode** and the strip explains why, instead of breaking.

`public/config.json`:

```json
{
  "supabaseUrl": "https://<project>.supabase.co",
  "supabaseAnonKey": "<publishable or anon key>"
}
```

The anon/publishable key is meant to be public; **Row Level Security** protects the data. Setup for a non-technical owner, click by click: **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**.

### Database and security (`supabase/schema.sql`)
One idempotent script to paste into the Supabase SQL editor. Every table, function and the photo bucket is prefixed `shagun_` so the project can be shared with other apps. The prefix (like the `sg.*` browser storage keys) comes from the app's original name, Shagun, and is kept so existing data and the schema still match.

- **Guests (anon)**: read wedding pages; read totals and the blessing wall only through `shagun_public_activity()` (a security-definer function that never returns phone numbers, and returns amounts only if the couple shows them); **insert-only** on contributions (₹1 to ₹1,00,000, message up to 280 characters, the dream must exist; a trigger forces *guest confirmed*, no thank-you time and server time) and RSVPs (party of 1 to 20, only functions on the page).
- **A guest with a personal link**: `shagun_guest_invite()` reveals only their own name and greeting; `shagun_guest_mark()` can only tick opened / RSVP'd / gave. The guest list itself is never readable.
- **The couple** (email listed in `shagun_wedding_owners`): edit the wedding, read every contribution, RSVP and guest, update only `status` and `thanked_at` (column grants), add co-owners, and upload photos only into their wedding's folder. The last owner cannot be removed.
- The script was run twice against an in-memory Postgres (PGlite) with Supabase-style `auth`/`storage` stubs and 41 checks as anon, owner, co-owner and stranger.

## Install it as a phone app

Gathbandhan is a Progressive Web App: a service worker caches the app shell, fonts and the pages you opened, so it opens without network, shows a clear offline notice for actions that need the internet, and offers a refresh when a new version is deployed.

- **Android (Chrome)**: tap **Install app** on the home page or in Settings, or the ⋮ menu → **Install app** / **Add to Home screen**.
- **iPhone / iPad (Safari)**: tap **Share** ⬆️ → **Add to Home Screen** → **Add**.
- **Laptop (Chrome or Edge)**: click the install icon at the right end of the address bar.

Installed, it opens full-screen with a bottom tab bar and respects the notch and home indicator.

## Architecture

```mermaid
flowchart LR
    UI[Pages<br/>home · editor · wedding · give · rsvp · invite · guests · dashboard · settings] --> Store[WeddingStore<br/>signals, per page]
    Store --> Repo{{WeddingRepository<br/>abstract class = DI token}}
    Repo --> LS[LocalStorage repository<br/>demo mode]
    Repo --> SB[Supabase repository<br/>lazy chunk, RLS, realtime]
    SB --> PG[(Postgres + Storage<br/>shagun_* tables)]
    UI --> Invite[invite.ts · pdf.ts · export.ts<br/>templates, pages, PNG/PDF]
    UI --> AI[AiService]
    AI --> Chain[LlmChain]
    Chain --> BYO[Gemini / Groq]
    Chain --> Nano[Chrome built-in AI]
    Chain --> Poll[Pollinations.ai]
    Chain --> Offline[Offline writers]
    UI --> Pure[calendar.ts · guests.ts · stats.ts · totals.ts · csv.ts · upi.ts]
```

- **Persistence behind an interface.** Components and stores depend only on the abstract `WeddingRepository`. `main.ts` reads `config.json`, and only when keys are present dynamically imports the Supabase module, probes it, and provides its repository and auth service in place of the demo ones.
- **Public and owner reads are separate.** Guests get `getPublicActivity()` (totals and the wall); the dashboard gets `listContributions()`, `listRsvps()` and `listGuests()`. The localStorage repository applies the same masking as the SQL function, so both modes behave alike.
- **Invite pages are sized in container units**, so one component renders the 210 px style picker, the phone invite and the 1080 × 1920 export identically.
- **Signals all the way down**: zoneless change detection, `OnPush`, `input()` route params, `computed` totals and stats.
- **Lazy routes, small start**: about 97 kB transferred on first load (including the service worker client); supabase-js, html-to-image and each page load on demand.

## Getting started

```bash
npm install
npm start          # http://localhost:4200
npm run test:ci    # unit tests in headless Chrome
npm run build:pages
```

Everything works in demo mode out of the box. For online mode, follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Testing

162 unit tests (Jasmine + Karma, headless Chrome), including:

- the Supabase repository against a mocked client (public columns only, insert-only guest writes, the RPC wall, slug uniqueness, photo upload and clean-up, co-owners, realtime subscriptions, friendly RLS errors) and the start-up probe that falls back to demo mode
- the AI chain with mocked tiers (fall-through on errors, timeouts and invalid replies, language skipping, caller abort), the Chrome Prompt API and Pollinations providers (rate-limit cooldown), and validators for invite text, WhatsApp messages and design picks
- invite text in four languages, page layout, template contrast, localised dates, the PDF writer and JPEG parsing
- guest import (CSV with headers, pasted contacts), de-duplication, tokens and personal messages
- calendar files (IST to UTC, RFC 5545 escaping and line folding, Google Calendar links), RSVP headcount and CSV
- dashboard stats (running totals, side split, invite funnel, activity feed, checklist), the PWA service, the RSVP and give flows, share links, formatting, UPI links and totals

Browser checks with Puppeteer at 375 px and 1280 px in demo mode: guest page, functions and calendar download, give flow with side, RSVP, personal invite (greeting, page animation, shehnai toggle, RSVP ticks the guest off), guest list import and the send queue, invite designer in Hindi and Gujarati with PNG and PDF export, dashboard chart tooltip, CSV export, goal updates and the editor. A production build served under `/gathbandhan/` was checked for a valid manifest (no installability errors in Chrome), an active service worker, and offline loading of the home page, wedding page and invite. A config pointing at a database without tables was checked to fall back to demo mode with the notice.

CI (GitHub Actions) runs the tests and a production build with `--base-href /gathbandhan/` on every push, then deploys `main` to GitHub Pages.

## Limitations

- In demo mode, data lives in the browser where it was made; guests on other phones can still pay by UPI, but the couple's dashboard only sees what was recorded in their browser. Online mode removes this.
- "I've paid" is the guest's word; UPI intent links give no payment callback without a gateway, so the couple verifies each blessing.
- Some UPI apps limit intent links for person-to-person payments; the pay screen always shows the UPI ID too.
- Supabase's built-in email sender allows only a few sign-in emails per hour; enough for a couple, and a free SMTP service can be added later.
- Guest inserts are not rate limited beyond the database checks; a determined spammer could add fake blessings that the couple then removes.
- Pollinations' free tier answers only from the published site and about once every 45 seconds; between replies the offline templates take over. Chrome's on-device AI needs desktop Chrome with the model already downloaded.
- The sample wedding uses a fake UPI ID (`riya.arjun@demo`) so nobody can pay it by mistake.

## License

[MIT](LICENSE)
