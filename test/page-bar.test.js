import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages } from '../src/slides.js';
import { app, globals } from './dom.js';

// pages.js is the app's, for the browser: loaded here on the app's page.
globals(app());
const { el } = await import('../static/app/state.js');
const { setPages, fit } = await import('../static/app/pages.js');

const style = readFileSync(new URL('../static/style.css', import.meta.url), 'utf8');
const rule = (selector) => style.match(new RegExp(`^${selector.replace(/[.()[\]]/g, '\\$&')} \\{([^}]*)\\}`, 'm'))?.[1] ?? '';

const TWELVE = Array.from({ length: 12 }, (_, i) => `# [ ] Page ${i + 1}`).join('\n\n---\n\n');

// happy-dom lays nothing out: the dots are given the widths a browser would.
function widths(needs, has) {
  Object.defineProperty(el.pageDots, 'scrollWidth', { configurable: true, get: () => needs });
  Object.defineProperty(el.pageDots, 'clientWidth', { configurable: true, get: () => has });
}

test('a phone\'s page bar goes without its dots, which have no room, and keeps to one line (gh-247)', () => {
  widths(276, 0);
  setPages(pages(TWELVE, { file: 'a.md' }).pages, 'a.md');
  assert.ok(el.pages.classList.contains('crowded'));
  assert.equal(el.pageCount.textContent, 'Page 1 of 12', 'what says where the page is, in their place');
});

test('a bar wide enough for its dots shows them, measured afresh as it widens', () => {
  widths(276, 0);
  fit();
  assert.ok(el.pages.classList.contains('crowded'));
  widths(276, 600);
  fit();
  assert.ok(!el.pages.classList.contains('crowded'));
});

test('the dots never wrap or squeeze Back and Next: they overflow, which is how the bar knows it\'s crowded', () => {
  const dots = rule('.page-dots');
  assert.doesNotMatch(dots, /flex-wrap: wrap/, 'wrapped, they stacked into a column half the screen high');
  assert.match(dots, /min-width: 0/);
  assert.match(dots, /overflow: hidden/);
  assert.match(rule('.pages > button'), /flex: none/);
  assert.match(rule('.pages.crowded .page-dots, .pages.crowded .page-done progress'), /display: none/);
});

test('the bar of pages done is drawn in the palette\'s colours, and the browser\'s own where colours are forced', () => {
  // Firefox drew an empty bar full in the dark theme from an accent-color (gh-248).
  assert.doesNotMatch(rule('.page-done progress'), /accent-color:/);
  const drawn = /@media not \(forced-colors: active\) \{\n([\s\S]*?)\n\}/.exec(style)?.[1] ?? '';
  assert.match(drawn, /^ {2}progress \{[^}]*appearance: none;[^}]*background: var\(--line\);/m);
  assert.match(drawn, /progress::-webkit-progress-value \{ background: var\(--accent\); \}/);
  assert.match(drawn, /progress::-moz-progress-bar \{ background: var\(--accent\); \}/);
});
