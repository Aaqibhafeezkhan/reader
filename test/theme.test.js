import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, preview, run } from './dom.js';
import { exportHtml } from '../src/export.js';

/**
 * A page with theme.js run in it, as the app's <head> runs it, on a system
 * whose dark mode is `system`: `turn(dark)` changes the system's, and
 * `heard` is what Theme.onChange was told. `byDefault` is the page's own
 * `<html data-default>`, as the speaker view's says `dark`.
 */
function themed({ stored, system = false, storage = true, byDefault } = {}) {
  const window = page();
  if (byDefault) window.document.documentElement.dataset.default = byDefault;
  const listeners = [];
  const query = { matches: system, addEventListener: (type, fn) => listeners.push(fn) };
  Object.defineProperty(window, 'matchMedia', {
    value: (q) => (q === '(prefers-color-scheme: dark)' ? query : { matches: false, addEventListener() {} }),
    configurable: true,
  });
  if (stored) window.localStorage.setItem('reader:theme', stored);
  if (!storage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('no storage here'); } });
  run(window, 'static/theme.js');
  const heard = [];
  window.Theme.onChange((dark, chosen) => heard.push([dark, chosen]));
  const turn = (dark) => {
    query.matches = dark;
    listeners.forEach((fn) => fn());
  };
  const root = window.document.documentElement;
  return { window, Theme: window.Theme, root, turn, heard };
}

test('the system\'s is the theme until another is chosen, and follows it', () => {
  const { Theme, root, turn, heard } = themed();
  assert.equal(Theme.chosen(), 'system');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.dataset.paper, 'light');
  turn(true);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.paper, 'dark');
  assert.equal(Theme.dark(), true);
  assert.deepEqual(heard, [[true, 'system']]);
  turn(false);
  assert.equal(root.dataset.theme, 'light');
});

test('a theme chosen is kept, applied, and holds whatever the system does', () => {
  const { window, Theme, root, turn, heard } = themed({ system: true });
  assert.equal(root.dataset.theme, 'dark');
  Theme.choose('light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.dataset.paper, 'light');
  assert.equal(window.localStorage.getItem('reader:theme'), 'light');
  turn(false);
  turn(true);
  assert.equal(root.dataset.theme, 'light');
  assert.deepEqual(heard, [[false, 'light']]);
  Theme.choose('purple');
  assert.equal(Theme.chosen(), 'light');
});

test('a page dark by default is dark under the system\'s, light only when chosen, and its document drawn as the app\'s is', () => {
  const { Theme, root, turn, heard } = themed({ byDefault: 'dark' });
  assert.equal(root.dataset.theme, 'dark');
  // the slides on it are the room's: the system's, light here
  assert.equal(root.dataset.paper, 'light');
  assert.equal(Theme.dark(), false);
  turn(true);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.paper, 'dark');
  assert.deepEqual(heard, [[true, 'system']]);
  Theme.choose('light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.dataset.paper, 'light');
  Theme.choose('dark');
  turn(false);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.paper, 'dark');
});

test('the theme kept is the one the page is drawn in from the first', () => {
  const { Theme, root } = themed({ stored: 'dark' });
  assert.equal(Theme.chosen(), 'dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(themed({ stored: 'nonsense', system: true }).root.dataset.theme, 'dark');
});

test('without storage, a theme chosen still holds while the page lasts', () => {
  const { Theme, root } = themed({ storage: false });
  assert.equal(root.dataset.theme, 'light');
  Theme.choose('dark');
  assert.equal(root.dataset.theme, 'dark');
});

test('a theme chosen in another window is taken up here', () => {
  const { window, root, heard } = themed();
  window.localStorage.setItem('reader:theme', 'dark');
  const e = new window.Event('storage');
  Object.defineProperty(e, 'key', { value: 'reader:theme' });
  window.dispatchEvent(e);
  assert.equal(root.dataset.theme, 'dark');
  assert.deepEqual(heard, [[true, 'dark']]);
});

test('the preview draws the document dark in the dark theme', () => {
  const { document, show } = preview();
  const dark = () => document.documentElement.classList.contains('gm-dark');
  show('<div class="gm-doc"></div>', { dark: true });
  assert.ok(dark());
  show('<div class="gm-doc"></div>', { dark: false });
  assert.ok(!dark());
  // An export's frame, and a printed page's, aren't told: light.
  show('<div class="gm-doc"></div>');
  assert.ok(!dark());
});

test("a page's own background wins over the theme", () => {
  const { document, show } = preview();
  const dark = () => document.documentElement.classList.contains('gm-dark');
  // light paper, dark ink, in the dark theme
  show('<div class="gm-bg" style="background-color: rgb(250, 240, 220)"></div><div class="gm-doc"></div>', { dark: true });
  assert.ok(!dark());
  // an image alone is taken for a light one
  show('<div class="gm-bg" style="background-image: url(&quot;a.jpg&quot;)"></div><div class="gm-doc"></div>', { dark: true });
  assert.ok(!dark());
  // and a dark one stays dark in the light theme
  show('<div class="gm-bg" style="background-color: rgb(0, 0, 128)"></div><div class="gm-doc"></div>', { dark: false });
  assert.ok(dark());
});

test('an exported page is light, whatever the theme, but on a dark background', () => {
  const content = { read: () => ({ text: '# A page\n\nSome words.\n' }), statFile: () => { throw new Error('none'); } };
  const { html } = exportHtml(content, 'a.md');
  // nothing in it to draw it dark: no theme, and no script
  assert.doesNotMatch(html, /<script|Theme|data-theme/);
  assert.ok(!page(html).document.documentElement.classList.contains('gm-dark'));
  // on a background, it inks itself by that alone
  const dark = exportHtml({ ...content, read: () => ({ text: '---\nbackground: "#102030"\n---\n\nWords.\n' }) }, 'a.md').html;
  assert.match(dark, /Ink\.set\(\);/);
});
