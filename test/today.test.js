import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals, assertElement } from './dom.js';

// Today, at the top of the files list: the files dated today, wherever they are.

// A toast hides itself a few seconds on; here it waits to be told.
mock.timers.enable({ apis: ['setTimeout'] });

const TODAY = '2026-10-31';
const WORKBOOK = '---\ntitle: Journal\ntype: workbook\n---\n\n## Today\n';
const window = globals(app());
const { document } = window;
// The server: a few folders, and whatever's asked of it done.
const start = () => [
  { path: 'journal/2020-01-01.md', date: '2020-01-01' },
  { path: `journal/${TODAY}.md`, date: TODAY },
  { path: 'plain.md', date: null },
  { path: 'todo/list.md', date: TODAY },
];
let files = start();
globalThis.fetch = async (url, { body } = {}) => {
  const ask = String(url);
  const said = body && JSON.parse(body);
  if (ask.startsWith('/api/trash')) files = files.filter((f) => f.path !== said.path);
  for (const { from, to } of ask.startsWith('/api/rename') ? said.moves : []) {
    files = files.map((f) => (f.path === from ? { ...f, path: to, date: to.includes(TODAY) || to === 'todo/renamed.md' ? TODAY : null } : f));
  }
  const file = decodeURIComponent(/path=([^&]*)/.exec(ask)?.[1] ?? '');
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { today: TODAY, files: files.map((f) => ({ type: 'md', mtime: 1, ...f })) }
    : ask.startsWith('/api/trash') ? { trash: 't1' }
    : ask.startsWith('/api/rename') ? { moved: said.moves }
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"><p>A</p></div>', title: 'A', deck: false }
    : { text: file.startsWith('journal/') ? WORKBOOK : '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el, state } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const { go, loadTree, open, drawTree, showOutline, step } = await import('../static/app/files.js');
const settled = () => new Promise(setImmediate);
await settled();

const listed = () => (el.today.hidden ? [] : [...el.todayFiles.querySelectorAll('.file')].map((b) => b.dataset.path));
const inToday = (p) => el.todayFiles.querySelector(`.file[data-path="${p}"]`);
const inFolder = (p) => el.files.querySelector(`.file[data-path="${p}"]`);
const press = (target, key, opts = {}) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...opts }));

/** Back as the app started, at the top of the folder, with nothing open or filtered. */
async function fresh(dir = '') {
  files = start();
  el.filter.value = '';
  state.current = null;
  state.outline = false;
  await loadTree();
  go(dir, null, { focus: false });
}

test('Today lists the files dated today from every folder, and not the others', async () => {
  await fresh();
  assert.equal(el.today.hidden, false);
  assert.deepEqual(listed(), [`journal/${TODAY}.md`, 'todo/list.md']);
  assert.equal(inToday('todo/list.md').querySelector('.sub').textContent, 'todo');
  // It's above the folder, and the crumbs that say which folder that is.
  assert.ok(el.today.compareDocumentPosition(el.crumbs) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(el.today.compareDocumentPosition(el.files) & window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test('Today is there whichever folder is shown, as well as the folder\'s own row for the file', async () => {
  await fresh('journal');
  assert.deepEqual(listed(), [`journal/${TODAY}.md`, 'todo/list.md']);
  assert.ok(inFolder(`journal/${TODAY}.md`));
});

test('with nothing dated today there\'s no Today', async () => {
  await fresh();
  files = files.map((f) => ({ ...f, date: null }));
  await loadTree();
  assert.equal(el.today.hidden, true);
  assert.deepEqual(listed(), []);
  assert.equal(el.todayFiles.children.length, 0);
});

test('filtering, or looking at a file\'s versions or outline, is about that and not Today', async () => {
  await fresh();
  el.filter.value = 'list';
  drawTree();
  assert.equal(el.today.hidden, true);
  el.filter.value = '';
  drawTree();
  assert.equal(el.today.hidden, false);
  await open('todo/list.md');
  showOutline();
  assert.equal(el.today.hidden, true);
  go('', null, { focus: false });
  files = [...start(), { path: 'todo/list.draft.md', date: null }];
  await loadTree();
  go('todo', 'list', { focus: false });
  assert.equal(el.today.hidden, true);
});

test('a file\'s versions dated today are one row, as they are in a folder', async () => {
  await fresh();
  files = [{ path: `journal/${TODAY}.md`, date: TODAY }, { path: `journal/${TODAY}.review.md`, date: TODAY }];
  await loadTree();
  const rows = el.todayFiles.querySelectorAll('.file');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].querySelector('.sub').textContent, 'journal · 2 versions');
});

test('a workbook opens from Today in Work, and a document as last chosen', async () => {
  await fresh();
  inToday('todo/list.md').click();
  await settled();
  assert.equal(state.current.path, 'todo/list.md');
  assert.equal(state.working, false);
  inToday(`journal/${TODAY}.md`).click();
  await settled();
  assert.equal(state.current.path, `journal/${TODAY}.md`);
  assert.equal(state.working, true);
  // The open file's row says so, for a screen reader too.
  assert.equal(inToday(`journal/${TODAY}.md`).getAttribute('aria-current'), 'true');
  await open('plain.md');
});

test('a screen reader has Today\'s list by name, and each row\'s folder, Today and keys', async () => {
  await fresh();
  assert.equal(el.todayFiles.getAttribute('aria-labelledby'), 'todayName');
  assert.equal(document.getElementById('todayName').textContent, 'Today');
  const row = inToday('todo/list.md');
  assert.equal(row.tagName, 'BUTTON');
  assert.equal(row.textContent, 'listtodo');
  assert.equal(row.getAttribute('aria-describedby'), 'todayName filesKeys');
});

test('the arrows go from the filter through Today and on into the folder', async () => {
  await fresh();
  press(el.filter, 'ArrowDown');
  assertElement(document.activeElement, inToday(`journal/${TODAY}.md`));
  press(document.activeElement, 'ArrowDown');
  assertElement(document.activeElement, inToday('todo/list.md'));
  press(document.activeElement, 'ArrowDown');
  assertElement(document.activeElement, inFolder('plain.md'));
  press(document.activeElement, 'ArrowUp');
  assertElement(document.activeElement, inToday('todo/list.md'));
});

test('going into a folder lands in the folder, and redrawing keeps the row that has focus, in its own list', async () => {
  await fresh();
  const folder = el.files.querySelector('.folder[data-dir="journal"]');
  folder.focus();
  press(folder, 'ArrowRight');
  assertElement(document.activeElement, inFolder('journal/2020-01-01.md'));
  inFolder(`journal/${TODAY}.md`).focus();
  await loadTree();
  assertElement(document.activeElement, inFolder(`journal/${TODAY}.md`));
  inToday(`journal/${TODAY}.md`).focus();
  await loadTree();
  assertElement(document.activeElement, inToday(`journal/${TODAY}.md`));
});

test('stepping through the folder\'s files leaves out Today\'s', async () => {
  await fresh('journal');
  await open(`journal/${TODAY}.md`);
  step(1);
  await settled();
  assert.equal(state.current.path, `journal/${TODAY}.md`);
  step(-1);
  await settled();
  assert.equal(state.current.path, 'journal/2020-01-01.md');
  await open('plain.md');
});

test('F2 on a row in Today renames it there, whether or not the folder lists it too', async () => {
  await fresh('todo');
  const row = inToday('todo/list.md');
  row.focus();
  press(row, 'F2');
  const input = el.todayFiles.querySelector('.name-edit');
  assert.ok(input);
  assert.equal(el.files.querySelector('.name-edit'), null);
  input.value = 'renamed';
  press(input, 'Enter');
  await settled();
  assert.deepEqual(listed(), [`journal/${TODAY}.md`, 'todo/renamed.md']);
  assertElement(document.activeElement, inToday('todo/renamed.md'));
});

test('renaming a file out of Today leaves the keyboard on the filter', async () => {
  await fresh();
  const row = inToday('todo/list.md');
  row.focus();
  press(row, 'F2');
  const input = el.todayFiles.querySelector('.name-edit');
  input.value = 'undated';
  press(input, 'Enter');
  await settled();
  assert.deepEqual(listed(), [`journal/${TODAY}.md`]);
  assertElement(document.activeElement, el.filter);
});

test('⌘⌫ on a row in Today trashes it, and the keyboard goes on to the next in Today', async () => {
  await fresh();
  const row = inToday(`journal/${TODAY}.md`);
  row.focus();
  press(row, 'Backspace', { metaKey: true });
  await settled();
  assert.deepEqual(listed(), ['todo/list.md']);
  assertElement(document.activeElement, inToday('todo/list.md'));
  // The last of them, and Today is gone, with the keyboard somewhere it can be.
  press(document.activeElement, 'Backspace', { metaKey: true });
  await settled();
  assert.equal(el.today.hidden, true);
  assertElement(document.activeElement, el.filter);
});
