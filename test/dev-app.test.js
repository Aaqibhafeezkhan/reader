import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// Working on reader, `npm run dev` (gh-208): the page notices the server was
// started again, and shows the change, the preview alone or the whole page.
// (dev.test.js has the server's side.)

mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
const server = { boot: 'one', app: 'a' };
const asked = [];
let saveFails = false;
globalThis.fetch = async (url, init = {}) => {
  const ask = String(url);
  asked.push(`${init.method ?? 'GET'} ${ask.replace(/\?.*/, '')}`);
  if (ask.startsWith('/api/dev') && server.down) throw new TypeError('fetch failed');
  if (ask.startsWith('/api/file') && init.method === 'PUT' && saveFails) {
    return { ok: false, status: 503, json: async () => ({ error: 'not now' }) };
  }
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes', version: { label: 'v0.0.5', url: '', release: true }, dev: true }
    : ask.startsWith('/api/dev') ? { boot: server.boot, app: server.app }
    : ask.startsWith('/api/tree') ? { files: [{ path: 'a.md', type: 'md', mtime: 1 }] }
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"><p>A</p></div>', title: 'A', deck: false }
    : init.method === 'PUT' ? { mtime: 2 }
    : { text: '# A\n\nSome words.\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const loads = [];
window.Frames.load = (frame) => { loads.push(frame.id); return Promise.resolve(); };
let reloads = 0;
Object.defineProperty(window.location, 'reload', { value: () => { reloads += 1; }, configurable: true });

const { el } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};
await settled();

/** A second goes by, and the page asks again; the frame says it's ready if it was loaded again. */
async function aSecond() {
  mock.timers.tick(1000);
  await settled();
  if (loads.length) {
    el.preview.dispatchEvent(new window.Event('load'));
    await settled();
    window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'ready' }, source: el.preview.contentWindow }));
  }
  await settled();
}

const since = (n) => asked.slice(n);

test('asked once a second, the same start of the server changes nothing', async () => {
  assert.ok(asked.includes('GET /api/dev'), 'it asks under npm run dev');
  const n = asked.length;
  await aSecond();
  assert.deepEqual(since(n), ['GET /api/dev']);
  assert.deepEqual(loads, []);
  assert.equal(reloads, 0);
});

test('while the server is down, nothing happens, and once it\'s back with the same app, only the preview is loaded again and drawn', async () => {
  server.down = true;
  await aSecond();
  assert.deepEqual(loads, []);
  server.down = false;
  server.boot = 'two';
  const n = asked.length;
  await aSecond();
  assert.deepEqual(loads, ['preview'], 'the preview frame, again');
  assert.ok(since(n).includes('POST /api/render'), 'and drawn');
  assert.equal(reloads, 0, 'not the whole page');
  loads.length = 0;
});

test('with edits that can\'t be saved, it waits and says why, and shows the change once they are', async () => {
  el.editor.value = '# A\n\nSome words, and more.\n';
  el.editor.dispatchEvent(new window.Event('input'));
  saveFails = true;
  server.boot = 'three';
  server.app = 'b';
  await aSecond();
  assert.equal(reloads, 0, 'not while they\'d be lost');
  assert.match(window.document.body.textContent, /once your edits are saved/);
  saveFails = false;
  const n = asked.length;
  await aSecond();
  assert.ok(since(n).includes('PUT /api/file'), 'saved first');
  assert.equal(reloads, 1, 'then the whole page, as the app changed');
  const kept = JSON.parse(sessionStorage.getItem('reader:dev-place'));
  assert.equal(kept.path, 'a.md', 'with where it was read to kept, for after');
});
