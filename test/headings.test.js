import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';
import { render } from '../src/render.js';
import { pages, isDeck } from '../src/slides.js';

// A toast hides itself a few seconds on; here it waits to be told.
mock.timers.enable({ apis: ['setTimeout'] });

const page = globals(app());
// The files the server has, and what it answers: each file's text, and a
// render of it as the server's own would be.
const FILES = {
  'plan.md': 'See [the plan](#the-plan).\n\nwords\n\n## The plan\n\nmore\n',
  'notes/budget.md': '# Budget\n\nfirst\n\n## Last year\n\nthen\n\n## This year\n\nnow\n',
  'book.md': '---\ntype: workbook\n---\n\n# One\n\nSee [the end](#the-end).\n\n---\n\n# Two\n\nwords\n\n## The end\n',
};
const asked = [];
globalThis.fetch = async (url, init) => {
  asked.push(String(url));
  const u = new URL(String(url), 'http://localhost:8734/');
  if (u.pathname === '/api/file') {
    const text = FILES[u.searchParams.get('path')];
    return { ok: true, json: async () => ({ text, mtime: 1 }) };
  }
  if (u.pathname === '/api/render') {
    const { text, path, pages: paged } = JSON.parse(init.body);
    if (paged && isDeck(text)) return { ok: true, json: async () => ({ ...pages(text, { file: path }), deck: true }) };
    return { ok: true, json: async () => ({ ...render(text, { file: path, lines: true }), deck: false }) };
  }
  return { ok: true, json: async () => ({}) };
};

const { el, state } = await import('../static/app/state.js');
const { follow } = await import('../static/app/files.js');
const { renderNow } = await import('../static/app/render.js');
// What the app tells the preview frame, which isn't loaded.
const framed = [];
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage: (m) => framed.push(m) } });

const files = Object.keys(FILES).map((path) => ({ path, type: 'md' }));
const caret = () => el.editor.value.slice(0, el.editor.selectionStart).split('\n').length - 1;
const settled = () => new Promise(setImmediate);

/** The app with `path` open and drawn, nothing told the frame since. */
async function opened(path, { working = false } = {}) {
  Object.assign(state, { files, current: { path, type: 'md' }, working });
  el.editor.disabled = false;
  el.editor.value = FILES[path];
  el.editor.setSelectionRange(0, 0);
  page.history.replaceState(null, '', `/read/${path}`);
  await renderNow();
  framed.length = 0;
  asked.length = 0;
  el.toast.textContent = '';
}

test('a link to a heading in the open file goes to its line, opening it if it\'s folded (gh-244)', async () => {
  await opened('plan.md');
  await follow('#the-plan');
  await settled();
  assert.equal(caret(), 4);
  assert.deepEqual(framed.filter((m) => m.type === 'open-to'), [{ type: 'open-to', line: 4 }]);
  assert.deepEqual(asked.filter((u) => u.startsWith('/api/file')), [], 'nothing opened');
  assert.equal(page.location.pathname + page.location.hash, '/read/plan.md#the-plan', 'the address names the heading, as GitHub\'s does');
});

test('a link to a heading resolves against the file, not only its folder, so a copy of it names the file', async () => {
  await opened('notes/budget.md');
  const { baseFor } = await import('../static/app/render.js');
  assert.equal(baseFor('notes/budget.md'), 'http://localhost:8734/content/notes/budget.md');
  assert.equal(new URL('#this-year', baseFor('notes/budget.md')).href, 'http://localhost:8734/content/notes/budget.md#this-year');
  assert.equal(new URL('other.md', baseFor('notes/budget.md')).href, 'http://localhost:8734/content/notes/other.md', 'a file beside it, as before');
});

test('a link to a heading in another file opens it at that heading', async () => {
  await opened('plan.md');
  await follow('http://localhost:8734/content/notes/budget.md#this-year');
  await settled();
  assert.equal(state.current.path, 'notes/budget.md');
  assert.equal(caret(), 8);
  assert.deepEqual(framed.filter((m) => m.type === 'open-to').at(-1), { type: 'open-to', line: 8 });
  assert.equal(page.location.pathname + page.location.hash, '/read/notes/budget.md#this-year');
});

test('a link naming the open file and a heading in it goes there, without opening it again', async () => {
  await opened('notes/budget.md');
  await follow('http://localhost:8734/content/notes/budget.md#last-year');
  await settled();
  assert.equal(caret(), 4);
  assert.deepEqual(asked.filter((u) => u.startsWith('/api/file')), []);
});

test('a link to a heading the file hasn\'t got opens the file, and says so', async () => {
  await opened('plan.md');
  await follow('http://localhost:8734/content/notes/budget.md#next-year');
  await settled();
  assert.equal(state.current.path, 'notes/budget.md');
  assert.equal(caret(), 0);
  assert.equal(el.toast.textContent, 'no heading #next-year in notes/budget.md');
  assert.equal(page.location.pathname + page.location.hash, '/read/notes/budget.md', 'no heading named that isn\'t there');
});

test('in Work, a link to a heading on another of a workbook\'s pages turns to it, and scrolls to the heading there', async () => {
  await opened('book.md', { working: true });
  await follow('#the-end');
  await settled();
  const render = framed.filter((m) => m.type === 'render').at(-1);
  assert.match(render.body, /<h2 id="the-end"/, 'the second page');
  assert.deepEqual(framed.filter((m) => m.type === 'scroll').at(-1), { type: 'scroll', line: 14 });
  state.working = false;
});
