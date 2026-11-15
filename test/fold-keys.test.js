import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

const window = globals(app());
globalThis.fetch = async (url) => {
  const ask = String(url);
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { files: [{ path: 'a.md', type: 'md', mtime: 1 }] }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el } = await import('../static/app/state.js');
// What the app sends the page.
const sent = [];
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage: (m) => sent.push(m) } });
await import('../static/app/main.js');
await new Promise(setImmediate);

const folding = () => sent.splice(0).filter((m) => m.type === 'fold-all').map((m) => m.folded);

test('⌘⌥[ and ⌘⌥] in the editor tell the page to fold every heading, or open every one, by the key\'s place', () => {
  el.editor.focus();
  const press = (code, opts) => {
    const e = new window.KeyboardEvent('keydown', { key: '‘', code, bubbles: true, cancelable: true, ...opts });
    el.editor.dispatchEvent(e);
    return e.defaultPrevented;
  };
  sent.length = 0;
  assert.equal(press('BracketLeft', { metaKey: true, altKey: true }), true);
  assert.equal(press('BracketRight', { ctrlKey: true, altKey: true }), true);
  assert.deepEqual(folding(), [true, false]);
  assert.equal(press('BracketLeft', { metaKey: true }), false, '⌘[ alone is not it');
  assert.deepEqual(folding(), []);
});

test('⌘⌥[ handed up from the page folds every heading too', () => {
  sent.length = 0;
  window.dispatchEvent(new window.MessageEvent('message', {
    data: { type: 'key', key: '“', code: 'BracketLeft', metaKey: true, altKey: true, ctrlKey: false, shiftKey: false },
    source: el.preview.contentWindow,
  }));
  assert.deepEqual(folding(), [true]);
});
