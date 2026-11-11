import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../../src/render.js';

const items = (body) => [...body.matchAll(/<li[^>]*data-n="(\d+)"/g)].map((m) => Number(m[1]));

test('a `1)` list is numbered in badges, and a `1.` list is not', () => {
  const { body } = render('1) clone\n2) install\n\ntext\n\n1. plain\n2. numbers\n');
  assert.match(body, /<ol class="badges"[^>]*>\n<li[^>]*data-n="1"[^>]*>clone<\/li>/);
  assert.deepEqual(items(body), [1, 2]);
  assert.doesNotMatch(body.split('<p')[1] + body.split('text')[1], /class="badges"/);
});

test('badges count from where the list starts, whatever the items say', () => {
  assert.deepEqual(items(render('3) three\n3) four\n3) five\n').body), [3, 4, 5]);
});

test('a list inside a badged one counts for itself, and a bullet list has none', () => {
  const { body } = render('1) one\n   - a\n   - b\n\n   1) one.one\n   2) one.two\n2) two\n');
  assert.deepEqual(items(body), [1, 1, 2, 2]);
  assert.doesNotMatch(body, /<ul class="badges"/);
});

test('a list cut by an aside keeps counting in the next row', () => {
  const { body } = render('1) one\n2) two\n\n   ~ a note\n\n   more of two\n3) three\n');
  assert.deepEqual(items(body), [1, 2, 2, 3]);
  assert.match(body, /<li data-n="2" class="gm-cont" value="2">/);
});

test('printed, a list is indented as far as its badges reach, so none is cut off at the sheet\'s margin', () => {
  const css = readFileSync(new URL('./badges.css', import.meta.url), 'utf8');
  // The document has no padding in print, and the badge hung into it (gh-251).
  assert.match(css, /@media print \{\n {2}ol\.badges \{ padding-left: max\(var\(--gm-indent\), 2\.2em\); \}\n\}/);
});
