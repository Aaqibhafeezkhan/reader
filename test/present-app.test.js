import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// Present is offered for slides alone, as the server says when it renders a
// file (`present`); a workbook or a document doesn't offer it (gh-227).

mock.timers.enable({ apis: ['setTimeout'] });

globals(app());
const TEXT = {
  'talk.md': '---\ntype: slides\n---\n\n# One\n\n---\n\n# Two\n',
  'notes.md': '# Notes\n\n---\n\n# More\n',
  'journal.md': '---\ntype: workbook\n---\n\n# One\n\n---\n\n# Two\n',
};
globalThis.fetch = async (url, init) => {
  const ask = String(url);
  const file = decodeURIComponent(/path=([^&]*)/.exec(ask)?.[1] ?? '');
  const sent = init?.body ? JSON.parse(init.body) : {};
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { files: Object.keys(TEXT).map((path) => ({ path, type: 'md', mtime: 1 })) }
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"><p>A</p></div>', title: 'A', deck: false, present: sent.path === 'talk.md' }
    : { text: TEXT[file] ?? '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const { open } = await import('../static/app/files.js');
// The render asked for, up to Present's being offered or not, which comes
// before the frame is drawn (static/app/render.js).
const drawn = async () => {
  mock.timers.tick(1000);
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};

test('Present is offered for slides, and not for a document or a workbook, as the server says', async () => {
  await open('talk.md');
  await drawn();
  assert.equal(el.presentBtn.hidden, false, 'slides offer Present');
  await open('notes.md');
  await drawn();
  assert.equal(el.presentBtn.hidden, true, 'a document doesn\'t');
  await open('journal.md');
  await drawn();
  assert.equal(el.presentBtn.hidden, true, 'a workbook doesn\'t');
  await open('talk.md');
  await drawn();
  assert.equal(el.presentBtn.hidden, false, 'and slides again do');
});
