import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';

// The asides are out before any feature reads the lines (gh-305), and so are
// the front matter and comments: whatever a feature writes back by line must
// still find its line of the file, on the page and in an aside's own text.

const PAGE = `---
title: Lines
reviewer #: Josh
reviewer m: Maria
multibox:
  stages: one, two
---

<!-- a comment,
over two lines -->

A line.
~# An aside
~# on two lines.
~m
~m A second, with a paragraph.

- [ ] A box under asides
~# About the box.
~# - [ ] A box in an aside
~# Its [@ blank] in an aside, date:2026-11-10[].
~#
~# @ Name: in an aside
- [x] A box after them
- ( ) One
- (x) Two
- [x][ ] Staged

## [ ] A heading's box
~m [ ] A thread to resolve.
~~# A reply, with [@ its blank].

@ Field: value
~# About the field.
A line with [@ a blank] and date:2026-11-12[].

Good (Josh): A card.
~m An aside under it.
+1 (Maria): Agreed.

Bad (Maria):
~# An aside between the label and its words.
  The card's words.

Q: Which?
~# Hm.
A: ( ) This ( ) That

Q (Claude): Ready?
- ( ) Yes
- ( ) [@ Something else]
`;

/** Every element that writes a line back: its line, and what it says the line reads now, as written. */
function writers(body) {
  const out = [];
  for (const m of body.matchAll(/<[a-z]+\b[^>]*\bdata-line="(\d+)"[^>]*>/g)) {
    const tag = m[0];
    const attr = (name) => {
      const a = new RegExp(`\\bdata-${name}="([^"]*)"`).exec(tag);
      return a && a[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    };
    const now = attr('text') ?? (/\bchecked\b|aria-pressed="true"|data-done="true"/.test(tag) ? attr('on') : attr('off'));
    if (now != null) out.push({ line: Number(m[1]), now, tag });
  }
  return out;
}

test('everything that writes a line back finds its line of the file, below asides, front matter and comments, and in an aside (gh-305)', () => {
  const lines = PAGE.split('\n');
  const found = writers(render(PAGE).body);
  assert.ok(found.length >= 20, `found ${found.length}`);
  for (const { line, now, tag } of found) assert.equal(now, lines[line], tag);
  // Each kind, by what it says.
  const said = (re) => found.filter((f) => re.test(f.now)).map((f) => f.line);
  assert.deepEqual(said(/^~# - \[ \] A box in an aside$/), [lines.indexOf('~# - [ ] A box in an aside')]);
  assert.ok(said(/^~# Its \[@ blank\]/).length >= 2, 'its blank and its date');
  assert.deepEqual(said(/^~# @ Name: in an aside$/), [lines.indexOf('~# @ Name: in an aside')]);
  assert.deepEqual(said(/^~m \[ \] A thread/), [lines.indexOf('~m [ ] A thread to resolve.')]);
  assert.deepEqual(said(/^~~# A reply/), [lines.indexOf('~~# A reply, with [@ its blank].')]);
  assert.deepEqual(said(/^Bad \(Maria\):$/), [lines.indexOf('Bad (Maria):')]);
  assert.deepEqual(said(/^A: \( \) This/), [lines.indexOf('A: ( ) This ( ) That')]);
});

test('a slide\'s lines are its file\'s, through its asides', () => {
  const part = 'A slide.\n~ An aside\n~ on two lines.\n- [ ] A box\n';
  const found = writers(render(part, { line: 20 }).body);
  assert.deepEqual(found.map((f) => [f.line, f.now]), [[23, '- [ ] A box']]);
});
