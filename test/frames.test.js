import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, run, settle } from './dom.js';

const NAME = 'http://frames.localhost:8791';
const PORT = 'http://127.0.0.1:8792';

/**
 * A page with two preview frames, one marked, and frames.js loaded, told its
 * frames are at `name` (none: not at a loopback name) and PORT, where the
 * name answers when `answers` (or never, when 'never'): `asked` is every
 * address the page tried, `src()` where each frame was pointed.
 */
function at({ name = NAME, answers = true, kept, storage = true, clock } = {}) {
  const window = page(`<meta name="frames"${name ? ` data-name="${name}"` : ''} data-port="${PORT}">
    <iframe data-preview sandbox="allow-scripts"></iframe><iframe id="other"></iframe>`, { url: 'http://127.0.0.1:8791/' });
  if (clock) Object.assign(window, { setTimeout: clock, clearTimeout: () => {} });
  const asked = [];
  window.fetch = (address, { method, signal }) => {
    asked.push(`${method} ${address}`);
    if (answers === 'never') return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('gave up'))));
    return answers ? Promise.resolve({}) : Promise.reject(new TypeError('Failed to fetch'));
  };
  if (kept) window.sessionStorage.setItem('reader:frames', kept);
  if (!storage) Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('no storage here'); } });
  run(window, 'static/frames.js');
  const src = () => [...window.document.querySelectorAll('iframe')].map((f) => f.getAttribute('src'));
  return { window, asked, src };
}

test('at a loopback name, the frames are frames.localhost when it answers, asked once a tab (gh-206)', async () => {
  const { window, asked, src } = at();
  await settle();
  assert.deepEqual(asked, [`HEAD ${NAME}/preview.html`]);
  assert.deepEqual(src(), [`${NAME}/preview.html`, null], 'only the marked frame');
  assert.equal(window.sessionStorage.getItem('reader:frames'), 'name');
  // One made later, as the overview's and export's are.
  const made = window.document.createElement('iframe');
  await window.Frames.load(made);
  assert.equal(made.getAttribute('src'), `${NAME}/preview.html`);
  assert.equal(asked.length, 1);
});

test('where the name doesn\'t answer (Safari), the frames are the second port', async () => {
  const { window, src } = at({ answers: false });
  await settle();
  assert.deepEqual(src(), [`${PORT}/preview.html`, null]);
  assert.equal(window.sessionStorage.getItem('reader:frames'), 'port');
});

test('a name that never answers is given up on', async () => {
  // The page's own clock, held: `late` is what it's to do, and when.
  const late = [];
  const { src } = at({ answers: 'never', clock: (fn, ms) => late.push({ fn, ms }) });
  await settle();
  assert.deepEqual(src(), [null, null]);
  assert.equal(late[0].ms, 1500);
  late[0].fn();
  await settle();
  assert.deepEqual(src(), [`${PORT}/preview.html`, null]);
});

test('what was found is kept for the tab, and at any other name nothing is asked', async () => {
  for (const [opts, want] of [[{ kept: 'port' }, PORT], [{ kept: 'name' }, NAME], [{ name: null }, PORT], [{ name: null, kept: 'name' }, PORT]]) {
    const { asked, src } = at(opts);
    await settle();
    assert.deepEqual(asked, [], JSON.stringify(opts));
    assert.equal(src()[0], `${want}/preview.html`, JSON.stringify(opts));
  }
  const { asked, src } = at({ storage: false });
  await settle();
  assert.equal(asked.length, 1);
  assert.equal(src()[0], `${NAME}/preview.html`);
});

test('a message to a frame goes to its own origin, or to any where it has none (opaque)', async () => {
  const { window } = at();
  await settle();
  const sent = [];
  const frame = (sandbox, src) => {
    const f = window.document.createElement('iframe');
    if (sandbox != null) f.setAttribute('sandbox', sandbox);
    if (src) f.setAttribute('src', src);
    Object.defineProperty(f, 'contentWindow', { value: { postMessage: (m, to) => sent.push(to) } });
    return f;
  };
  for (const f of [frame('allow-scripts', `${NAME}/preview.html`), frame('allow-scripts allow-same-origin', `${NAME}/preview.html`),
    frame(null, `${PORT}/preview.html`), frame('allow-same-origin')]) {
    window.Frames.post(f, { type: 'ping' });
  }
  assert.deepEqual(sent, ['*', NAME, PORT, '/']);
});
