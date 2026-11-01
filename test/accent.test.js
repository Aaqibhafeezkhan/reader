import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAccent, accentCss } from '../src/accent.js';
import { render } from '../src/render.js';
import { slides, pages } from '../src/slides.js';
import { exportHtml } from '../src/export.js';

test('an accent is a colour name or a #hex, quoted or not, in any case', () => {
  assert.equal(readAccent('"#4a7c59"'), '#4a7c59');
  assert.equal(readAccent('#4A7C59'), '#4a7c59');
  assert.equal(readAccent("'#abc'"), '#abc');
  assert.equal(readAccent('SeaGreen'), 'seagreen');
});

test('what could not be a colour is no accent', () => {
  assert.equal(readAccent('green; } body { display: none'), null);
  assert.equal(readAccent('#4a7c5'), null);
  assert.equal(readAccent('my green'), null);
  assert.equal(readAccent(''), null);
  assert.equal(readAccent(undefined), null);
});

test('the accent is set as --own-accent, for the theme to make the accent from, never as --gm-accent', () => {
  assert.equal(accentCss({ accent: '#4a7c59' }), ':root { --own-accent: #4a7c59; }');
  assert.equal(accentCss({ accent: 'nope' }), '');
  assert.equal(accentCss({}), '');
  // an inline --gm-accent would win over the system's own colours (forced-colors)
  const { css, body } = render('---\naccent: "#4a7c59"\n---\n\n- [ ] Walk\n');
  assert.match(css, /\n:root \{ --own-accent: #4a7c59; \}$/);
  assert.doesNotMatch(css, /--gm-accent: #4a7c59/);
  assert.doesNotMatch(body, /4a7c59|accent/);
});

test('a page without an accent says nothing of one', () => {
  assert.doesNotMatch(render('- [ ] Walk\n').css, /--own-accent:/);
});

test("a deck's accent is every slide's, and every page's", () => {
  const deck = '---\ntype: slides\naccent: seagreen\n---\n\n# One\n\n---\n\n# Two\n';
  assert.match(slides(deck).css, /:root \{ --own-accent: seagreen; \}/);
  assert.match(pages(deck).css, /:root \{ --own-accent: seagreen; \}/);
});

test('an exported page keeps its accent, a document and a deck alike', () => {
  const content = (text) => ({ read: () => ({ text }), statFile: () => { throw new Error('none'); } });
  const doc = exportHtml(content('---\naccent: "#4a7c59"\n---\n\n- [x] Walk\n'), 'a.md').html;
  assert.match(doc, /<style>[\s\S]*:root \{ --own-accent: #4a7c59; \}[\s\S]*<\/style>/);
  const deck = exportHtml(content('---\ntype: workbook\naccent: "#4a7c59"\n---\n\n# One\n\n---\n\n# Two\n'), 'a.md').html;
  assert.match(deck, /<style>[\s\S]*:root \{ --own-accent: #4a7c59; \}[\s\S]*<\/style>/);
});
