import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals, preview } from './dom.js';

// Keys for New, Start today's, Today, Make a copy, Copy for today and the
// trash (gh-290): ⌘⌥ and a letter, Ctrl+Alt elsewhere, each pressing its button.

mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
const FILES = [
  { path: 'journal/2026-11-02.md', date: '2026-11-02' },
  { path: 'journal/2026-11-03.md', date: '2026-11-03' },
  { path: 'notes.md', date: null },
];
let files = FILES;
const starts = [{ dir: 'journal', open: 'journal/2026-11-03.md' }];
let posts = [];
let puts = [];
globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
  const ask = String(url);
  const said = body && JSON.parse(body);
  if (method === 'PUT') puts.push(ask);
  if (/^\/api\/(copy|trash)/.test(ask)) posts.push({ method, ask, said });
  if (ask.startsWith('/api/trash')) files = files.filter((f) => f.path !== said.path);
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { today: '2026-11-03', starts, files: files.map((f) => ({ type: 'md', mtime: 1, ...f })) }
    : ask.startsWith('/api/trash') ? { trash: 't1' }
    : ask.startsWith('/api/copy') ? (method === 'POST'
      ? { path: 'notes.md', mtime: 2 }
      : { from: 'x', to: 'y', mtime: 7, css: '', body: '' })
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"></div>', title: 'A', deck: false }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el, state } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const { go, loadTree, open } = await import('../static/app/files.js');
const { scheduleSave, save } = await import('../static/app/saving.js');
const { AUTOSAVE_DELAY } = await import('../static/app/state.js');
const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};
await settled();

/** Presses ⌘⌥ (or what `opts` says) and the key at `code` in the editor: whether it was taken. */
async function pressing(code, opts = { metaKey: true, altKey: true }) {
  el.editor.focus();
  // ⌥ makes another letter of it on a Mac, as ⌥N is ˜.
  const key = code === 'Backspace' ? 'Backspace' : '˜';
  const e = new window.KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...opts });
  el.editor.dispatchEvent(e);
  await settled();
  return e.defaultPrevented;
}

async function fresh(path = 'notes.md') {
  files = FILES;
  posts = [];
  el.newForm.hidden = true;
  state.todayShown = false;
  await loadTree();
  go('', null, { focus: false });
  await open(path);
  await settled();
}

test('⌘⌥N shows the New form, and again puts it away, as New does', async () => {
  await fresh();
  assert.equal(await pressing('KeyN'), true);
  assert.equal(el.newForm.hidden, false);
  assert.equal(window.document.activeElement, el.newName);
  assert.equal(await pressing('KeyN'), true);
  assert.equal(el.newForm.hidden, true);
  assert.equal(await pressing('KeyN', { ctrlKey: true, altKey: true, key: 'n' }), true);
  assert.equal(el.newForm.hidden, false);
});

test('⌘⌥T shows Today in the files list, as the button does', async () => {
  await fresh();
  assert.equal(await pressing('KeyT'), true);
  assert.equal(state.todayShown, true);
  assert.equal(el.todayBtn.getAttribute('aria-pressed'), 'true');
});

test('⌘⌥⇧N opens today\'s from its folder, and does nothing where Start today\'s is gray', async () => {
  await fresh();
  assert.equal(el.startBtn.getAttribute('aria-disabled'), 'true');
  assert.equal(await pressing('KeyN', { metaKey: true, altKey: true, shiftKey: true }), true);
  assert.equal(state.current.path, 'notes.md');
  assert.equal(el.newForm.hidden, true);
  go('journal', null, { focus: false });
  assert.equal(await pressing('KeyN', { metaKey: true, altKey: true, shiftKey: true }), true);
  assert.equal(state.current.path, 'journal/2026-11-03.md');
});

test('⌘⌥Y makes a copy, and ⌘⌥⇧Y does nothing on a file with no date, as their buttons do', async () => {
  await fresh();
  assert.equal(await pressing('KeyY', { metaKey: true, altKey: true, shiftKey: true }), true);
  assert.deepEqual(posts, []);
  assert.equal(await pressing('KeyY'), true);
  assert.deepEqual(posts.filter((p) => p.method === 'POST').map((p) => [p.ask, p.said.path, p.said.today]), [['/api/copy', 'notes.md', false]]);
});

test('⌘⌥⇧Y copies a file dated another day for today', async () => {
  await fresh('journal/2026-11-02.md');
  assert.equal(await pressing('KeyY', { metaKey: true, altKey: true, shiftKey: true }), true);
  // Asked first what today's would be, as the button asks.
  assert.deepEqual(posts.map((p) => p.ask), ['/api/copy?path=journal%2F2026-11-02.md&today=1&clear=1']);
});

test('⌘⌥⌫ moves the open file to the trash, with an Undo', async () => {
  await fresh();
  assert.equal(await pressing('Backspace'), true);
  assert.deepEqual(posts.map((p) => [p.ask, p.said.path]), [['/api/trash', 'notes.md']]);
  assert.match(el.toast.textContent, /notes\.md is in the trash/);
});

test('on reader\'s own file, Make a copy and Copy for today are gone, their keys and the trash\'s do nothing, and it isn\'t saved; back on a file of yours, they\'re back (gh-263)', async () => {
  await fresh('$reader/docs/links.md');
  assert.equal(state.current.path, '$reader/docs/links.md');
  assert.deepEqual([el.copyFile.hidden, el.copyToday.hidden], [true, true]);
  for (const [code, opts] of [['KeyY'], ['KeyY', { metaKey: true, altKey: true, shiftKey: true }], ['Backspace']]) {
    assert.equal(await pressing(code, opts), true, `${code} is still taken, as the page's own`);
  }
  assert.deepEqual(posts, [], 'nothing copied or trashed');
  // Typed into it, somehow, it's neither saved in a while nor when asked.
  puts = [];
  el.editor.value = '# A, changed\n';
  scheduleSave();
  mock.timers.tick(AUTOSAVE_DELAY);
  await settled();
  await save({ explicit: true });
  await settled();
  assert.deepEqual(puts, []);
  el.editor.value = state.saved;
  await fresh('notes.md');
  assert.deepEqual([el.copyFile.hidden, el.copyToday.hidden], [false, false]);
  assert.equal(el.copyFile.getAttribute('aria-disabled'), 'false');
});

test('Ctrl+Alt that types a letter, as AltGr does, is left to be typed', async () => {
  await fresh();
  assert.equal(await pressing('KeyN', { ctrlKey: true, altKey: true, key: 'ń' }), false);
  assert.equal(el.newForm.hidden, true);
});

test('the keys work from the page, which hands them up', async () => {
  await fresh();
  const say = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, source: el.preview.contentWindow }));
  say({ type: 'key', key: '†', code: 'KeyT', metaKey: true, altKey: true, ctrlKey: false, shiftKey: false });
  await settled();
  assert.equal(state.todayShown, true);

  const p = preview();
  p.show('<p><textarea></textarea></p>');
  const box = p.document.querySelector('textarea');
  const press = (opts) => {
    const e = new p.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts });
    box.dispatchEvent(e);
    return e.defaultPrevented;
  };
  assert.equal(press({ key: 'Backspace', code: 'Backspace', metaKey: true, altKey: true }), true);
  assert.equal(press({ key: 'Backspace', code: 'Backspace', altKey: true }), false);
  assert.equal(press({ key: 'ń', code: 'KeyN', ctrlKey: true, altKey: true }), false);
});

test('each button\'s title says its key', async () => {
  await fresh('journal/2026-11-02.md');
  assert.match(el.newBtn.title, /\(⌘⌥N\)$/);
  assert.match(el.todayBtn.title, /\(⌘⌥T\)$/);
  assert.match(el.startBtn.title, /\(⌘⌥⇧N\)\.$/);
  assert.match(el.copyFile.title, /\(⌘⌥Y\)\.$/);
  assert.match(el.copyToday.title, /\(⌘⌥⇧Y\)\.$/);
  const trash = (p) => el.files.querySelector(`.file[data-path="${p}"]`)?.parentElement.querySelector('.row-action.trash');
  go('journal', null, { focus: false });
  assert.equal(trash('journal/2026-11-02.md').title, 'Move to the trash (⌘⌥⌫)');
  assert.equal(trash('journal/2026-11-03.md').title, 'Move to the trash');
});
