import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('a slide is drawn by the one message, with what\'s only this frame\'s added to it, or taken away (gh-166)', async () => {
  const { window } = at();
  await settle();
  window.Theme = { dark: () => true };
  const deck = { css: 'c', base: '/b/', scale: 1.25, slides: [] };
  const whole = { type: 'render', css: 'c', body: 'x', base: '/b/', resetScroll: true, deck: true, reveal: 2, dark: true, scale: 1.25 };
  // Spread, as it's an object of the page's own, with its own Object.prototype.
  assert.deepEqual({ ...window.Frames.slide(deck, 'x', 2) }, whole);
  assert.deepEqual({ ...window.Frames.slide(deck, 'x', 2, { title: 'T', dim: true }) }, { ...whole, title: 'T', dim: true });
  assert.equal(window.Frames.slide(deck, 'x', 2, { dark: undefined }).dark, undefined);
});

test('a slide\'s frame is scaled from its own size to the width of what it\'s in (gh-166)', async () => {
  const { window } = at();
  await settle();
  const box = window.document.createElement('div');
  const frame = window.document.createElement('iframe');
  box.append(frame);
  Object.defineProperty(box, 'clientWidth', { value: 320 });
  Object.defineProperty(frame, 'offsetWidth', { value: 1280 });
  window.Frames.fit(frame);
  assert.equal(frame.style.transform, 'scale(0.25)');
});

test('the app\'s preview and stage have the frames\' origin, for a video, and are sent messages there; the rest stay opaque (gh-31)', async () => {
  const html = fs.readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
  const frames = html.match(/<iframe[^>]*data-preview[^>]*><\/iframe>/g).join('');
  const window = page(`<meta name="frames" data-name="${NAME}" data-port="${PORT}">${frames}`, { url: 'http://127.0.0.1:8791/' });
  window.fetch = () => Promise.resolve({});
  run(window, 'static/frames.js');
  await settle();
  const sent = {};
  for (const f of window.document.querySelectorAll('iframe')) {
    Object.defineProperty(f, 'contentWindow', { value: { postMessage: (m, to) => { sent[f.id] = to; } } });
    window.Frames.post(f, { type: 'ping' });
  }
  assert.deepEqual(sent, { preview: NAME, stage: NAME, measure: '*' });
  for (const id of ['preview', 'stage']) {
    assert.match(window.document.getElementById(id).getAttribute('allow'), /^autoplay \*; encrypted-media \*; picture-in-picture \*$/, id);
  }
});
