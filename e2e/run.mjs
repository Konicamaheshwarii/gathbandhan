// `npm run e2e [-- playwright args]`: builds the production bundle (dist/e2e, base href
// /gathbandhan/) and runs Playwright against it. E2E_SKIP_BUILD=1 reuses the last build.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args, env = process.env) => spawnSync(npx, args, { stdio: 'inherit', env, shell: process.platform === 'win32' }).status ?? 1;

if (!process.env.E2E_SKIP_BUILD || !existsSync('dist/e2e/browser/index.html')) {
  // CI=1 keeps the Angular CLI from using (and possibly tripping over) its disk cache.
  const status = run(['ng', 'build', '--base-href', '/gathbandhan/', '--output-path', 'dist/e2e'], { ...process.env, CI: process.env.CI || '1' });
  if (status) process.exit(status);
}
process.exit(run(['playwright', 'test', ...process.argv.slice(2)]));
