import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { preview } from '../../test/dom.js';

const DOC = `---
title: Folding
reviewer #: Josh
---

# [ ] Open to start

A paragraph.
~# An aside about it.

## A part of it

More.

# [x] Done already

What was done.
~# An aside in the folded part.

## Deep inside

Found by the outline.

# Last

The end.
`;

/** The preview frame showing `markdown` as the app draws it, its blocks' lines on them. */
function page(markdown = DOC, m = {}) {
  const p = preview();
  const show = () => p.show(render(markdown, { lines: true }).body, m);
  show();
  const $ = (sel) => p.document.querySelector(sel);
  const heading = (words) => [...p.document.querySelectorAll('h1, h2')].find((h) => h.textContent.includes(words));
  const click = (node) => node.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  // What shows: hidden by fold, or in a row or an asides column that is.
  const seen = () => [...p.document.querySelectorAll('.gm-speaker > *, .gm-aside-cell')]
    .filter((el) => !el.closest('.fold-hidden'))
    .map((el) => el.textContent.trim().replace(/\s+/g, ' '));
  return { ...p, show, $, heading, click, seen };
}

test('a heading written ticked is marked to open folded, read from its line as written', () => {
  const heads = render(DOC, { lines: true }).body.match(/<h[12][^>]*>/g).slice(1);
  assert.deepEqual(heads.map((h) => /data-fold="closed"/.test(h)), [false, false, true, false, false]);
  assert.match(render('### [X] Shut\n').body, /<h3[^>]* data-fold="closed"/);
  assert.doesNotMatch(render('# Plain\n\n# [ ] Open\n').body, /data-fold/);
});

test('a ticked heading\'s section is folded away across rows, asides and subsections with it, up to the next heading of its level', () => {
  const p = page();
  assert.deepEqual(p.seen(), ['Open to start', 'A paragraph.', 'JoshAn aside about it.', 'A part of it', 'More.', 'Done already', 'Last', 'The end.']);
  const toggle = p.heading('Done already').querySelector(':scope > .fold-toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-label'), 'Fold: Done already');
  assert.equal(p.heading('Open to start').querySelector(':scope > .fold-toggle').getAttribute('aria-expanded'), 'true');
});

test('a click on a heading\'s words or its button folds and opens it, but not one on its Done button', () => {
  const p = page();
  p.click(p.heading('Done already').querySelector('.section-title'));
  assert.ok(p.seen().includes('Found by the outline.'), 'opened by its words');
  p.click(p.heading('Done already').querySelector(':scope > .fold-toggle'));
  assert.ok(!p.seen().includes('What was done.'), 'folded by its button');
  p.click(p.heading('A part of it'));
  assert.ok(!p.seen().includes('More.'));
  assert.ok(p.seen().includes('A paragraph.'), 'only its own section, not its parent\'s');

  const done = p.heading('Open to start').querySelector('.section-done');
  p.click(done);
  assert.ok(p.seen().includes('A paragraph.'), 'the Done button is its own');
});

test('what\'s been folded or opened is kept over a render, as typing makes one, and written nowhere', () => {
  const p = page();
  p.click(p.heading('Done already'));
  p.click(p.heading('Last'));
  p.show();
  assert.ok(p.seen().includes('What was done.'));
  assert.ok(!p.seen().includes('The end.'));
  assert.equal(p.posted.filter((m) => m.type === 'edit').length, 0);
});

test('going to a line in a folded section, from the outline or Go to, or to a link\'s target, opens the sections around it', () => {
  const p = page();
  p.send({ type: 'open-to', line: 21 });
  assert.ok(p.seen().includes('Found by the outline.'));
  assert.ok(p.seen().includes('What was done.'), 'the section around it opens too');

  const q = page();
  q.click(q.heading('A part of it'));
  q.send({ type: 'open-to', line: 25 });
  assert.ok(!q.seen().includes('More.'), 'a line that shows already opens nothing');
  q.send({ type: 'open-to', line: 12 });
  assert.ok(q.seen().includes('More.'));

  q.click(q.heading('A part of it'));
  const more = [...q.document.querySelectorAll('p')].find((el) => el.textContent === 'More.');
  q.window.dispatchEvent(new q.window.CustomEvent('preview:open-to', { detail: { target: more } }));
  assert.ok(q.seen().includes('More.'), 'by a link to it');
});

test('on a slide, nothing folds', () => {
  const p = preview();
  p.show(slides('# [x] Done\n\nShown.\n\n---\n\n# Next\n').slides[0].body, { deck: true });
  assert.equal(p.document.querySelector('.fold-toggle'), null);
  assert.equal(p.document.querySelector('.fold-hidden'), null);
});
