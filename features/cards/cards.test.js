import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../../src/render.js';

const speaker = (src, opts) => /<div class="gm-speaker">\n([\s\S]*?)<\/div>\n<div(?: class="gm-asides")?>/.exec(render(src, opts).body)[1];
const css = readFileSync(new URL('./cards.css', import.meta.url), 'utf8');

test('a list in cards is drawn by its items, still one list, its radios one choice', () => {
  const html = speaker('::: cards\n- ( ) **A** · Strength training\n- (x) **B** · Running\n:::\n\nafter\n');
  assert.match(html, /^<div class="cards">\n<ul[^>]*>\n<li class="task"><input type="radio" class="choice-box" name="(choice-\d+)"[^>]*> <strong>A<\/strong> · Strength training<\/li>\n<li class="task"><input type="radio" class="choice-box" name="\1"[^>]* checked> <strong>B<\/strong> · Running<\/li>\n<\/ul>\n<\/div>\n<p>after<\/p>\n$/);
});

test('a plain list is cards with nothing to pick, and without a list each block is a card', () => {
  assert.equal(speaker('::: cards\n- [Clean](https://trello.com/)\n- read\n:::\n'), '<div class="cards">\n<ul>\n<li><a href="https://trello.com/">Clean</a></li>\n<li>read</li>\n</ul>\n</div>\n');
  assert.equal(speaker('::: cards\none\n\n> two\n:::\n'), '<div class="cards">\n<div class="card">\n<p>one</p>\n</div>\n<div class="card">\n<blockquote>\n<p>two</p>\n</blockquote>\n</div>\n</div>\n');
});

test('it is a word of a grid too, the same class, and neither is a style', () => {
  const html = speaker('::: grid 2 cards red\n- [ ] a\n- [x] b\n:::\n');
  assert.match(html, /^<div class="grid grid-items cards" style="--grid: 2">\n<ul>\n<li class="task" style="color: red">/);
  assert.doesNotMatch(html + speaker('::: cards georgia\n- a\n:::\n'), /'cards'|'grid'/);
  assert.match(speaker('::: cards georgia\n- a\n:::\n'), /^<div class="cards">\n<ul>\n<li class="font" style="--font: 'georgia'">a<\/li>/);
});

test('its box lies over the whole card, unseen, so a click anywhere picks it, its ring the card\'s', () => {
  assert.match(css, /> li > :is\(\.choice-box, \.task-box\) \{\n {2}appearance: none;\n {2}position: absolute;\n {2}inset: 0;\n {2}z-index: 1;/);
  assert.match(css, /> li > :is\(\.choice-box, \.task-box\):focus-visible \{ outline: 3px solid var\(--gm-accent\)/);
  // a link, a video's play button, a field's own choices take their own clicks
  assert.match(css, /> li :is\(a, button, iframe, label, \.field\) \{ position: relative; z-index: 2; \}/);
});

test('the chosen card takes the accent, keeping a background of its own; a done task is filled and faded', () => {
  assert.match(css, /li:has\(> \.choice-box:checked\) \{\n {2}border-color: var\(--gm-accent\);[\s\S]*?background: var\(--card-bg, color-mix\(in srgb, var\(--gm-accent\) 10%, var\(--gm-paper\)\)\);/);
  assert.match(css, /li:has\(> \.task-box:checked\) \{\n {2}background: var\(--card-bg, var\(--gm-wash\)\);\n {2}color: var\(--gm-ink-done\);/);
  // only where it can be picked does it answer the pointer
  assert.match(css, /li:has\(> :is\(\.choice-box, \.task-box\):not\(:disabled\)\):hover/);
});

test('where it can\'t be picked, the chosen card still shows, its radio disabled', () => {
  const src = '::: cards\n- ( ) A\n- (x) B\n:::\n';
  for (const opts of [{ deck: true }, { now: Date.parse('2030-01-01') }]) {
    const doc = opts.now ? `---\nopen-until: 2026-01-01\n---\n\n${src}` : src;
    const html = speaker(doc, opts);
    assert.match(html, /<input type="radio" class="choice-box"[^>]* checked disabled>/, JSON.stringify(opts));
  }
});

test('in the system\'s colours, its border is the text\'s, and the chosen one the highlight', () => {
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /\{ border-color: CanvasText; \}/);
  assert.match(forced, /li:has\(> \.choice-box:checked\) \{ border-color: Highlight; outline: 2px solid Highlight;/);
});
