import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../../src/render.js';

const speaker = (src, opts) => /<div class="gm-speaker">\n([\s\S]*?)<\/div>\n<div(?: class="gm-asides")?>/.exec(render(src, opts).body)[1];

const BOOK = '::: row\n![](cover.jpg =56x)\n\n**[The Way of Kings](https://example.com/book)** · Brandon Sanderson\n\nprogress:[326/1007] pages\n:::\n';

test('its first block is set beside the rest, stacked', () => {
  assert.equal(speaker('::: row\none\n\ntwo\n\n* three\n:::\n\nafter\n'), [
    '<div class="row">',
    '<div class="row-lead">\n<p>one</p>\n</div>',
    '<div class="row-rest">\n<p>two</p>\n<ul>\n<li>three</li>\n</ul>\n</div>',
    '</div>',
    '<p>after</p>\n',
  ].join('\n'));
});

test('a cover beside its title and how far it is read: the image is just the image, not a figure', () => {
  const html = speaker(BOOK);
  assert.match(html, /^<div class="row">\n<div class="row-lead"><img src="cover.jpg" alt="" style="width: 56px"><\/div>\n<div class="row-rest">\n/);
  assert.match(html, /<p><strong><a href="https:\/\/example.com\/book">The Way of Kings<\/a><\/strong> · Brandon Sanderson<\/p>/);
  assert.match(html, /<p><span class="progress"><progress value="326" max="1007" aria-label="pages"><\/progress>/);
  assert.doesNotMatch(html, /<figure|\*\*/);
});

test('an image with alt text keeps it as its name, with no caption; a linked one too', () => {
  assert.match(speaker('::: row\n![The cover](cover.jpg)\n\ntext\n:::\n'), /<div class="row-lead"><img src="cover.jpg" alt="The cover"><\/div>/);
  assert.match(speaker('::: row\n[![The cover](cover.jpg)](book.html)\n\ntext\n:::\n'), /<div class="row-lead"><a href="book.html"><img src="cover.jpg" alt="The cover"><\/a><\/div>/);
  // Out of a row, or not first in it, an image alone is still a figure.
  assert.match(speaker('::: row\ntext\n\n![The cover](cover.jpg)\n:::\n'), /<figure><img src="cover.jpg" alt="The cover"><figcaption>The cover<\/figcaption><\/figure>/);
});

test('with +++ lines, what is before the first is the first block, and the rest is beside it', () => {
  assert.equal(speaker('::: row\n![](me.jpg)\n\n*me*\n+++\n### Bio\nwords\n+++\nmore\n:::\n'), [
    '<div class="row">',
    '<div class="row-lead">\n<figure><img src="me.jpg" alt=""></figure>\n<p><em>me</em></p>\n</div>',
    '<div class="row-rest">\n<h3>Bio</h3>\n<p>words</p>\n<p>more</p>\n</div>',
    '</div>\n',
  ].join('\n'));
});

test('reverse puts the first block on the right, and is not a style; other names are', () => {
  const html = speaker('::: row reverse georgia\none\n\ntwo\n:::\n');
  assert.match(html, /^<div class="row row-reverse">\n<div class="row-lead">\n<p class="font" style="--font: 'georgia'">one<\/p>/);
  assert.doesNotMatch(html, /reverse'/);
  // Anywhere else, it's a font's name, as any word is.
  assert.match(speaker('::: reverse\none\n:::\n'), /--font: 'reverse'/);
});

test('one block alone is the first, with nothing beside it', () => {
  assert.equal(speaker('::: row\n![](cover.jpg)\n:::\n'), '<div class="row">\n<div class="row-lead"><img src="cover.jpg" alt=""></div>\n</div>\n');
});

test('it takes the line it opens on, and each side the line it starts on', () => {
  assert.match(speaker('text\n::: row\na\n\nb\n:::\n', { lines: true }), /<p data-line="0">text<\/p>\n<div class="row" data-line="1">\n<div class="row-lead" data-line="2">\n<p data-line="2">a<\/p>\n<\/div>\n<div class="row-rest" data-line="4">/);
});

test('an aside in or after it sits beside all of it, and never cuts it', () => {
  for (const src of ['before\n\n::: row\na\n\nb\n~ in it\n\nc\n:::\n', 'before\n\n::: row\na\n\nb\n\nc\n:::\n~ after it\n']) {
    const { body } = render(src);
    assert.equal(body.match(/class="row"/g).length, 1, src);
    assert.match(body, /<div class="gm-speaker">\n<div class="row">[\s\S]*c<\/p>\n<\/div>\n<\/div>\n<\/div>\n<div class="gm-asides">/, src);
  }
});

test('rows nest in columns, and columns in a row', () => {
  assert.match(speaker('::: columns\n::: row\n![](a.jpg)\n\nA\n:::\n\n::: row\n![](b.jpg)\n\nB\n:::\n:::\n'),
    /<div class="column">\n<div class="row">\n<div class="row-lead"><img src="a.jpg" alt=""><\/div>[\s\S]*<div class="column">\n<div class="row">\n<div class="row-lead"><img src="b.jpg" alt=""><\/div>/);
  assert.match(speaker('::: row\n![](a.jpg)\n\n::: columns\nx\n\ny\n:::\n:::\n'), /<div class="row-rest">\n<div class="columns">\n<div class="column">\n<p>x<\/p>/);
});

test('its stylesheet lets the rest go under when it has no room, and a bar beside it take the width left', () => {
  const { css } = render(BOOK);
  assert.match(css, /\.row \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.row-rest \{ flex: 1 1 10em/);
  assert.match(css, /\.row-rest > p > \.progress:first-child progress \{ flex: 1/);
  // reversed, once the rest goes under, the first block keeps to the start edge
  assert.match(css, /\.row-reverse \{ flex-direction: row-reverse; justify-content: flex-end; \}/);
});

test('a bar beside the words may shrink, so the words stay inside the row at phone width in Firefox too', () => {
  const css = readFileSync(new URL('./row.css', import.meta.url), 'utf8');
  // Firefox kept the bar as wide as its own, and "326 of 1007 pages" ran past the card (gh-250).
  assert.match(css, /^\.row-rest > p > \.progress:first-child \{ flex: 1; min-width: 0; \}$/m);
  assert.match(css, /^\.row-rest > p > \.progress:first-child progress \{[^}]*min-width: 3em;/m, 'the bar itself keeps a little width');
});
