import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, STATIC_DIR } from '../src/server.js';
import { appFiles, appFingerprint } from '../src/dev.js';
import { argsFor, counts, WATCHED } from '../scripts/dev.js';

// Working on reader, `npm run dev` (gh-208): what the server says of which
// start of it this is, and how scripts/dev.js starts it again. The page's
// side is in dev-app.test.js.

const scratch = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-dev-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

function staticDir(t) {
  const dir = scratch(t);
  fs.mkdirSync(path.join(dir, 'app', 'more'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<script src="/theme.js"></script><link rel="stylesheet" href="/style.css"><script src="/gone.js"></script><script type="module" src="/app/main.js"></script>');
  for (const [f, text] of [['theme.js', 't'], ['style.css', 's'], ['preview.js', 'p'], ['app/main.js', 'm'], ['app/more/x.js', 'x']]) {
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

async function listening(t, opts) {
  const { server } = createServer({ root: scratch(t), ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test('the app\'s own files are index.html, what it loads, and app/, but not what only the preview loads', (t) => {
  const dir = staticDir(t);
  assert.deepEqual(appFiles(dir), ['index.html', 'theme.js', 'style.css', path.join('app', 'main.js'), path.join('app', 'more', 'x.js')]);
  assert.ok(appFiles(STATIC_DIR).includes(path.join('app', 'main.js')), 'reader\'s own');
});

test('the app\'s fingerprint changes when one of its files does, and not when only the preview\'s does', (t) => {
  const dir = staticDir(t);
  const before = appFingerprint(dir);
  fs.writeFileSync(path.join(dir, 'preview.js'), 'p2');
  assert.equal(appFingerprint(dir), before, 'the preview\'s own');
  fs.writeFileSync(path.join(dir, 'app', 'more', 'x.js'), 'x2');
  const after = appFingerprint(dir);
  assert.notEqual(after, before, 'the app\'s');
  fs.writeFileSync(path.join(dir, 'style.css'), 's2');
  assert.notEqual(appFingerprint(dir), after, 'what index.html loads');
});

test('under npm run dev, the server says which start of it this is, and info says it\'s dev', async (t) => {
  const base = await listening(t, { dev: true, restarts: true });
  const info = await (await fetch(`${base}/api/info`)).json();
  assert.equal(info.dev, true);
  const res = await fetch(`${base}/api/dev`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const one = await res.json();
  assert.match(one.boot, /^[0-9a-f-]{36}$/);
  assert.equal(one.app, appFingerprint(STATIC_DIR));
  assert.deepEqual(await (await fetch(`${base}/api/dev`)).json(), one, 'the same until it\'s started again');
  const other = await (await fetch(`${await listening(t, { dev: true, restarts: true })}/api/dev`)).json();
  assert.notEqual(other.boot, one.boot, 'each start its own');
  assert.equal(other.app, one.app, 'with the same code');
});

test('with --dev alone, as the browser checks run it, nothing starts it again, so the page isn\'t told to watch', async (t) => {
  const base = await listening(t, { dev: true });
  assert.equal((await (await fetch(`${base}/api/info`)).json()).dev, undefined);
  assert.notEqual((await fetch(`${base}/api/dev`)).status, 200);
});

test('without --dev, the server has no dev mode', async (t) => {
  const base = await listening(t, {});
  assert.equal((await (await fetch(`${base}/api/info`)).json()).dev, undefined);
  assert.notEqual((await fetch(`${base}/api/dev`)).status, 200);
});

test('reader runs in dev mode, and started again it opens no new browser tab, the first start being as asked', () => {
  assert.deepEqual(argsFor(['notes'], true), ['notes', '--dev']);
  assert.deepEqual(argsFor(['notes', '--port', '8734'], false), ['notes', '--port', '8734', '--dev', '--no-browser']);
  assert.deepEqual(argsFor(['notes', '--dev', '--no-browser'], false), ['notes', '--dev', '--no-browser']);
});

test('only reader\'s code starts it again, not an editor\'s leavings or a hidden folder', () => {
  assert.deepEqual(WATCHED, ['src', 'features', 'static', 'bin']);
  for (const f of ['server.js', 'music/preview.js', 'app/main.js', 'style.css', null]) assert.ok(counts(f), String(f));
  for (const f of ['.server.js.swp', 'app/main.js~', '#main.js#', '.reader/x.md', 'x/node_modules/y.js', 'a.tmp']) assert.ok(!counts(f), f);
});
