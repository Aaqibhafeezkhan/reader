import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// Start today's, in the files list: offered by what the server says, worked
// out in a hidden frame, and written only once that's answered.

mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
const { document } = window;
const JOURNAL = [{ dir: 'journal', on: '2026-11-01', last: false }];
let starts = JOURNAL;
let files = [{ path: 'journal/2026-10-30.md', date: '2026-10-30' }, { path: 'notes.md', date: null }];
let asked = [];
let refuse = null;
globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
  const ask = String(url);
  if (ask.startsWith('/api/start-day')) asked.push({ method, ask, body: body && JSON.parse(body) });
  if (ask.startsWith('/api/start-day') && method === 'POST' && refuse) {
    return { ok: false, status: 409, statusText: 'Conflict', json: async () => ({ error: refuse }) };
  }
  if (ask.startsWith('/api/start-day') && method === 'POST') {
    files = [...files, { path: 'journal/2026-11-03.md', date: '2026-11-03' }];
    starts = [];
  }
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { today: '2026-11-03', starts, files: files.map((f) => ({ type: 'md', mtime: 1, ...f })) }
    : ask.startsWith('/api/start-day') ? (method === 'POST'
      ? { path: 'journal/2026-11-03.md', from: 'journal/2026-10-30.md', mtime: 2 }
      : { from: 'journal/2026-10-30.md', to: 'journal/2026-11-03.md', mtime: 1, css: 'c', body: 'drawn' })
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"></div>', title: 'A', deck: false }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el, state } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const { go, loadTree } = await import('../static/app/files.js');
const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};
await settled();

const hidden = () => [...document.querySelectorAll('iframe.measure')].find((f) => f !== el.measure);
const offer = () => el.files.querySelector('.start-today, .start-here');
const posts = () => asked.filter((a) => a.method === 'POST');

/** The hidden frame, once it's there: what it's sent, and how it answers. */
function framed() {
  const frame = hidden();
  const sent = [];
  Object.defineProperty(frame, 'contentWindow', { value: { postMessage: (m) => sent.push(m) }, configurable: true });
  const say = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, source: frame.contentWindow }));
  return { frame, sent, say };
}

async function fresh(dir = '') {
  starts = JOURNAL;
  files = [{ path: 'journal/2026-10-30.md', date: '2026-10-30' }, { path: 'notes.md', date: null }];
  asked = [];
  refuse = null;
  el.filter.value = '';
  state.current = null;
  state.outline = false;
  await loadTree();
  go(dir, null, { focus: false });
}

test('a folder that can start today has an icon on its row, and the words at the top of the folder; others don\'t', async () => {
  await fresh();
  const row = el.files.querySelector('.folder[data-dir="journal"]').closest('li');
  const icon = row.querySelector('.start-today');
  assert.equal(icon.getAttribute('aria-label'), "Start today's");
  assert.equal(icon.title, "Start today's");
  assert.ok(icon.querySelector('svg'));
  assert.equal(icon.textContent, '');
  assert.equal(icon.closest('.actions'), null, 'not only on hover');
  assert.equal(el.files.querySelectorAll('.start-today').length, 1);
  go('journal', null, { focus: false });
  assert.equal(el.files.firstElementChild.querySelector('.start-here').textContent, "Start today's");
  assert.equal(el.files.querySelector('.start-today'), null);
  starts = [];
  await loadTree();
  assert.equal(offer(), null);
});

test('only on its last day does it carry a warning, by a shape, a tooltip and a description', async () => {
  await fresh();
  const WHY = "Start today's from 2026-11-01. A folder offers this for three days after its latest file, so tomorrow it won't.";
  assert.equal(el.files.querySelector('.start-warn'), null);
  assert.equal(offer().hasAttribute('aria-description'), false);
  starts = [{ dir: 'journal', on: '2026-11-01', last: true }];
  await loadTree();
  for (const dir of ['', 'journal']) {
    go(dir, null, { focus: false });
    const b = offer();
    assert.equal(b.title, WHY, dir);
    assert.equal(b.getAttribute('aria-description'), WHY, dir);
    const mark = b.querySelector('.start-warn');
    assert.equal(mark.getAttribute('aria-hidden'), 'true');
    assert.ok(mark.querySelector('.start-warn-sign'));
  }
  assert.equal(offer().textContent, "Start today's");
  go('', null, { focus: false });
  assert.equal(offer().getAttribute('aria-label'), "Start today's", 'its name stays');
});

test('the arrows reach the words at the top of the folder, and pressing them starts it', async () => {
  await fresh('journal');
  const here = el.files.querySelector('.start-here');
  const row = el.files.querySelector('.file');
  row.focus();
  row.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.equal(document.activeElement, here);
  here.click();
  await settled();
  assert.ok(hidden());
  mock.timers.tick(15000);
  await settled();
});

test('the frame\'s edits go to the server, which is told what they\'re of, and the new file opens and is in Today', async () => {
  await fresh();
  offer().click();
  await settled();
  assert.deepEqual(posts(), [], 'nothing written before the frame answers');
  const { frame, sent, say } = framed();
  say({ type: 'ready' });
  await settled();
  assert.deepEqual(sent.filter((m) => m.type !== 'ping').map((m) => m.type), ['render', 'start-over']);
  assert.equal(sent.find((m) => m.type === 'render').body, 'drawn');
  const edits = [{ from: 1, to: 2, before: ['a'], after: [''] }];
  say({ type: 'started-over', edits, failed: null });
  await settled();
  assert.deepEqual(posts()[0].body, { dir: 'journal', from: 'journal/2026-10-30.md', mtime: 1, edits });
  assert.equal(frame.isConnected, false);
  assert.equal(state.current.path, 'journal/2026-11-03.md');
  assert.equal(state.dir, 'journal');
  el.todayBtn.click();
  assert.ok(el.files.querySelector('.file[data-path="journal/2026-11-03.md"]'));
  el.todayBtn.click();
  assert.equal(offer(), null);
});

test('a frame that fails writes nothing, and says so', async () => {
  await fresh();
  offer().click();
  await settled();
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  say({ type: 'started-over', edits: [], failed: 'no such luck' });
  await settled();
  assert.deepEqual(posts(), []);
  assert.match(el.toast.textContent, /wasn't started.*no such luck/);
  assert.ok(el.toast.classList.contains('err'));
  assert.equal(hidden(), undefined);
});

test('a frame that never answers writes nothing, and says so', async () => {
  await fresh();
  offer().click();
  await settled();
  assert.ok(hidden());
  mock.timers.tick(15000);
  await settled();
  assert.deepEqual(posts(), []);
  assert.match(el.toast.textContent, /wasn't started.*too long/);
  assert.equal(hidden(), undefined);
  assert.ok(offer(), 'and it can be tried again');
});

test('refused by the server, the list is looked at again', async () => {
  await fresh();
  refuse = 'journal/2026-11-03.md already exists';
  offer().click();
  await settled();
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  starts = [];
  say({ type: 'started-over', edits: [], failed: null });
  await settled();
  assert.match(el.toast.textContent, /already exists/);
  assert.equal(offer(), null);
});

test('pressed twice, it starts once', async () => {
  await fresh();
  const b = offer();
  b.click();
  b.click();
  await settled();
  assert.equal(asked.length, 1);
  assert.equal(b.disabled, true);
  mock.timers.tick(15000);
  await settled();
});
