import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../src/anchors.js';
import { render } from '../src/render.js';
import { pages } from '../src/slides.js';

const ids = (body) => [...body.matchAll(/<h[1-6][^>]* id="([^"]*)"/g)].map((m) => m[1]);

test('a heading is given an id from its words, as GitHub makes them', () => {
  const { body } = render('# The plan\n\n## What\'s next? (2027)\n\n### snake_case and kebab-case\n\n#### Über café\n');
  assert.deepEqual(ids(body), ['the-plan', 'whats-next-2027', 'snake_case-and-kebab-case', 'über-café']);
});

test('each space is a dash, and nothing else is squeezed out', () => {
  assert.equal(slug('A  b - c'), 'a--b---c');
  assert.equal(slug('  Trimmed  '), 'trimmed');
  assert.equal(slug('100% & more!'), '100--more');
});

test('a heading said again is -1, then -2, and one already taken is passed over', () => {
  const { body } = render('# The plan\n\n# The plan\n\n# The plan 1\n\n# The plan\n');
  assert.deepEqual(ids(body), ['the-plan', 'the-plan-1', 'the-plan-1-1', 'the-plan-2']);
});

test("a heading's box, its own styles and its marks are no part of its id", () => {
  const { body } = render('# [ ] Morning\n\n## [x] {uppercase} Evening\n\n## [The plan]{red} again\n\n## Use `code` here\n');
  assert.deepEqual(ids(body), ['morning', 'evening', 'the-plan-again', 'use-code-here']);
});

test('dashes and arrows count as written, before the typographer and the arrows turn them', () => {
  const { body } = render('## Before -- after -> then "quoted"\n');
  assert.match(body, /<h2 id="before----after---then-quoted">Before – after → then “quoted”<\/h2>/);
});

test('an emoji is dropped, as GitHub drops it, and an unknown shortcode is words', () => {
  const { body } = render('## Party :tada: time\n\n## A :not-an-emoji: one\n');
  assert.deepEqual(ids(body), ['party--time', 'a-not-an-emoji-one']);
});

test('a heading with no words has no id', () => {
  const { body } = render('## !!!\n');
  assert.match(body, /<h2>!!!<\/h2>/);
});

test('render says the line each id is on', () => {
  const { anchors } = render('---\ntitle: T\n---\n\n# One\n\n~ a note\n\n## Two\n\n## One\n');
  assert.deepEqual(anchors, { one: 4, two: 8, 'one-1': 10 });
});

test("a deck's pages count their headings through the whole of it", () => {
  const out = pages('---\ntype: workbook\n---\n\n# Day\n\n---\n\n# Day\n\n## Notes\n');
  assert.match(out.pages[0].body, /<h1 id="day"/);
  assert.match(out.pages[1].body, /<h1 id="day-1"/);
  assert.deepEqual(out.anchors, { day: 4, 'day-1': 8, notes: 10 });
});
