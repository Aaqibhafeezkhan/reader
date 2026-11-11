/**
 * The asides feature, from gutter-md's own tests: telling an aside from
 * what isn't one, leaving the document's shape alone, and where
 * each aside goes, back inline or into the columns.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { asides } from './index.js';
import { page } from '../../src/page.js';
import { preprocess } from './preprocess.js';
import { splitPairs } from '../rows.js';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

/** A document parsed for columns: its front matter, asides, and the rows they cut it into. */
function parse(src) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false }).use(page).use(asides);
  const env = {};
  const tokens = md.parse(src, env);
  const found = env.asides || [];
  return { meta: env.frontMatter || {}, asides: found, pairs: splitPairs(tokens, found), md, env, tokens };
}

const speakerText = (pair, md, env) =>
  md.renderer.render(pair.speaker, md.options, env).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// --- recognising asides ---------------------------------------------------

test('lifts asides out of the source', () => {
  const { source, asides } = preprocess('a line\n\n~ a thought\n\nanother line\n');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].text, 'a thought');
  assert.doesNotMatch(source, /thought/);
});

test('a bare ~ is an aside; ~~strike~~ and ~~~ fences are not', () => {
  assert.equal(preprocess('~\n').asides.length, 1);
  assert.equal(preprocess('~~struck~~\n').asides.length, 0);
  assert.equal(preprocess('~~~\ncode\n~~~\n').asides.length, 0);
});

test('tildes inside fenced code are left in the code', () => {
  const src = 'text\n\n```js\n~ not an aside\n```\n';
  const { asides, source } = preprocess(src);
  assert.equal(asides.length, 0);
  assert.match(source, /~ not an aside/);
});

test('a wrapped line continues the same thought', () => {
  const { asides } = preprocess('a\n\n~ first line\n  second line\n\nb\n');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].text, 'first line\nsecond line');
});

test('consecutive ~ lines are separate thoughts sharing an anchor', () => {
  const { asides } = preprocess('a\n\n~ one\n~ two\n\nb\n');
  assert.equal(asides.length, 2);
  assert.deepEqual(asides.map((a) => a.text), ['one', 'two']);
  assert.equal(asides[0].anchor, asides[1].anchor);
});

test('an aside does not swallow the block that follows it', () => {
  const { asides, source } = preprocess('a\n\n~ thought\n* a bullet\n');
  assert.equal(asides.length, 1);
  assert.equal(asides[0].text, 'thought');
  assert.match(source, /^\* a bullet$/m);
});

test("an aside doesn't swallow reader's own block lines", () => {
  for (const next of ['+++', '+++ Kotlin', ':::', '::: tabs', '@ Name: answer', '!SLAB (Venkat): layers']) {
    const { asides, source } = preprocess(`a\n\n~ thought\n${next}\n`);
    assert.equal(asides[0].text, 'thought', next);
    assert.match(source, new RegExp(`^${next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), next);
  }
});

test("an aside after a blank doesn't swallow the closing of the layout it's in", () => {
  const { body } = render('::: tabs\n+++ A\nx\n+++ B\nPara.\n\n~ thought\n:::\n\nafter\n');
  assert.match(body, /<\/div>\n<\/div>\n<\/div>\n<div class="gm-asides">[\s\S]*thought[\s\S]*<p>after<\/p>/);
});

test('an aside under a line of text leaves its paragraph whole', () => {
  const { asides, source } = preprocess('One sentence.\n~ about it\nAnother sentence.\n');
  assert.equal(asides[0].text, 'about it');
  assert.equal(source, 'One sentence.\nAnother sentence.\n');
});

test('an aside under a paragraph, then a blank, keeps the paragraphs apart', () => {
  const { source } = preprocess('One paragraph.\n~ about it\n\nAnother paragraph.\n');
  assert.equal(source, 'One paragraph.\n\nAnother paragraph.\n');
  assert.equal(speakerShape('One paragraph.\n~ about it\n\nAnother paragraph.\n'), speakerShape('One paragraph.\n\nAnother paragraph.\n'));
});

test('an aside under a line can still wrap, indented', () => {
  const { asides } = preprocess('a line\n~ first\n  second\nmore of the paragraph\n');
  assert.equal(asides[0].text, 'first\nsecond');
});

// --- structural transparency: the whole point -----------------------------

/** The parsed shape of the speaker's document, before any column splitting. */
function speakerShape(src) {
  return parse(src).tokens.map((t) => t.type).join(' ');
}

test('an aside at column 0 does not break the list it sits inside', () => {
  // Plain markdown would end the bullet here and orphan the sub-list.
  const withAside = '* a point\n\n~ my thought\n\n   1. sub one\n   2. sub two\n';
  const { pairs, md, env } = parse(withAside);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  // the sub-list is still inside a list item, not a sibling of the bullet list
  assert.match(html, /<li[^>]*>[\s\S]*<ol[\s\S]*sub one/);
  assert.deepEqual(renderedNumbering(withAside), [1, 2]);
});

test('removing every aside yields the same structure as never writing one', () => {
  const withAside = '* a point\n  1. sub one\n\n    ~ thought\n\n  2. sub two\n';
  const without = '* a point\n  1. sub one\n  2. sub two\n';
  assert.equal(speakerShape(withAside), speakerShape(without));
});

// --- anchoring ------------------------------------------------------------

test('an aside aligns with the line it was written after', () => {
  const src = '1. alpha\n2. bravo\n\n   ~ about bravo\n\n3. charlie\n';
  const { pairs, md, env } = parse(src);
  const withAside = pairs.find((p) => p.notes.length);
  assert.equal(withAside.notes[0].text, 'about bravo');
  assert.match(speakerText(withAside, md, env), /^bravo/);
});

/** The numbers a reader would actually see, in order, across every chunk. */
function renderedNumbering(src) {
  const { pairs, md, env } = parse(src);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  const seen = [];
  for (const list of html.split(/<ol/).slice(1)) {
    let n = Number(/^[^>]*\bstart="(\d+)"/.exec(list)?.[1] ?? 1);
    for (const item of list.split('</ol>')[0].split(/<li/).slice(1)) {
      const v = /^[^>]*\bvalue="(\d+)"/.exec(item);
      if (v) n = Number(v[1]);
      seen.push(n++);
    }
  }
  return seen;
}

test('list numbering is unbroken across a cut', () => {
  assert.deepEqual(
    renderedNumbering('1. alpha\n2. bravo\n\n   ~ note\n\n3. charlie\n4. delta\n'),
    [1, 2, 3, 4]
  );
});

test('numbering is unbroken when the aside falls mid-list twice', () => {
  const src = '1. a\n\n   ~ one\n\n2. b\n3. c\n\n   ~ two\n\n4. d\n5. e\n';
  assert.deepEqual(renderedNumbering(src), [1, 2, 3, 4, 5]);
});

test('no item is duplicated or dropped across a cut', () => {
  const src = '1. alpha\n2. bravo\n\n   ~ note\n\n3. charlie\n';
  const { pairs, md, env } = parse(src);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  for (const word of ['alpha', 'bravo', 'charlie']) {
    assert.equal((html.match(new RegExp(word, 'g')) || []).length, 1, word);
  }
});

test('cutting mid-item resumes that item without a second marker', () => {
  const src = '* a bullet with\n\n  more prose\n\n  ~ note\n\n  and a tail\n';
  const { pairs, md, env } = parse(src);
  const html = pairs.map((p) => md.renderer.render(p.speaker, md.options, env)).join('');
  assert.match(html, /gm-cont/);
  assert.match(html, /and a tail/);
});

test('what the speaker said next starts below the aside, not beside it', () => {
  const src = '1. alpha\n2. bravo\n\n   ~ a long thought about bravo\n\n3. charlie\n';
  const { pairs, md, env } = parse(src);
  const row = pairs.find((p) => p.notes.length);
  // The commented item owns its row; charlie is not carried along beside it.
  assert.match(speakerText(row, md, env), /^bravo$/);
});

test('the item after a commented one starts a fresh row either way', () => {
  // Uncommented items may share a row -- nothing separates them. What must not
  // vary is where the item *following* a commented one begins: it always opens
  // a new row under the aside, whether or not it carries a comment of its own.
  const check = (src) => {
    const { pairs, md, env } = parse(src);
    const i = pairs.findIndex((p) => p.notes.some((a) => a.text === 'note'));
    assert.match(speakerText(pairs[i], md, env), /^b$/);
    assert.match(speakerText(pairs[i + 1], md, env), /^c/);
  };
  check('1. a\n2. b\n\n   ~ note\n\n3. c\n\n4. d\n');
  check('1. a\n2. b\n\n   ~ note\n\n3. c\n\n   ~ another\n\n4. d\n');
});

test('several asides on one line share a cell', () => {
  const { pairs } = parse('a point\n\n~ one\n~ two\n');
  const cell = pairs.find((p) => p.notes.length);
  assert.equal(cell.notes.length, 2);
});

test('an aside before any content does not crash', () => {
  const { pairs } = parse('~ thought first\n\nthen speech\n');
  assert.ok(pairs.some((p) => p.notes.length));
});

test('a document with no asides is a single pair', () => {
  const { pairs } = parse('just speech\n\nmore speech\n');
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].notes.length, 0);
});


// --- threads: replies, and resolving them (gh-199) -------------------------

const KEYED = '---\nreviewer #: Josh\nreviewer c: Claude\ntopic d: Design\n---\n\n';
const cells = (body) => [...body.matchAll(/<div class="gm-aside-cell[\s\S]*?<\/div>\n(?=<\/div>|<div class="gm-aside-cell)/g)].map((m) => m[0]);

test('a ~~ line under an aside is a reply in its thread, flat, each with who wrote it, wrapping as an aside does', () => {
  const { asides } = parse(`${KEYED}A line.\n~# Does it?\n~~c Yes, and\n  it wraps.\n~~# Then steps only.\n~~ And mine.\n`);
  assert.equal(asides.length, 1, 'one thread, keeping the first aside\'s place');
  assert.deepEqual(asides[0].replies.map((r) => [r.by?.who?.name ?? null, r.text, r.line]),
    [['Claude', 'Yes, and\nit wraps.', 8], ['Josh', 'Then steps only.', 10], [null, 'And mine.', 11]]);
  const [cell] = cells(render(`${KEYED}A line.\n~# Does it?\n~~c Yes.\n`).body);
  assert.match(cell, /<p><span class="gm-by"><span class="gm-who">Josh<\/span><\/span>Does it\?<\/p>\n<div class="gm-reply gm-attributed" style="--by: var\(--gm-key-2\)">\n<p><span class="gm-by"><span class="gm-who">Claude<\/span><\/span>Yes\.<\/p>/);
});

test('~~ is a reply only straight under an aside, and only before a space or an alias run: strikethrough is untouched', () => {
  const { source, asides } = preprocess('Text.\n~~ not a reply\n\n~~struck~~ and on\n\n~ an aside\n~~struck~~ too\n', new Map());
  assert.equal(asides.length, 1);
  assert.equal(asides[0].replies, undefined);
  assert.match(source, /^~~ not a reply$/m);
  assert.match(source, /^~~struck~~ and on$/m);
  assert.equal(asides[0].text, 'an aside\n~~struck~~ too', 'struck text under an aside wraps it, as before');
});

test('a reply counts towards its reviewer in the legend, and a resolved thread\'s are counted apart', () => {
  const { body } = render(`${KEYED}One.\n~#d [ ] Open?\n~~c Yes.\n\nTwo.\n~# [x] Settled?\n~~c Yes.\n~~# Good.\n`);
  const legend = /<div class="gm-legend">([\s\S]*?)<\/div>/.exec(body)[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  assert.equal(legend, 'Josh 3 (2 resolved)Claude 2 (1 resolved)Design 1');
});

test('a box after the aliases makes a thread that can be resolved, writing its own line ticked or not', () => {
  const { asides } = parse(`${KEYED}A line.\n  ~#d [ ] Does it?\n`);
  assert.deepEqual(asides[0].box, { checked: false, on: '  ~#d [x] Does it?', off: '  ~#d [ ] Does it?' });
  assert.equal(asides[0].text, 'Does it?');
  assert.equal(preprocess('~ [X] done\n').asides[0].box.checked, true, 'an aside of the writer\'s own can be resolved too');
  assert.equal(preprocess('~ [later] not a box\n').asides[0].box, undefined);

  const [open] = cells(render(`${KEYED}A line.\n~# [ ] Does it?\n`).body);
  assert.match(open, /<input type="checkbox" class="gm-resolve" data-line="7" data-on="~# \[x\] Does it\?" data-off="~# \[ \] Does it\?" aria-label="Resolved">Does it\?/);
  assert.doesNotMatch(open, /<details/);
});

test('a resolved thread folds to who opened it and "resolved", the whole thread inside, and it opens without a change to the file', () => {
  const [cell] = cells(render(`${KEYED}A line.\n~# [x] Settled?\n~~c Yes.\n`).body);
  assert.match(cell, /^<div class="gm-aside-cell gm-attributed gm-resolvable gm-is-resolved"/);
  assert.match(cell, /<details class="gm-thread">\n<summary><span class="gm-by"><span class="gm-who">Josh<\/span><\/span><span class="gm-resolved">resolved<\/span><\/summary>\n<p>[\s\S]*checked>Settled\?<\/p>\n<div class="gm-reply[\s\S]*Yes\.[\s\S]*<\/details>/);
});

test('a thread\'s box is shut where the page can\'t be worked, as on a slide', () => {
  const { body } = slides(`${KEYED}A line.\n~# [ ] Does it?\n\n---\n\n# Next\n`).slides[0];
  assert.match(body, /<input type="checkbox" class="gm-resolve"[^>]* disabled>/);
});
