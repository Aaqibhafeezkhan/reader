import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { pages } from '../../src/slides.js';
import { link } from './index.js';

const links = (body) => [...body.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);

test('link:#id[] links on the page, named by the brackets, or an item by its badges, or else its id', () => {
  const { body } = render('See link:#1.d[], link:#Q1[] link:#5[Proposals] and link:#the-plan[].\n');
  assert.deepEqual(links(body), [['#1.d', '1 d)'], ['#Q1', 'Q1'], ['#5', 'Proposals'], ['#the-plan', 'the-plan']]);
  assert.deepEqual(link('#2.b.1', ''), { href: '#2.b.1', label: '2 b 1)' });
});

test('link: with no id, or in code, stays as typed', () => {
  const { body } = render('link:[x] and `link:#1[]`\n');
  assert.match(body, /<p>link:\[x\] and <code>link:#1\[\]<\/code><\/p>/);
});

test('each item of a badged list is given its badges as its id, outermost first, and render says its line', () => {
  const md = '1) Favor icons over words:\n   d) Today should be an icon\n2) Remove\n   b) A chip, which would replace link:#1.d[] or [1 d)](#1.d)\n';
  const { body, anchors } = render(md);
  assert.match(body, /<li data-n="1" id="1">/);
  assert.match(body, /<li data-n="d" id="1.d">Today should be an icon<\/li>/);
  assert.match(body, /<li data-n="b" id="2.b">A chip, which would replace <a href="#1.d">1 d\)<\/a> or <a href="#1.d">1 d\)<\/a><\/li>/);
  assert.deepEqual(anchors, { 1: 0, '1.d': 1, 2: 2, '2.b': 3 });
});

test('a heading keeps its id, the first of two items with one keeps it, and one under a bullet has none', () => {
  const { body, anchors } = render('# 1\n\n1) one\n2) two\n\n- a bullet\n  1) under it\n\n1) one again\n2) two again\n');
  assert.match(body, /<h1 id="1">/);
  assert.match(body, /<li data-n="1">one<\/li>\n<li data-n="2" id="2">two<\/li>/);
  assert.match(body, /<li data-n="1">under it<\/li>/);
  assert.match(body, /<li data-n="1">one again<\/li>\n<li data-n="2">two again<\/li>/);
  assert.deepEqual(anchors, { 1: 0, 2: 3 });
});

test('an item an aside cuts in two has its id once, on its first part', () => {
  const { body } = render('1) one\n2) two\n\n   ~ a note\n\n   more of two\n');
  assert.equal(body.match(/id="2"/g).length, 1);
  assert.match(body, /<li data-n="2" id="2">/);
});

test("a workbook's pages give their items ids through the whole of it", () => {
  const out = pages('---\ntype: workbook\n---\n\n1) one\n\n---\n\n1) one again\n2) two\n');
  assert.match(out.pages[0].body, /<li data-n="1" id="1"/);
  assert.match(out.pages[1].body, /<li data-n="1"[^>]*>one again<\/li>\n<li data-n="2" id="2"/);
  assert.doesNotMatch(out.pages[1].body, /id="1"/);
  assert.deepEqual(out.anchors, { 1: 4, 2: 9 });
});
