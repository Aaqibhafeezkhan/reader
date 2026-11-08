import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { render, makeRenderer } from '../src/render.js';
import { FEATURES, checkRequires } from '../features/index.js';

test('an image alone in a paragraph is a captioned figure', () => {
  const { body } = render('![a cat](cat.jpg "Ginger, 2019")\n\n![a dog](dog.png)\n\nsee ![x](x.png) inline\n');
  assert.match(body, /<figure><img src="cat\.jpg" alt="a cat" title="Ginger, 2019"><figcaption>Ginger, 2019<\/figcaption><\/figure>/);
  assert.match(body, /<figure><img src="dog\.png" alt="a dog"><figcaption>a dog<\/figcaption><\/figure>/);
  assert.match(body, /<p>see <img src="x\.png" alt="x"> inline<\/p>/);
});

test('tables render', () => {
  const { body } = render('| a | b |\n|---|:-:|\n| 1 | 2 |\n');
  assert.match(body, /<table>\n<thead>\n<tr>\n<th>a<\/th>\n<th style="text-align:center">b<\/th>/);
});


test('with lines, each block names the line of the file it came from', () => {
  const src = '-----\ntitle: T\n-----\n# Head\n\n~ an aside\n\npara\n\n- one\n- two\n';
  const { body } = render(src, { lines: true });
  assert.match(body, /<h1 data-line="3">Head<\/h1>/);
  assert.match(body, /<p data-line="7">para<\/p>/);
  assert.match(body, /<ul data-line="9">\n<li data-line="9">one<\/li>\n<li data-line="10">two<\/li>/);
  assert.match(body, /<div class="gm-aside-cell" role="note">\n<p><span class="gm-mark" aria-hidden="true">~<\/span>an aside<\/p>/);
  assert.doesNotMatch(render(src).body, /data-line/);
});

test('with lines, an image alone in a paragraph is still a figure, on its line', () => {
  const { body } = render('para\n\n![a cat](cat.jpg "Ginger")\n', { lines: true });
  assert.match(body, /<figure data-line="2"><img src="cat\.jpg" alt="a cat" title="Ginger"><figcaption>Ginger<\/figcaption><\/figure>/);
});

test('code fenced in a blockquote or a deep list is left as written', () => {
  const code = '[@ what: answer] rfc:9110[] ![](x.png =10x)';
  const shown = '<code>[@ what: answer] rfc:9110[] ![](x.png =10x)\n</code>';
  assert.ok(render(`> \`\`\`\n> ${code}\n> \`\`\`\n`).body.includes(shown));
  assert.ok(render(`- a\n  - b\n    - c\n\n      \`\`\`\n      ${code}\n      \`\`\`\n`).body.includes(shown));
  assert.ok(render(`1. a\n   > ~~~\n   > ${code}\n   > ~~~\n`).body.includes(shown));
});

test('code fenced in a blockquote ends with it', () => {
  const { body } = render('> ```\n> code\n\nrfc:9110[] and ![](x.png =10x)\n');
  assert.match(body, /<a href="https:\/\/www\.rfc-editor\.org\/rfc\/rfc9110\.html">RFC 9110<\/a>/);
  assert.match(body, /<img src="x\.png" alt="" style="width: 10px">/);
});

test('a document opening with a --- rule has no front matter', () => {
  const { body, title } = render('---\n\nA paragraph between rules.\n\n---\n\nmore\n', { file: 'notes.md' });
  assert.equal(title, 'notes');
  assert.match(body, /<hr>\n<p>A paragraph between rules\.<\/p>\n<hr>\n<p>more<\/p>/);
  assert.equal(render('---\ntitle: Kept\n\n---\nbody\n').title, 'Kept');
});

test("a deck's settings stay out of its masthead, and the rest of its front matter shows", () => {
  const { body } = render('---\ntitle: T\nauthor: Josh\ntime: 20m\ntransition: fade\nprint: landscape\ntype: slides\npaging: Slide %d of %d\nvenue: SpringOne\n---\n\n# One\n\n---\n\n# Two\n');
  const byline = /<div class="gm-byline">([\s\S]*?)<\/div>/.exec(body)[1];
  assert.equal(byline, '<span>Josh</span><span>venue: SpringOne</span>');
});

// --- without asides ---------------------------------------------------------

/** render(), with the asides feature left out: the core mustn't need it. */
const withoutAsides = () => makeRenderer(FEATURES.filter((f) => f.name !== 'asides'));

test("the features' list, asides left out, still has what each feature requires", () => {
  assert.doesNotThrow(() => checkRequires(FEATURES.filter((f) => f.name !== 'asides')));
});

test('without asides, a page is one column, its ~ lines are text, and each block keeps its line', () => {
  const src = [
    '---', 'title: Without', 'reviewer #: Josh', 'topic c: Coherence', '---', '',
    'First [words]{c} here.', '', '~# a thought', '',
    '::: tabs', '+++ One', 'Alpha.', '', '~ in a tab', '+++ Two', 'Beta.', ':::', '',
    '> Quoted words.', '> -- Dana', '', '~c about the quote', '',
  ].join('\n');
  const { body, notes } = withoutAsides()(src, { lines: true });
  assert.equal(notes, 0);
  assert.doesNotMatch(body, /gm-asides|gm-aside-cell|gm-legend/);
  assert.equal(body.match(/<section class="gm-pair">/g).length, 1);
  assert.match(body, /<p data-line="8">~# a thought<\/p>/);
  assert.match(body, /<p data-line="14">~ in a tab<\/p>/);
  assert.match(body, /<p data-line="22">~c about the quote<\/p>/);
  assert.match(body, /<p data-line="6">First <span class="font" style="--font: 'c'">words<\/span> here\.<\/p>/, 'with no topics, {c} is a font');
  assert.match(body, /<div class="tab-pane" data-tab="one" data-label="One" data-line="12">\n<p data-line="12">Alpha\.<\/p>/);
  assert.match(body, /<blockquote class="quoted" data-line="19">\n<p data-line="19">Quoted words\.<\/p>\n<p class="quote-by" data-line="20">Dana<\/p>/);
});

test("without asides, the stylesheet names neither an aside's cell nor its key's colours", () => {
  const { css } = withoutAsides()('Words.\n\n~ a thought\n');
  assert.doesNotMatch(css, /gm-aside-cell|--gm-key-/);
  // The margin's own class aligns any note's cell, and the preview frame sets its margin.
  assert.match(css, /\.gm-asides > \* > \*:first-child/);
  assert.match(readFileSync(new URL('../static/preview.css', import.meta.url), 'utf8'), /\.gm-asides > \* \{ margin: 0; \}/);
});

test("without asides, a page's reviewers show in its byline by name, and its topics don't", () => {
  const src = '---\ntitle: T\nauthor: Ann\nreviewer #: Josh\nreviewer m: Maria, teal\ntopic c: Coherence\nreviewer: Kim\n---\n\nWords.\n\n~#c a thought\n';
  const { body, css } = withoutAsides()(src);
  const byline = /<div class="gm-byline">([\s\S]*?)<\/div>/.exec(body)[1];
  assert.equal(byline, '<span>Ann</span><span class="gm-who">Josh</span><span class="gm-who">Maria</span><span>reviewer: Kim</span>');
  assert.doesNotMatch(body, /Coherence|<b>/);
  assert.match(css, /\.gm-byline \.gm-who \{/);
  assert.doesNotMatch(withoutAsides()('---\ntitle: T\n---\n\nWords.\n').css, /\.gm-byline \.gm-who/);
});

test('a key with a space and a character in it, not a reviewer or topic, shows in the byline, with asides on or off', () => {
  const src = '---\ntitle: T\nweek 3: Legs day\nphase a: base\n---\n\nWords.\n';
  for (const page of [render, withoutAsides()]) {
    const byline = /<div class="gm-byline">([\s\S]*?)<\/div>/.exec(page(src).body)[1];
    assert.equal(byline, '<span>week 3: Legs day</span><span>phase a: base</span>');
  }
});

test('with asides, a reviewer shows in its legend, with a count, and not in the byline', () => {
  const { body, css } = render('---\ntitle: T\nauthor: Ann\nreviewer #: Josh\n---\n\nWords.\n\n~# a thought\n');
  assert.match(body, /<div class="gm-byline"><span>Ann<\/span><\/div>/);
  assert.match(body, /<div class="gm-legend"><span class="gm-who" style="--by: var\(--gm-key-1\)">Josh <b>1<\/b><\/span><\/div>/);
  assert.doesNotMatch(css, /\.gm-byline \.gm-who/);
});

test('without asides, every page of the docs renders, in one column', () => {
  const page = withoutAsides();
  const dir = new URL('../docs/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(files.length > 10);
  for (const file of files) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    for (const options of [{ lines: true }, { exported: true }, { deck: true }]) {
      const { body } = page(src, { file, ...options });
      assert.doesNotMatch(body, /gm-asides/, file);
    }
  }
});

// --- each feature left out --------------------------------------------------

/** The features, less `name` and every feature built on it. */
function without(name) {
  const out = new Set([name]);
  for (let more = true; more;) {
    more = false;
    for (const f of FEATURES) {
      if (!out.has(f.name) && (f.requires ?? []).some((r) => out.has(r))) {
        out.add(f.name);
        more = true;
      }
    }
  }
  return FEATURES.filter((f) => !out.has(f.name));
}

test('with any one feature left out, and those built on it, every page of the docs and the journal renders, with no mark of a feature left in it', () => {
  const dir = new URL('../docs/', import.meta.url);
  const pages = [
    ...readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
    ['journal.md', readFileSync(new URL('./fixtures/journal.md', import.meta.url), 'utf8')],
  ];
  // The private-use characters features mark the text with as they read it (features/source.js).
  const MARK = /[\uE000-\uF8FF]/;
  for (const page of [render, ...FEATURES.map((f) => makeRenderer(without(f.name)))]) {
    for (const [file, src] of pages) {
      const { body } = page(src, { file, lines: true });
      assert.doesNotMatch(body, MARK, `${file}, ${page === render ? 'every feature' : 'one left out'}`);
    }
  }
});
