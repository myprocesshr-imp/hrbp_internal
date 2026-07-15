/**
 * dev-start.mjs
 * Wrapper that starts `wrangler pages dev` and then auto-runs init-all-dbs.mjs
 * so that ALL local D1 databases get the full schema + seed data.
 *
 * This solves the issue where `wrangler pages dev --d1 DB=hrbp-db` creates a
 * separate SQLite file from what `wrangler d1 execute hrbp-db --local` uses.
 *
 * Usage:  node scripts/dev-start.mjs
 */
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import http from 'http';

const WRANGLER_ARGS = [
  'pages', 'dev', '../app/dist',
  '--d1', 'DB=hrbp-db',
  '--r2', 'HRBP_BUCKET',
  '--persist-to=./.wrangler/state',
  '--port', '8788',
];

const WRANGLER_PORT = 8788;
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

function log(msg) {
  console.log(`\x1b[36m[dev-start]\x1b[0m ${msg}`);
}

function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/templates`, (res) => {
        // Any response (even 500) means server is up
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Wrangler dev server did not start in time'));
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      });
      req.setTimeout(2000, () => { req.destroy(); poll(); });
    };
    poll();
  });
}

// 1. Start wrangler pages dev
log('Starting wrangler pages dev...');
const wrangler = spawn('npx', ['wrangler', ...WRANGLER_ARGS], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

wrangler.stdout.on('data', (data) => process.stdout.write(data));
wrangler.stderr.on('data', (data) => process.stderr.write(data));

wrangler.on('error', (err) => {
  console.error('Failed to start wrangler:', err.message);
  process.exit(1);
});

wrangler.on('exit', (code) => {
  log(`Wrangler exited with code ${code}`);
  process.exit(code ?? 0);
});

// 2. Wait for wrangler to be ready
try {
  log('Waiting for wrangler to be ready...');
  await waitForServer(WRANGLER_PORT, READY_TIMEOUT_MS);
  log('Wrangler is ready!');
} catch (err) {
  console.error(err.message);
  wrangler.kill();
  process.exit(1);
}

// 3. Trigger D1 file creation via HTTP request
log('Triggering D1 database file creation...');
try {
  const triggerReq = http.get(`http://127.0.0.1:${WRANGLER_PORT}/api/templates`, (res) => {
    res.resume();
  });
  triggerReq.on('error', () => {});
  triggerReq.setTimeout(5000, () => { triggerReq.destroy(); });
} catch { /* ignore */ }

// Give wrangler a moment to flush the D1 file
await new Promise((r) => setTimeout(r, 2000));

// 4. Run init-all-dbs.mjs
log('Running database migrations...');
try {
  execSync('node scripts/init-all-dbs.mjs', {
    stdio: 'inherit',
    cwd: new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
  });
  log('All databases migrated successfully!');
} catch (err) {
  console.error('Migration failed:', err.message);
}

log('Development server is running. Press Ctrl+C to stop.');
