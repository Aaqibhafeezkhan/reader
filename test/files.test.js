import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// A toast hides itself a few seconds on; here it waits to be told.
mock.timers.enable({ apis: ['setTimeout'] });

globals(app());
// What the app asks the server, which answers every file with the same text.
const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  return { ok: true, json: async () => ({ text: '# A\n', mtime: 1 }) };
};

const { el, state, dirty } = await import('../static/app/state.js');
const { follow } = await import('../static/app/files.js');
const { applyEdit } = await import('../static/app/editing.js');
// The preview frame, which is drawn into once the file opens, isn't loaded.
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });

/** What following `href` from the preview asks of the server, and says. */
async function following(href) {
  Object.assign(state, { files: [{ path: 'notes/a b.md', type: 'md' }, { path: 'paper.pdf', type: 'pdf' }], current: null });
  asked.length = 0;
  el.toast.textContent = '';
  follow(href);
  await new Promise(setImmediate);
  return { asked: asked.filter((u) => u.startsWith('/api/file?')), says: el.toast.textContent };
}

test('a link to a markdown file in the content directory opens it', async () => {
  assert.deepEqual(await following('http://localhost:8734/content/notes/a%20b.md'), { asked: ['/api/file?path=notes%2Fa%20b.md'], says: '' });
});

test('a link to reader\'s own markdown, $reader/, opens it, unlisted and not to be edited; its other files aren\'t opened here (gh-263)', async () => {
  assert.deepEqual(await following('http://localhost:8734/content/$reader/docs/links.md'), { asked: ['/api/file?path=%24reader%2Fdocs%2Flinks.md'], says: '' });
  await new Promise(setImmediate);
  assert.equal(state.current?.path, '$reader/docs/links.md');
  assert.equal(el.editor.readOnly, true, 'read, not written');
  // A box ticked on its page is put back, and nothing is waiting to be saved.
  applyEdit({ edits: [{ from: 0, to: 1, before: ['# A'], after: ['# B'] }] });
  assert.equal(el.editor.value, '# A\n');
  assert.equal(dirty(), false);
  assert.equal(el.toast.textContent, 'reader\'s own files are read here, not written');
  assert.deepEqual(await following('http://localhost:8734/content/$reader/package.json'), { asked: [], says: 'no file $reader/package.json here' });
});

test('a link to a file that isn\'t one of ours, or isn\'t under the content directory, is refused', async () => {
  assert.deepEqual(await following('http://localhost:8734/content/notes/gone.md'), { asked: [], says: 'no file notes/gone.md here' });
  assert.deepEqual(await following('http://localhost:8734/content/paper.pdf'), { asked: [], says: 'no file paper.pdf here' });
  assert.deepEqual(await following('http://localhost:8734/api/notes.md'), { asked: [], says: 'no file /api/notes.md here' });
  assert.deepEqual(await following('http://elsewhere:8734/content/notes/a%20b.md'), { asked: [], says: 'no file /content/notes/a%20b.md here' });
});
