import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals, assertElement } from './dom.js';

// Today, a button in the top bar: the files dated today, wherever they are, as a view in the files list.

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
const { go, loadTree, open, showOutline, step } = await import('../static/app/files.js');
const settled = () => new Promise(setImmediate);
await settled();

const paths = () => [...el.files.querySelectorAll('.file')].map((b) => b.dataset.path);
const row = (p) => el.files.querySelector(`.file[data-path="${p}"]`);
const pressed = () => el.todayBtn.getAttribute('aria-pressed');
const press = (target, key, opts = {}) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
const sideways = () => el.split.classList.remove('no-sidebar', 'list-open', 'work-mode');

/** Back as the app started, at the top of the folder, with nothing open or filtered. */
async function fresh(dir = '') {
  files = start();
  el.filter.value = '';
  // The file stays open: its address changing, which happy-dom says a little
  // later, then asks to open nothing new, and leave the list alone.
  state.outline = false;
  state.working = false;
  sideways();
  await loadTree();
  go(dir, null, { focus: false });
}
/** Fresh, with Today showing. */
async function shown(dir = '') {
  await fresh(dir);
  el.todayBtn.click();
}

test('the Today button is there from the start, not pressed, and the folder lists as it did', async () => {
  await fresh();
  assert.equal(el.todayBtn.tagName, 'BUTTON');
  assert.equal(el.todayBtn.textContent, 'Today');
  assert.equal(pressed(), 'false');
  assert.equal(document.getElementById('today'), null, 'no widget above the folder');
  assert.deepEqual(paths(), ['plain.md']);
});

test('pressed, it lists the files dated today from every folder, as a search does, and stays pressed', async () => {
  await shown();
  assert.equal(pressed(), 'true');
  assert.deepEqual(paths(), [`journal/${TODAY}.md`, 'todo/list.md']);
  assert.equal(row('todo/list.md').querySelector('.sub').textContent, 'todo');
  assert.equal(el.files.querySelector('.folder'), null);
  assert.equal(el.filesNote.textContent, '');
});

// Today is a search, of every folder: where the list is (the crumbs) would mislead,
// and what it found is said in their place, with an × back to the folder.
const found = () => (el.crumbs.hidden ? null : el.crumbs.querySelector('.found-name')?.textContent ?? 'crumbs');
const leave = () => el.crumbs.querySelector('.leave');

test('in Today, over a folder, the crumbs give way to what it found, and an × to leave it', async () => {
  await fresh('journal');
  assert.equal(found(), 'crumbs');
  el.todayBtn.click();
  assert.equal(found(), 'Today · 2 files');
  assert.equal(el.crumbs.querySelectorAll('button').length, 1);
  assert.equal(leave().getAttribute('aria-label'), 'Leave Today');
  assert.ok(leave().querySelector('svg'));
});

test('what Today found is counted one by one, and nothing is said as nothing yet', async () => {
  await fresh();
  files = files.filter((f) => f.path !== 'todo/list.md');
  await loadTree();
  el.todayBtn.click();
  assert.equal(found(), 'Today · 1 file');
  files = files.map((f) => ({ ...f, date: null }));
  await loadTree();
  assert.equal(found(), 'Today · nothing yet');
});

test('a filter in Today says what it\'s narrowed to, and the × leaves Today and the filter both', async () => {
  await shown('journal');
  el.filter.value = 'List ';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.equal(found(), 'Today · “List” · 1 file');
  assert.equal(leave().getAttribute('aria-label'), 'Leave Today');
  el.filter.value = 'plain';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.equal(found(), 'Today · “plain” · nothing');
  leave().click();
  assert.equal(pressed(), 'false');
  assert.equal(el.filter.value, '');
  assert.equal(found(), 'crumbs');
  assert.equal(state.dir, 'journal');
});

test('a filter, which lists from every folder too, says what it found, and its × clears it back to the folder', async () => {
  await fresh('journal');
  el.filter.value = 'md';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.equal(found(), '“md” · 4 files');
  assert.equal(el.files.getAttribute('aria-labelledby'), 'foundName');
  el.filter.value = 'list';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.equal(found(), '“list” · 1 file');
  el.filter.value = 'nowhere';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.equal(found(), '“nowhere” · no files');
  assert.equal(leave().getAttribute('aria-label'), 'Clear the filter');
  leave().click();
  assert.equal(el.filter.value, '');
  assert.equal(found(), 'crumbs');
  assert.deepEqual(paths(), ['journal/2020-01-01.md', `journal/${TODAY}.md`]);
  assertElement(document.activeElement, el.filter);
  assert.equal(el.files.hasAttribute('aria-labelledby'), false);
});

test('the filter narrows them further, and clearing it gives them all back', async () => {
  await shown();
  el.filter.value = 'list';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.deepEqual(paths(), ['todo/list.md']);
  assert.equal(pressed(), 'true');
  el.filter.value = 'plain';
  el.filter.dispatchEvent(new window.Event('input'));
  assert.deepEqual(paths(), []);
  assert.match(el.filesNote.textContent, /Nothing dated today matches/);
  press(el.filter, 'Escape');
  assert.deepEqual(paths(), [`journal/${TODAY}.md`, 'todo/list.md']);
  assert.equal(el.filesNote.textContent, '');
});

test('with nothing dated today the button stays, and the list says so', async () => {
  await fresh();
  files = files.map((f) => ({ ...f, date: null }));
  await loadTree();
  el.todayBtn.click();
  assert.equal(pressed(), 'true');
  assert.deepEqual(paths(), []);
  assert.equal(el.filesNote.textContent, 'Nothing is dated today.');
  assert.equal(el.filesNote.getAttribute('role'), 'status');
  el.todayBtn.click();
  assert.equal(el.filesNote.textContent, '');
});

for (const [how, out] of [
  ['pressing it again', () => el.todayBtn.click()],
  ['←', () => press(document.activeElement, 'ArrowLeft')],
  ['its ×', () => leave().click()],
]) {
  test(`${how} goes back to the folder it was over`, async () => {
    await shown('journal');
    el.filter.value = '';
    row(`journal/${TODAY}.md`).focus();
    out();
    assert.equal(pressed(), 'false');
    assert.equal(state.dir, 'journal');
    assert.deepEqual(paths(), ['journal/2020-01-01.md', `journal/${TODAY}.md`]);
    assert.equal(found(), 'crumbs');
  });
}

test('← backs out with a filter typed too, and takes the filter with it', async () => {
  await shown('journal');
  el.filter.value = 'list';
  el.filter.dispatchEvent(new window.Event('input'));
  row('todo/list.md').focus();
  press(document.activeElement, 'ArrowLeft');
  assert.equal(pressed(), 'false');
  assert.equal(el.filter.value, '');
  assert.equal(state.dir, 'journal');
});

test('with the list closed, it opens the list rather than do nothing', async () => {
  await fresh();
  el.split.classList.add('no-sidebar');
  el.todayBtn.click();
  assert.equal(el.split.classList.contains('no-sidebar'), false);
  assert.equal(el.sidebarToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(pressed(), 'true');
});

test('in Work, the list comes over the page, Work stays, and pressing again with it gone shows it again', async () => {
  await fresh();
  await open(`journal/${TODAY}.md`);
  assert.equal(state.working, true);
  el.todayBtn.click();
  assert.equal(el.split.classList.contains('list-open'), true);
  assert.equal(state.working, true);
  assert.equal(pressed(), 'true');
  row('todo/list.md').click();
  await settled();
  assert.equal(el.split.classList.contains('list-open'), false, 'picking a file closes it');
  assert.equal(pressed(), 'true');
  await open(`journal/${TODAY}.md`);
  el.todayBtn.click();
  assert.equal(el.split.classList.contains('list-open'), true, 'shown, not let go of unseen');
  assert.equal(pressed(), 'true');
  el.todayBtn.click();
  assert.equal(pressed(), 'false', 'seen, and pressed again, it goes');
  await open('plain.md');
});

test('going into a folder, a file\'s versions or its outline is no longer Today', async () => {
  await shown();
  await open('todo/list.md');
  showOutline();
  assert.equal(pressed(), 'false');
  go('', null, { focus: false });
  assert.deepEqual(paths(), ['plain.md']);
});

test('a file\'s versions dated today are one row, as they are in a folder', async () => {
  await fresh();
  files = [{ path: `journal/${TODAY}.md`, date: TODAY }, { path: `journal/${TODAY}.review.md`, date: TODAY }];
  await loadTree();
  el.todayBtn.click();
  const rows = el.files.querySelectorAll('.file');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].querySelector('.sub').textContent, 'journal · 2 versions');
});

test('a workbook opens from Today in Work, and a document as last chosen', async () => {
  await shown();
  row('todo/list.md').click();
  await settled();
  assert.equal(state.current.path, 'todo/list.md');
  assert.equal(state.working, false);
  row(`journal/${TODAY}.md`).click();
  await settled();
  assert.equal(state.current.path, `journal/${TODAY}.md`);
  assert.equal(state.working, true);
  // The open file's row says so, for a screen reader too.
  assert.equal(row(`journal/${TODAY}.md`).getAttribute('aria-current'), 'true');
  await open('plain.md');
});

test('a screen reader has Today\'s list by what it found, and each row\'s folder, Today and keys', async () => {
  await shown();
  assert.equal(el.files.getAttribute('aria-labelledby'), 'foundName');
  assert.equal(document.getElementById('foundName').textContent, 'Today · 2 files');
  assert.equal(document.getElementById('todayName').textContent, 'Today');
  const r = row('todo/list.md');
  assert.equal(r.tagName, 'BUTTON');
  assert.equal(r.textContent, 'listtodo');
  assert.equal(r.getAttribute('aria-describedby'), 'todayName filesKeys');
  el.todayBtn.click();
  assert.equal(el.files.hasAttribute('aria-labelledby'), false);
});

test('pressed, the keyboard goes to the first row, and the arrows go through them from the filter', async () => {
  await shown();
  assertElement(document.activeElement, row(`journal/${TODAY}.md`));
  press(document.activeElement, 'ArrowDown');
  assertElement(document.activeElement, row('todo/list.md'));
  press(el.filter, 'ArrowDown');
  assertElement(document.activeElement, row(`journal/${TODAY}.md`));
});

test('redrawing keeps the row that has focus', async () => {
  await shown();
  row('todo/list.md').focus();
  await loadTree();
  assertElement(document.activeElement, row('todo/list.md'));
});

test('stepping through files in Today goes through Today\'s', async () => {
  await shown('journal');
  await open(`journal/${TODAY}.md`);
  step(1);
  await settled();
  assert.equal(state.current.path, 'todo/list.md');
  await open('plain.md');
});

test('F2 on a row in Today renames it there', async () => {
  await shown('todo');
  const r = row('todo/list.md');
  r.focus();
  press(r, 'F2');
  const input = el.files.querySelector('.name-edit');
  assert.ok(input);
  input.value = 'renamed';
  press(input, 'Enter');
  await settled();
  assert.deepEqual(paths(), [`journal/${TODAY}.md`, 'todo/renamed.md']);
  assertElement(document.activeElement, row('todo/renamed.md'));
});

test('renaming a file out of Today leaves the keyboard on the filter', async () => {
  await shown();
  const r = row('todo/list.md');
  r.focus();
  press(r, 'F2');
  const input = el.files.querySelector('.name-edit');
  input.value = 'undated';
  press(input, 'Enter');
  await settled();
  assert.deepEqual(paths(), [`journal/${TODAY}.md`]);
  assertElement(document.activeElement, el.filter);
});

test('⌘⌫ on a row in Today trashes it, and the keyboard goes on to the next in Today', async () => {
  await shown();
  const r = row(`journal/${TODAY}.md`);
  r.focus();
  press(r, 'Backspace', { metaKey: true });
  await settled();
  assert.deepEqual(paths(), ['todo/list.md']);
  assertElement(document.activeElement, row('todo/list.md'));
  // The last of them, and the list says there's nothing, with the keyboard somewhere it can be.
  press(document.activeElement, 'Backspace', { metaKey: true });
  await settled();
  assert.equal(el.filesNote.textContent, 'Nothing is dated today.');
  assertElement(document.activeElement, el.filter);
});
