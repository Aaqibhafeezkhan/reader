import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals, assertElement } from './dom.js';

// Make a copy and Copy for today, in the top bar (gh-236): a file of its own,
// or today's from a file dated another day, its answers cleared for today or
// from Work. Gray, not gone, where they don't apply.

mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
const { document } = window;
const FILES = [
  { path: 'journal/2026-10-30.md', date: '2026-10-30' },
  { path: 'journal/2026-11-03.md', date: '2026-11-03' },
  { path: 'notes.md', date: null },
  { path: 'doc.pdf', date: null, type: 'pdf' },
];
let files = FILES;
let asked = [];
let refuse = null;
let made = 'notes-copy.md';
globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
  const ask = String(url);
  if (ask.startsWith('/api/copy')) asked.push({ method, ask, body: body && JSON.parse(body) });
  if (ask.startsWith('/api/copy') && method === 'POST' && refuse) {
    return { ok: false, status: 409, statusText: 'Conflict', json: async () => ({ error: refuse }) };
  }
  if (ask.startsWith('/api/copy') && method === 'POST') files = [...files, { path: made, date: null }];
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { today: '2026-11-03', starts: [], files: files.map((f) => ({ type: 'md', mtime: 1, ...f })) }
    : ask.startsWith('/api/copy') ? (method === 'POST'
      ? { path: made, from: 'x', mtime: 2 }
      : { from: new URL(ask, 'http://x').searchParams.get('path'), to: made, mtime: 7, css: 'c', body: 'drawn' })
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"></div>', title: 'A', deck: false }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el, state } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const { loadTree, open, closeFile } = await import('../static/app/files.js');
const { setWorking } = await import('../static/app/modes.js');
const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};
await settled();

const hidden = () => [...document.querySelectorAll('iframe.measure')].find((f) => f !== el.measure);
const b = () => el.copyFile;
const t = () => el.copyToday;
const gray = (x) => x.getAttribute('aria-disabled') === 'true';
const posts = () => asked.filter((a) => a.method === 'POST');

function framed() {
  const frame = hidden();
  const sent = [];
  Object.defineProperty(frame, 'contentWindow', { value: { postMessage: (m) => sent.push(m) }, configurable: true });
  const say = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, source: frame.contentWindow }));
  return { frame, sent, say };
}

async function fresh(p, { to = 'notes-copy.md' } = {}) {
  files = FILES;
  asked = [];
  refuse = null;
  made = to;
  setWorking(false);
  await loadTree();
  if (p) await open(p);
  else closeFile();
  await settled();
}

test('two icons beside the path\'s button, always there, gray where there\'s nothing to copy', async () => {
  await fresh(null);
  for (const x of [b(), t()]) {
    assert.equal(x.hidden, false);
    assert.ok(gray(x));
    assert.equal(x.disabled, false, 'or it couldn\'t say why');
    assert.ok(x.querySelector('svg'));
    assert.equal(x.textContent, '');
  }
  assert.equal(b().getAttribute('aria-label'), 'Make a copy');
  assert.equal(t().getAttribute('aria-label'), 'Copy for today');
  assert.equal(b().title, 'Make a copy, once a file is open.');
  assert.equal(b().previousElementSibling, el.copyPath);
  assert.equal(t().previousElementSibling, b());
  assert.notEqual(b().innerHTML, t().innerHTML);
  b().click();
  t().click();
  await settled();
  assert.deepEqual(asked, []);
  await fresh('notes.md');
  assert.ok(!gray(b()));
  assert.match(b().title, /^Make a copy, a file of its own/);
  await open('doc.pdf');
  await settled();
  assert.ok(gray(b()));
  assert.ok(gray(t()));
  assert.match(b().title, /not a PDF/);
});

test('Copy for today is there for a file dated another day; undated, or today\'s, it\'s gray and says why', async () => {
  await fresh('journal/2026-10-30.md');
  assert.ok(!gray(t()));
  assert.ok(!gray(b()));
  assert.match(t().title, /2026-11-03/);
  await fresh('notes.md');
  assert.ok(gray(t()));
  assert.equal(t().title, 'Copy for today, once the file has a date.');
  t().click();
  await settled();
  assert.deepEqual(asked, []);
  await fresh('journal/2026-11-03.md');
  assert.ok(gray(t()));
  assert.match(t().title, /this one is today's/);
  assert.ok(!gray(b()));
});

test('Make a copy, from a file dated another day, is a plain copy', async () => {
  await fresh('journal/2026-10-30.md', { to: 'journal/2026-10-30-copy.md' });
  b().focus();
  b().click();
  await settled();
  assertElement(document.activeElement, b(), 'the keyboard stays on the button');
  assert.deepEqual(asked.map((a) => a.ask), ['/api/copy?path=journal%2F2026-10-30.md', '/api/copy']);
  assert.equal(posts()[0].body.today, false);
  assert.equal(state.current.path, 'journal/2026-10-30-copy.md');
});

test('from Edit, a copy keeps its text: nothing is drawn to clear, and the copy opens', async () => {
  await fresh('notes.md');
  b().click();
  await settled();
  assert.equal(hidden(), undefined);
  assert.deepEqual(asked.map((a) => a.ask), ['/api/copy?path=notes.md', '/api/copy']);
  assert.deepEqual(posts()[0].body, { path: 'notes.md', mtime: 7, edits: [], today: false });
  assert.equal(state.current.path, 'notes-copy.md');
  assert.match(el.toast.textContent, /Copied notes.md to notes-copy.md/);
});

test('from Work, a copy starts with its answers cleared, and opens in Work', async () => {
  await fresh('notes.md');
  setWorking(true);
  b().click();
  await settled();
  assert.deepEqual(posts(), [], 'nothing written before the frame answers');
  assert.match(asked[0].ask, /clear=1/);
  assert.doesNotMatch(asked[0].ask, /today/);
  const { sent, say } = framed();
  say({ type: 'ready' });
  await settled();
  assert.deepEqual(sent.filter((m) => m.type !== 'ping').map((m) => m.type), ['render', 'start-over']);
  const edits = [{ from: 1, to: 2, before: ['a'], after: [''] }];
  say({ type: 'started-over', edits, failed: null });
  await settled();
  assert.deepEqual(posts()[0].body, { path: 'notes.md', mtime: 7, edits, today: false });
  assert.equal(state.current.path, 'notes-copy.md');
  assert.equal(state.working, true);
  setWorking(false);
});

test('Copy for today clears its answers, even from Edit, and asks for today\'s', async () => {
  await fresh('journal/2026-10-30.md', { to: 'journal/2026-11-03-copy.md' });
  t().click();
  await settled();
  assert.match(asked[0].ask, /today=1/);
  assert.match(asked[0].ask, /clear=1/);
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  say({ type: 'started-over', edits: [], failed: null });
  await settled();
  assert.equal(posts()[0].body.today, true);
  assert.equal(state.current.path, 'journal/2026-11-03-copy.md');
  assert.equal(state.dir, 'journal');
});

test('a frame that fails, or a server that refuses, makes nothing and says so', async () => {
  await fresh('journal/2026-10-30.md');
  t().click();
  await settled();
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  say({ type: 'started-over', edits: [], failed: 'no such luck' });
  await settled();
  assert.deepEqual(posts(), []);
  assert.match(el.toast.textContent, /copy wasn't made.*no such luck/);
  assert.equal(state.current.path, 'journal/2026-10-30.md');
  await fresh('notes.md');
  refuse = 'notes-copy.md already exists';
  b().click();
  await settled();
  assert.match(el.toast.textContent, /already exists/);
  assert.equal(state.current.path, 'notes.md');
  assert.equal(b().disabled, false, 'and it can be tried again');
});

test('pressed twice, it copies once', async () => {
  await fresh('journal/2026-10-30.md');
  t().focus();
  t().click();
  t().click();
  await settled();
  assert.equal(asked.length, 1);
  assert.equal(t().disabled, false, 'not disabled, which would take the keyboard from it');
  assertElement(document.activeElement, t());
  mock.timers.tick(15000);
  await settled();
  assertElement(document.activeElement, t(), 'nor once it\'s done');
});
