import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// Start today's, in the files list: offered by what the server says, worked
// out in a hidden frame, and written only once that's answered.

mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
const { document } = window;
const JOURNAL = [{ dir: 'journal', from: 'journal/2026-10-30.md', date: '2026-11-01', to: 'journal/2026-11-03.md' }];
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
    starts = [{ dir: 'journal', open: 'journal/2026-11-03.md' }];
  }
  if (ask.startsWith('/api/new')) files = [...files, { path: JSON.parse(body).name, date: null }];
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/new') ? { path: JSON.parse(body).name, created: true }
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
const { go, loadTree, drawTree } = await import('../static/app/files.js');
const { setWorking } = await import('../static/app/modes.js');
const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};
await settled();

const hidden = () => [...document.querySelectorAll('iframe.measure')].find((f) => f !== el.measure);
const offer = () => el.startBtn;
const posts = () => asked.filter((a) => a.method === 'POST');
const listOpen = () => el.split.classList.contains('list-open');

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

const gray = () => el.startBtn.getAttribute('aria-disabled') === 'true';

test('the icon is beside New, for the folder being shown, and not on a folder\'s row', async () => {
  await fresh();
  assert.equal(el.files.querySelector('.start-today'), null);
  go('journal', null, { focus: false });
  assert.equal(gray(), false);
  assert.equal(el.startBtn.parentElement, el.newBtn.parentElement);
  assert.equal(el.startBtn.getAttribute('aria-label'), "Start today's");
  assert.equal(el.startBtn.title, "Start today's from 2026-11-01.");
  assert.ok(el.startBtn.querySelector('svg'));
  assert.equal(el.startBtn.textContent, '');
  assert.equal(el.files.querySelector('.start-today'), null);
});

test('in a folder with no dated file it\'s gray, not gone, says why, and starts nothing', async () => {
  await fresh();
  assert.equal(el.startBtn.hidden, false);
  assert.equal(gray(), true);
  assert.equal(el.startBtn.disabled, false, 'or it couldn\'t say why');
  assert.match(el.startBtn.title, /once this folder has a file with a date in its name/);
  assert.ok(el.startBtn.querySelector('svg'));
  el.startBtn.click();
  await settled();
  assert.deepEqual(asked, []);
  assert.equal(hidden(), undefined);
  go('journal', null, { focus: false });
  assert.equal(gray(), false);
  starts = [];
  await loadTree();
  assert.equal(gray(), true);
});

test('New is an icon that still says its name', async () => {
  await fresh();
  assert.ok(el.newBtn.querySelector('svg'));
  assert.equal(el.newBtn.textContent, '');
  assert.equal(el.newBtn.getAttribute('aria-label'), 'New file');
});

test('it\'s gray under Today and in a file\'s versions, which list other files', async () => {
  await fresh('journal');
  el.todayBtn.click();
  assert.equal(gray(), true);
  assert.match(el.startBtn.title, /back in the folder/);
  el.startBtn.click();
  await settled();
  assert.deepEqual(asked, []);
  el.todayBtn.click();
  assert.equal(gray(), false);
  state.group = '2026-10-30';
  files = [...files, { path: 'journal/2026-10-30.draft.md', date: '2026-10-30' }];
  await loadTree();
  assert.ok(state.group, 'still in the versions');
  assert.equal(gray(), true);
  state.group = null;
});

test('in a file\'s outline the folder is still what it\'s of, so it starts', async () => {
  await fresh('journal');
  state.current = { path: 'journal/2026-10-30.md', type: 'md' };
  state.outline = true;
  drawTree();
  assert.equal(gray(), false);
  assert.equal(el.startBtn.title, "Start today's from 2026-11-01.");
  el.startBtn.click();
  await settled();
  assert.ok(hidden());
  mock.timers.tick(15000);
  await settled();
});

test('once today\'s is there it stays, and opens that', async () => {
  await fresh('journal');
  const before = el.startBtn.innerHTML;
  files = [...files, { path: 'journal/2026-11-03.md', date: '2026-11-03' }];
  starts = [{ dir: 'journal', open: 'journal/2026-11-03.md' }];
  await loadTree();
  assert.equal(gray(), false);
  assert.notEqual(el.startBtn.innerHTML, before);
  assert.equal(el.startBtn.getAttribute('aria-label'), "Open today's");
  assert.equal(el.startBtn.title, "Open today's, 2026-11-03.md.");
  el.startBtn.click();
  await settled();
  assert.equal(state.current.path, 'journal/2026-11-03.md');
  assert.deepEqual(asked, [], 'nothing is started');
  assert.equal(hidden(), undefined);
});

test('New offers a name no file has, in the folder being shown', async () => {
  await fresh('journal');
  el.newBtn.click();
  assert.equal(el.newName.value, 'journal/untitled.md');
  el.newBtn.click();
  files = [...files, { path: 'journal/untitled.md', date: null }, { path: 'journal/untitled-2.md', date: null }];
  await loadTree();
  el.newBtn.click();
  assert.equal(el.newName.value, 'journal/untitled-3.md');
  el.newBtn.click();
});

test('from the list over the page in Work, a gray Start today\'s leaves it open, and a live one closes it', async () => {
  await fresh();
  setWorking(true);
  el.sidebarToggle.click();
  assert.equal(listOpen(), true);
  offer().click();
  assert.equal(listOpen(), true, 'gray');
  go('journal', null, { focus: false });
  offer().click();
  assert.equal(listOpen(), false);
  await settled();
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  say({ type: 'started-over', edits: [], failed: null });
  await settled();
  assert.equal(state.current.path, 'journal/2026-11-03.md');
  assert.equal(state.working, true);
  setWorking(false);
});

test('from the list over the page in Work, New leaves it open until the file is made', async () => {
  await fresh();
  setWorking(true);
  el.sidebarToggle.click();
  el.newBtn.click();
  assert.equal(listOpen(), true);
  el.newName.value = 'made.md';
  el.newForm.dispatchEvent(new window.Event('submit', { cancelable: true }));
  await settled();
  assert.equal(listOpen(), false);
  assert.equal(state.current.path, 'made.md');
  assert.equal(state.working, true);
  setWorking(false);
});

test('Esc in the list over the page in Work closes the list, and only the next one leaves Work', async () => {
  await fresh();
  setWorking(true);
  el.sidebarToggle.click();
  const esc = (target) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  el.filter.value = 'no';
  esc(el.filter);
  assert.equal(listOpen(), true, 'it clears the filter first');
  assert.equal(state.working, true);
  esc(el.filter);
  assert.equal(listOpen(), false);
  assert.equal(state.working, true);
  esc(document.activeElement);
  assert.equal(state.working, false);
});

test('a finger held on the icon says what it would, and doesn\'t press it; a tap presses it', async () => {
  await fresh('journal');
  const press = (type, pointerType = 'touch') => offer().dispatchEvent(Object.assign(new window.Event(type, { bubbles: true }), { pointerType }));
  el.toast.textContent = '';
  press('pointerdown');
  mock.timers.tick(499);
  assert.equal(el.toast.textContent, '');
  mock.timers.tick(1);
  assert.equal(el.toast.textContent, "Start today's from 2026-11-01.");
  press('pointerup');
  offer().click();
  await settled();
  assert.equal(hidden(), undefined, 'the press that said it starts nothing');
  // Nor does it if the list is drawn again under the finger.
  el.toast.textContent = '';
  press('pointerdown');
  await loadTree();
  mock.timers.tick(500);
  assert.equal(el.toast.textContent, "Start today's from 2026-11-01.");
  press('pointerup');
  offer().click();
  await settled();
  assert.equal(hidden(), undefined, 'not on the button drawn since either');
  // A quick tap, then, is still a tap.
  press('pointerdown');
  mock.timers.tick(100);
  press('pointerup');
  offer().click();
  await settled();
  assert.ok(hidden());
  mock.timers.tick(15000);
  await settled();
});

test('the frame\'s edits go to the server, which is told what they\'re of, and the new file opens and is in Today', async () => {
  await fresh('journal');
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
  assert.equal(offer().getAttribute('aria-label'), "Open today's");
  assert.equal(offer().disabled, false);
});

test('a frame that fails writes nothing, and says so', async () => {
  await fresh('journal');
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
  await fresh('journal');
  offer().click();
  await settled();
  assert.ok(hidden());
  mock.timers.tick(15000);
  await settled();
  assert.deepEqual(posts(), []);
  assert.match(el.toast.textContent, /wasn't started.*too long/);
  assert.equal(hidden(), undefined);
  assert.equal(offer().disabled, false, 'and it can be tried again');
});

test('refused by the server, the list is looked at again', async () => {
  await fresh('journal');
  refuse = 'journal/2026-11-03.md already exists';
  offer().click();
  await settled();
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  starts = [{ dir: 'journal', open: 'journal/2026-11-03.md' }];
  say({ type: 'started-over', edits: [], failed: null });
  await settled();
  assert.match(el.toast.textContent, /already exists/);
  assert.equal(offer().getAttribute('aria-label'), "Open today's");
});

test('pressed twice, it starts once', async () => {
  await fresh('journal');
  const b = offer();
  b.click();
  b.click();
  await settled();
  assert.equal(asked.length, 1);
  assert.equal(b.disabled, true);
  mock.timers.tick(15000);
  await settled();
});

// Under Today: the series waiting for today's, as the server says, each started from there.
const WAITING = [
  { ...JOURNAL[0], waiting: true },
  { dir: 'old', from: 'old/invoice-2019-03-14.md', date: '2019-03-14', to: 'old/invoice-2026-11-03.md', waiting: false },
  { dir: 'todo', open: 'todo/2026-11-03.md' },
  { dir: '', from: '2026-11-01.md', date: '2026-11-01', to: '2026-11-03.md', waiting: true },
];
const waitingRows = () => [...el.files.querySelectorAll('.waiting')];
/** Fresh, the series as `WAITING` has them, and Today showing. */
async function inToday() {
  await fresh();
  starts = WAITING;
  files = [...files, { path: 'todo/2026-11-03.md', date: '2026-11-03' }];
  await loadTree();
  el.todayBtn.click();
}

test('under Today, the series waiting for today\'s are listed after its files, by folder, with what each starts from', async () => {
  await inToday();
  const items = [...el.files.children].map((li) => li.querySelector('.file')?.dataset.path ?? li.querySelector('.waiting')?.dataset.dir ?? li.textContent);
  assert.deepEqual(items, ['todo/2026-11-03.md', "Start today's", '', 'journal']);
  assert.equal(el.crumbs.querySelector('.found-name').textContent, 'Today · 1 file, 2 to start');
  const [top, journal] = waitingRows();
  assert.equal(top.querySelector('.name').textContent, 'notes');
  assert.equal(journal.querySelector('.name').textContent, 'journal');
  assert.equal(journal.querySelector('.sub').textContent, 'from 2026-10-30.md');
  assert.equal(journal.title, "Start today's 2026-11-03.md from 2026-11-01.");
  assert.ok(journal.querySelector('svg'));
  assert.equal(el.filesNote.textContent, '');
  // Not one gone quiet, which still offers beside New.
  assert.equal(el.files.querySelector('.waiting[data-dir="old"]'), null);
  go('old', null, { focus: false });
  assert.equal(gray(), false);
});

test('with nothing dated today, they\'re listed in its place, and the filter narrows them', async () => {
  await inToday();
  files = files.filter((f) => f.path !== 'todo/2026-11-03.md');
  await loadTree();
  assert.equal(el.filesNote.textContent, '');
  assert.equal(waitingRows().length, 2);
  assert.equal(el.crumbs.querySelector('.found-name').textContent, 'Today · 2 to start');
  el.filter.value = 'JOURNAL';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.deepEqual(waitingRows().map((b) => b.dataset.dir), ['journal']);
  el.filter.value = 'nothing';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.deepEqual(waitingRows(), []);
  assert.match(el.filesNote.textContent, /Nothing dated today matches/);
});

test('started from Today, its file is listed there, and Today and the open file stay', async () => {
  await inToday();
  el.todayBtn.click();
  state.current = { path: 'notes.md', type: 'md' };
  setWorking(true);
  // Pressed in Work, it comes over the page.
  el.todayBtn.click();
  assert.equal(listOpen(), true);
  assert.equal(state.todayShown, true);
  el.files.querySelector('.waiting[data-dir="journal"]').click();
  await settled();
  assert.equal(listOpen(), true, 'the list stays over the page');
  const { say } = framed();
  say({ type: 'ready' });
  await settled();
  say({ type: 'started-over', edits: [], failed: null });
  await settled();
  assert.deepEqual(posts()[0].body, { dir: 'journal', from: 'journal/2026-10-30.md', mtime: 1, edits: [] });
  assert.equal(state.todayShown, true);
  assert.equal(state.current.path, 'notes.md');
  assert.equal(document.activeElement, el.files.querySelector('.file[data-path="journal/2026-11-03.md"]'));
  assert.equal(el.files.querySelector('.waiting[data-dir="journal"]'), null);
  assert.match(el.toast.textContent, /Started journal\/2026-11-03\.md from 2026-10-30\.md/);
  setWorking(false);
});
