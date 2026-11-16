// Static server for the end-to-end tests: serves the production build under /gathbandhan/,
// exactly like GitHub Pages does.
//
// - config.json is always served EMPTY (demo mode), so a test can never reach the live Supabase
//   project by accident. Tests that need the backend route config.json to a mock host instead.
// - GET /__e2e/bump changes ngsw.json (a new "deploy"), so the PWA test can see the update toast.
//
// Usage: node e2e/serve.mjs <port> [dist folder]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] || process.env.E2E_PORT || 4310);
const root = resolve(process.argv[3] || 'dist/e2e/browser');
const BASE = '/gathbandhan/';
let deploy = 0;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);

  if (path === '/__e2e/bump') {
    deploy++;
    return send(res, 200, String(deploy));
  }
  if (path === '/' || path === '/gathbandhan') {
    res.writeHead(302, { location: BASE });
    return res.end();
  }
  if (!path.startsWith(BASE)) return send(res, 404, 'Not found');

  const rel = path.slice(BASE.length) || 'index.html';
  if (rel === 'config.json') return send(res, 200, '{}', TYPES['.json']);

  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) return send(res, 403, 'Forbidden');
  try {
    if (!(await stat(file)).isFile()) return send(res, 404, 'Not found');
    let body = await readFile(file);
    if (rel === 'ngsw.json' && deploy > 0) {
      // A changed manifest is a new version to the service worker.
      const manifest = JSON.parse(body.toString('utf8'));
      manifest.appData = { ...(manifest.appData ?? {}), e2eDeploy: deploy };
      body = Buffer.from(JSON.stringify(manifest));
    }
    send(res, 200, body, TYPES[extname(file)] ?? 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`e2e server on http://127.0.0.1:${port}${BASE} serving ${root}`));
