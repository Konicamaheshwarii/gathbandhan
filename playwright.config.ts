import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * End-to-end tests against the production build, served under /gathbandhan/ like GitHub Pages.
 * `npm run e2e` builds it first (dist/e2e); set E2E_SKIP_BUILD=1 to reuse the last build.
 *
 * Every test blocks the real Supabase, Razorpay and other outside hosts (see e2e/fixtures.ts);
 * the backend paths run against an in-memory Supabase mock.
 */

// One free port per run. Workers load this file again, so the port is kept in the environment.
if (!process.env['E2E_PORT']) {
  const script = "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})";
  process.env['E2E_PORT'] = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
}
const port = Number(process.env['E2E_PORT']);
const baseURL = `http://127.0.0.1:${port}/gathbandhan/`;

const phone = {
  ...devices['Pixel 7'],
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
};
const desktop = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 860 },
};

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : [['list']],
  use: {
    baseURL,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    acceptDownloads: true,
    // The service worker would answer requests before the network mocks see them; the PWA
    // spec turns it back on for itself.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: phone },
    // Key flows also run on a laptop-sized screen.
    { name: 'desktop', use: desktop, grep: /@desktop/ },
  ],
  webServer: {
    command: `node e2e/serve.mjs ${port} dist/e2e/browser`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'ignore',
  },
});
