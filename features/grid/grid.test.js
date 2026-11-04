import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../../src/render.js';

const speaker = (src, opts) => /<div class="gm-speaker">\n([\s\S]*?)<\/div>\n<div(?: class="gm-asides")?>/.exec(render(src, opts).body)[1];

test('a list in a grid is laid out by its items, in as many columns as it says', () => {
  assert.equal(speaker('::: grid 2\n- one\n- two\n- three\n:::\n\nafter\n'), [
    '<div class="grid grid-items" style="--grid: 2">',
    '<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>',
    '</div>',
    '<p>after</p>\n',
  ].join('\n'));
});

test('otherwise each block in it is a cell, or what is between +++ lines', () => {
  assert.equal(speaker('::: grid 3\none\n\n* two\n\n> three\n:::\n'), [
    '<div class="grid" style="--grid: 3">',
    '<div class="grid-cell">\n<p>one</p>\n</div>',
    '<div class="grid-cell">\n<ul>\n<li>two</li>\n</ul>\n</div>',
    '<div class="grid-cell">\n<blockquote>\n<p>three</p>\n</blockquote>\n</div>',
    '</div>\n',
  ].join('\n'));
  assert.equal(speaker('::: grid\n### A\none\n+++\n### B\ntwo\n:::\n'), [
    '<div class="grid">',
    '<div class="grid-cell">\n<h3>A</h3>\n<p>one</p>\n</div>',
    '<div class="grid-cell">\n<h3>B</h3>\n<p>two</p>\n</div>',
    '</div>\n',
  ].join('\n'));
});

test('with no count it fits as many as there is room for: the stylesheet falls back to many', () => {
  assert.match(speaker('::: grid\n- a\n- b\n:::\n'), /^<div class="grid grid-items">\n<ul>/);
  const css = readFileSync(new URL('./grid.css', import.meta.url), 'utf8');
  assert.match(css, /repeat\(auto-fill, minmax\(min\(100%, max\(var\(--grid-least\)/, 'and none narrower than the least, nor wider than the page');
});

test('a radio list in it is still one group, and a task list still ticks', () => {
  const radios = speaker('::: grid 2\n- ( ) A\n- (x) B\n- ( ) C\n:::\n', { lines: true });
  const names = [...radios.matchAll(/type="radio"[^>]* name="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(names.length, 3);
  assert.equal(new Set(names).size, 1);
  assert.equal(radios.match(/<ul/g).length, 1);
  assert.match(radios, /<input type="radio"[^>]* data-line="2"[^>]* checked/);
  const tasks = speaker('::: grid 2\n- [ ] a\n- [x] b\n:::\n', { lines: true });
  assert.match(tasks, /<input type="checkbox" class="task-box" data-line="1"/);
  assert.match(tasks, /<input type="checkbox" class="task-box" data-line="2"[^>]* checked/);
});

test('the other names on the line are styles, its count is not, and it nests in other ::: blocks', () => {
  const html = speaker('::: grid 2 red georgia\n- a\n- b\n:::\n');
  assert.match(html, /^<div class="grid grid-items" style="--grid: 2">/);
  assert.match(html, /<li class="font" style="color: red; --font: 'georgia'">a<\/li>/);
  assert.doesNotMatch(html, /'2'|'grid'/);
  assert.match(speaker('::: grid 3 cards red\na\n:::\n'), /^<div class="grid cards" style="--grid: 3">\n<div class="grid-cell">\n<p style="color: red">a<\/p>/, 'its own words are classes');
  const nested = speaker('::: blue\n::: grid 2\none\n\ntwo\n:::\n:::\n');
  assert.match(nested, /^<div class="grid" style="--grid: 2">\n<div class="grid-cell">\n<p style="color: blue">one<\/p>/);
  const inColumns = speaker('::: columns\nleft\n+++\n::: grid 2\na\n\nb\n:::\n:::\n');
  assert.match(inColumns, /<div class="column">\n<div class="grid" style="--grid: 2">\n<div class="grid-cell">\n<p>a<\/p>\n<\/div>\n<div class="grid-cell">\n<p>b<\/p>\n<\/div>\n<\/div>\n<\/div>\n<\/div>\n$/);
});

test('it takes the line it opens on, an aside in or after it is about all of it, and in a list item it stays there', () => {
  assert.match(speaker('text\n::: grid 2\na\n:::\n', { lines: true }), /<p data-line="0">text<\/p>\n<div class="grid" style="--grid: 2" data-line="1">\n<div class="grid-cell" data-line="2">/);
  const { body } = render('::: grid 2\n- a\n- b\n~ in it\n- c\n:::\n');
  assert.equal(body.match(/class="grid/g).length, 1);
  assert.match(body, /<div class="gm-speaker">\n<div class="grid grid-items"[\s\S]*c<\/li>\n<\/ul>\n<\/div>\n<\/div>\n<div class="gm-asides">/);
  assert.match(render('- item\n\n  ::: grid 2\n  a\n\n  b\n  :::\n- next\n').body, /<li>\n<p>item<\/p>\n<div class="grid" style="--grid: 2">\n<div class="grid-cell">\n<p>a<\/p>/);
});

test('it collapses to fewer columns, and one, when narrow, and leaves room for a box hung in a cell', () => {
  const css = readFileSync(new URL('./grid.css', import.meta.url), 'utf8');
  assert.match(css, /\(100% - \(var\(--grid, 99\) - 1\) \* var\(--grid-gap\)\) \/ var\(--grid, 99\)/);
  assert.match(css, /@media \(max-width: 32em\) \{\n[^}]*grid-template-columns: minmax\(0, 1fr\)/, 'one on a phone');
  assert.match(css, /> li \{[^}]*margin: 0 0 0 var\(--gm-indent\)/);
});
