import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// Which reader this is, as the app shows it: at the foot of the files list,
// and in the help. (version.test.js has what the server says.)

mock.timers.enable({ apis: ['setTimeout'] });

globals(app());
const RELEASE = 'https://github.com/jzheaux/reader/releases/tag/v0.0.2';
globalThis.fetch = async (url) => {
  const ask = String(url);
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes', version: { label: 'v0.0.2', url: RELEASE, release: true } }
    : ask.startsWith('/api/tree') ? { files: [{ path: 'a.md', type: 'md', mtime: 1 }] }
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"><p>A</p></div>', title: 'A', deck: false }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el } = await import('../static/app/state.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
await import('../static/app/main.js');
const settled = () => new Promise(setImmediate);
await settled();

test('the files list and the help both link to the release of reader this is', () => {
  for (const [where, a] of [['files', el.version], ['help', el.helpVersion.querySelector('a')]]) {
    assert.equal(a.textContent, 'v0.0.2', where);
    assert.equal(a.href, RELEASE, where);
    assert.equal(a.title, 'reader v0.0.2, its release notes', where);
    assert.equal(a.getAttribute('aria-label'), 'reader v0.0.2, its release notes', where);
  }
  assert.equal(el.version.hidden, false);
  assert.equal(el.helpVersion.hidden, false);
});
