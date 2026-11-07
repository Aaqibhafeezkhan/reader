import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// Make a copy, in the top bar (gh-236): a file of its own, today's if the open
// one is dated another day, its answers cleared for today or from Work.

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

test('it\'s beside the path\'s button, for an open document only', async () => {
  await fresh(null);
  assert.equal(b().hidden, true);
  await fresh('notes.md');
  assert.equal(b().hidden, false);
  assert.equal(b().previousElementSibling, el.copyPath);
  assert.equal(b().textContent, 'Make a copy');
  await open('doc.pdf');
  await settled();
  assert.equal(b().hidden, true);
});

test('on a file dated another day it says Copy for today; dated today, Make a copy', async () => {
  await fresh('journal/2026-10-30.md');
  assert.equal(b().textContent, 'Copy for today');
  assert.match(b().title, /2026-11-03/);
  await fresh('journal/2026-11-03.md');
  assert.equal(b().textContent, 'Make a copy');
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
  b().click();
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
  b().click();
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
  b().click();
  b().click();
  await settled();
  assert.equal(asked.length, 1);
  assert.equal(b().disabled, true);
  mock.timers.tick(15000);
  await settled();
  assert.equal(b().disabled, false);
});
