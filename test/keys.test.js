import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals, preview } from './dom.js';

// A toast hides itself a few seconds on; here it waits to be told.
mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
// The server: a folder of three files.
globalThis.fetch = async (url) => {
  const ask = String(url);
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { files: ['a.md', 'b.md', 'c.md'].map((path) => ({ path, type: 'md', mtime: 1 })) }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el, state } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const settled = () => new Promise(setImmediate);
await settled();

/** Presses `key` in the editor: whether it was taken, and the file open after. */
async function pressing(key, opts) {
  el.editor.focus();
  const e = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  el.editor.dispatchEvent(e);
  await settled();
  return { taken: e.defaultPrevented, open: state.current.path };
}

test('⌘⌥↓ and ⌘⌥↑ go to the next file and the one before', async () => {
  assert.deepEqual(await pressing('ArrowDown', { metaKey: true, altKey: true }), { taken: true, open: 'b.md' });
  assert.deepEqual(await pressing('ArrowUp', { metaKey: true, altKey: true }), { taken: true, open: 'a.md' });
  assert.deepEqual(await pressing('ArrowDown', { ctrlKey: true, altKey: true }), { taken: true, open: 'b.md' });
});

test('⌥↓ and ⌥↑ are left to the editor, to move by a paragraph', async () => {
  const at = state.current.path;
  assert.deepEqual(await pressing('ArrowDown', { altKey: true }), { taken: false, open: at });
  assert.deepEqual(await pressing('ArrowUp', { altKey: true }), { taken: false, open: at });
});

test('the page hands ⌘⌥↑ and ⌘⌥↓ up, and leaves ⌥↑ and ⌥↓ to a box in it', () => {
  const p = preview();
  p.show('<p><textarea></textarea></p>');
  const box = p.document.querySelector('textarea');
  const press = (opts) => {
    const e = new p.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, ...opts });
    box.dispatchEvent(e);
    return e.defaultPrevented;
  };
  assert.equal(press({ metaKey: true, altKey: true }), true);
  assert.equal(press({ altKey: true }), false);
});

test('Return keeps the line\'s indent, and adds none to a line that has none', async () => {
  // happy-dom has no execCommand, so the edit is made by setRangeText.
  window.document.execCommand = () => false;
  el.editor.value = '1) Try it:\n   ```\n   node bin/reader.js';
  el.editor.setSelectionRange(el.editor.value.length, el.editor.value.length);
  assert.equal((await pressing('Enter')).taken, true);
  assert.equal(el.editor.value, '1) Try it:\n   ```\n   node bin/reader.js\n   ');
  el.editor.setSelectionRange(10, 10);
  assert.equal((await pressing('Enter')).taken, false);
  assert.equal((await pressing('Enter', { shiftKey: true })).taken, false);
});
