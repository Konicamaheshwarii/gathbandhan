import { BrowserContext, Page, expect, test as base } from '@playwright/test';

/**
 * Shared fixtures for every spec.
 *
 * Network guard (on for every test, in every page and popup of the context):
 * - the app's own server (127.0.0.1) is allowed;
 * - `*.supabase.co`, `checkout.razorpay.com`, `api.razorpay.com` (and any razorpay.com host) are
 *   BLOCKED. A request there that no mock answered is an "escape" and fails the test;
 * - every other outside host (Google Fonts, Pollinations AI, WhatsApp, maps…) is blocked too:
 *   page loads get a small stub page, everything else is aborted. Nothing leaves the machine.
 *
 * Also: `config.json` is demo mode (empty) unless a test installs the Supabase mock, `confirm()`
 * dialogs are accepted, and `window.open`, `target=_blank` links and clipboard writes are recorded
 * in the page so tests can assert what would have been opened or copied.
 */

const GUARDED = /(^|\.)supabase\.co$|(^|\.)supabase\.in$|(^|\.)razorpay\.com$/i;
const LOCAL = new Set(['127.0.0.1', 'localhost']);

export interface NetworkLog {
  /** Requests to Supabase or Razorpay that no mock answered. Must stay empty. */
  escapes: string[];
  /** Other outside requests that were blocked (fonts, AI, wa.me…), for information. */
  blocked: string[];
}

export async function guardNetwork(context: BrowserContext, log: NetworkLog, opts: { fonts?: boolean } = {}): Promise<void> {
  await context.route('**/*', async (route) => {
    const req = route.request();
    let url: URL;
    try {
      url = new URL(req.url());
    } catch {
      return route.continue();
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (LOCAL.has(url.hostname)) return route.continue();
    if (GUARDED.test(url.hostname)) {
      log.escapes.push(`${req.method()} ${req.url()}`);
      return route.abort('blockedbyclient');
    }
    if (opts.fonts && /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return route.continue();
    log.blocked.push(req.url());
    if (req.resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Blocked in tests</title><p>e2e stub for ${url.hostname}</p>` });
    }
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(/.*/, (ws) => {
    const url = new URL(ws.url());
    if (GUARDED.test(url.hostname)) log.escapes.push(`WS ${ws.url()}`);
    else log.blocked.push(ws.url());
    void ws.close({ code: 1008, reason: 'blocked in e2e' });
  });
}

/** Demo mode: an empty config.json (the e2e server also serves it empty; this is belt and braces). */
export async function demoConfig(context: BrowserContext): Promise<void> {
  await context.route(/\/gathbandhan\/config\.json(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

/** Records window.open, target=_blank clicks and clipboard writes; stubs the share sheet. */
const RECORDER = () => {
  const w = window as unknown as { __opened: string[]; __clipboard: string[]; __shared: ShareData[] };
  w.__opened = [];
  w.__clipboard = [];
  w.__shared = [];
  // The OS share sheet cannot be driven in a test: record what would be shared.
  try {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => void w.__shared.push(data) });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  } catch {
    // keep the real share sheet
  }
  window.open = ((url?: string | URL) => {
    w.__opened.push(String(url ?? ''));
    return null;
  }) as typeof window.open;
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[target=_blank]') as HTMLAnchorElement | null;
      if (a?.href) w.__opened.push(a.href);
    },
    true,
  );
  try {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => void w.__clipboard.push(t), readText: async () => w.__clipboard.at(-1) ?? '' },
    });
  } catch {
    // keep the real clipboard
  }
};

type Fixtures = {
  net: NetworkLog;
  /** Opens an app route (hash routing): `go('/w/riya-weds-arjun')`. */
  go: (path: string) => Promise<void>;
  /** Whether a test wants Google Fonts (screenshots); off by default. */
  allowFonts: boolean;
  /** Set by the Supabase mock so demoConfig is not installed. */
  backendMode: boolean;
};

export const test = base.extend<Fixtures>({
  allowFonts: [false, { option: true }],
  backendMode: [false, { option: true }],
  net: async ({ context, allowFonts, backendMode }, use) => {
    const log: NetworkLog = { escapes: [], blocked: [] };
    await guardNetwork(context, log, { fonts: allowFonts });
    if (!backendMode) await demoConfig(context);
    await context.addInitScript(RECORDER);
    context.on('page', (p) => {
      p.on('dialog', (d) => void d.accept());
    });
    await use(log);
    expect(log.escapes, 'requests to Supabase or Razorpay escaped the mocks').toEqual([]);
  },
  page: async ({ page, net }, use) => {
    void net;
    page.on('dialog', (d) => void d.accept().catch(() => undefined));
    await use(page);
  },
  go: async ({ page }, use) => {
    await use(async (path: string) => {
      await page.goto(`./#${path.startsWith('/') ? path : `/${path}`}`);
    });
  },
});

export { expect };

/** URLs the page tried to open in a new tab (WhatsApp, maps, mail…). */
export async function openedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __opened: string[] }).__opened ?? []);
}

/** What the page passed to the share sheet. */
export async function sharedData(page: Page): Promise<ShareData[]> {
  return page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared ?? []);
}

/** The last text copied with the app's Copy buttons. */
export async function lastCopied(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __clipboard: string[] }).__clipboard.at(-1) ?? '');
}

/** Waits for a toast with this text. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator('app-toasts').getByText(text).first()).toBeVisible();
}

/** Saves a download into the test's own output folder (never the user's Downloads). */
export async function saveDownload(page: Page, action: () => Promise<unknown>, testInfo: { outputPath: (...p: string[]) => string }) {
  const [download] = await Promise.all([page.waitForEvent('download'), action()]);
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  return { download, file, name: download.suggestedFilename() };
}

export const SAMPLE = {
  riya: { slug: 'riya-weds-arjun', id: 'w-demo' },
  hetal: { slug: 'hetal-weds-parth', id: 'w-demo-ahd' },
  meenakshi: { slug: 'meenakshi-weds-rohan', id: 'w-demo-blr' },
} as const;
