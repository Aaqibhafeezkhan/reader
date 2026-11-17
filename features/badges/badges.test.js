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

test('a lettered list is drawn in badges at any depth, a lettered list to a screen reader too, and counts from its first letter', () => {
  const { body } = render('1) Favor icons over words:\n   a) Formatting\n   b) Work\n2) Remove\n   a) Move it\n      a) to the footer\n\nc) starts at c\nd) and goes on\n');
  assert.deepEqual([...body.matchAll(/<li[^>]*data-n="([^"]+)"/g)].map((m) => m[1]), ['1', 'a', 'b', '2', 'a', 'a', 'c', 'd']);
  assert.match(body, /<ol class="badges" type="a">\n<li data-n="a"[^>]*>Formatting<\/li>/);
  assert.match(body, /<ol class="badges" type="a" start="3">\n<li data-n="c"[^>]*>starts at c<\/li>/);
});

test('a letter in a line of text, a letter after a line of text but a), and an escaped one are text', () => {
  const { body } = render('Plain a) text.\n\nSee:\nb) not a list\n\na\\) escaped\n\nab) two letters\n');
  assert.doesNotMatch(body, /<ol/);
  assert.match(render('See:\na) a list\n').body, /<p>See:<\/p>\n<ol class="badges" type="a">/);
});

test('in a list\'s item, any letter starts a lettered list under its line', () => {
  const { body } = render('1) Favor icons over words:\n   d) Today should be an icon\n2) Remove\n   b) Today as a chip\n');
  assert.match(body, /<li data-n="1"[^>]*>Favor icons over words:\n<ol class="badges" type="a" start="4">\n<li data-n="d"[^>]*>Today should be an icon<\/li>/);
  assert.match(body, /<ol class="badges" type="a" start="2">\n<li data-n="b"[^>]*>Today as a chip<\/li>/);
});

test('a lettered list goes on only while its items are lettered, and a numbered one only while they\'re numbered', () => {
  const { body } = render('a) one\nb) two\n1) three\n');
  assert.match(body, /<ol class="badges" type="a">\n<li data-n="a"[^>]*>one<\/li>\n<li data-n="b"[^>]*>two<\/li>\n<\/ol>\n<ol class="badges">\n<li data-n="1"[^>]*>three<\/li>/);
});

test('a lettered list cut by an aside keeps its letters in the next row', () => {
  const { body } = render('1) one\n   a) x\n   b) y\n\n      ~ a note\n\n      more of b\n   c) z\n');
  assert.match(body, /<ol class="badges gm-cont" type="a" start="2">\n<li data-n="b" class="gm-cont" value="2">/);
  assert.match(body, /<li data-n="c"[^>]*>/);
});

test('printed, a list is indented as far as its badges reach, so none is cut off at the sheet\'s margin', () => {
  const css = readFileSync(new URL('./badges.css', import.meta.url), 'utf8');
  // The document has no padding in print, and the badge hung into it (gh-251).
  assert.match(css, /@media print \{\n {2}ol\.badges \{ padding-left: max\(var\(--gm-indent\), 2\.2em\); \}\n\}/);
});

test('a lettered item takes a box, a choice and braces as a numbered one does, as every feature reads the same list markers', () => {
  const { body } = render('1) Ideas\n   a) [ ] Smaller\n   b) [x] {red} Darker\n   c) ( ) Either\n');
  assert.match(body, /<li class="task step"[^>]*id="1\.a"><input type="checkbox" class="task-box"[^>]*data-done="false"/);
  assert.match(body, /<li class="task step step-done" style="color: var\(--gm-red\)"[^>]*id="1\.b"><input type="checkbox"[^>]*checked/);
  assert.match(body, /id="1\.c"><input type="radio"/);
  assert.doesNotMatch(body.replace(/<[^>]*>/g, ''), /\[ \]|\{red\}|\( \)/, 'nothing left as typed in the text');
});

test('under a line of text, `b)` with a box stays text, as only `a)` starts a list there', () => {
  const { body } = render('Pick one:\nb) [ ] stays text\n');
  assert.match(body, /<p>Pick one:\nb\) \[ \] stays text<\/p>/);
});

test('a choice on a badged item is picked by its badge, its radio over it unseen, and the badge shows the pick (gh-81\'s review)', () => {
  const { body } = render('1) Which?\n   a) ( ) Apple\n   b) (x) Pear\n2) ( ) One\n');
  assert.match(body, /<li class="task" data-n="a"[^>]*><input type="radio" class="choice-box"/, 'the radio straight inside the item, where the rule finds it');
  assert.match(body, /<li class="task" data-n="b"[^>]*><input type="radio" class="choice-box"[^>]* checked>/);
  const css = readFileSync(new URL('./badges.css', import.meta.url), 'utf8');
  assert.match(css, /ol\.badges > li > \.choice-box, ol\.badges > li > p > \.choice-box \{[^}]*position: absolute;[^}]*opacity: 0;[^}]*cursor: pointer;/, 'laid over the badge, unseen');
  assert.match(css, /:has\(> \.choice-box, > p > \.choice-box\):not\(\.gm-cont\)::before \{[^}]*background: var\(--gm-paper\);[^}]*color: var\(--badge\);/, 'hollow until picked');
  assert.match(css, /:has\(> \.choice-box:checked, > p > \.choice-box:checked\):not\(\.gm-cont\)::before \{[^}]*background: var\(--badge\);/, 'filled once picked');
  assert.match(css, /:has\(> \.choice-box:focus-visible, > p > \.choice-box:focus-visible\)::before \{[^}]*outline: 2px solid/, 'the keyboard\'s ring on the badge');
  assert.match(css, /@media \(forced-colors: active\) \{[\s\S]*\.choice-box:checked[\s\S]*background: Highlight;/, 'in the system\'s colours too');
});
