import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

const speaker = (src, opts) => /<div class="gm-speaker">\n([\s\S]*?)<\/div>\n<div(?: class="gm-asides")?>/.exec(render(src, opts).body)[1];

test('each block in a columns block is a column', () => {
  assert.equal(speaker('::: columns\none\n\n* two\n* too\n\n> three\n:::\n\nafter\n'), [
    '<div class="columns">',
    '<div class="column">\n<p>one</p>\n</div>',
    '<div class="column">\n<ul>\n<li>two</li>\n<li>too</li>\n</ul>\n</div>',
    '<div class="column">\n<blockquote>\n<p>three</p>\n</blockquote>\n</div>',
    '</div>',
    '<p>after</p>\n',
  ].join('\n'));
});

test('with +++ lines, what is between two is a column', () => {
  assert.equal(speaker('::: columns\n### Before\n* slow\n+++\n### After\n\nfast\n+++\n:::\n'), [
    '<div class="columns">',
    '<div class="column">\n<h3 id="before">Before</h3>\n<ul>\n<li>slow</li>\n</ul>\n</div>',
    '<div class="column">\n<h3 id="after">After</h3>\n<p>fast</p>\n</div>',
    '</div>\n',
  ].join('\n'));
});

test('a fence is a column, and what is in it is left alone', () => {
  const html = speaker('::: columns\n```number\n15%\n```\n\n```\n+++\n:::\n```\n:::\n');
  assert.match(html, /<div class="column">\n<div class="number">[\s\S]*<\/div>\n<\/div>\n<div class="column">\n<pre><code>\+\+\+\n:::\n<\/code><\/pre>\n<\/div>\n<\/div>\n$/);
});

test('the other names on the fence are styles, and style blocks nest in it', () => {
  const html = speaker('::: columns georgia\none\n\n::: red\ntwo\n:::\n:::\n\nafter\n');
  assert.match(html, /<div class="column">\n<p class="font" style="--font: 'georgia'">one<\/p>\n<\/div>/);
  assert.match(html, /<div class="column">\n<p class="font" style="color: var\(--gm-red\); --font: 'georgia'">two<\/p>\n<\/div>\n<\/div>\n<p>after<\/p>/);
});

test('columns nest, and +++ belongs to the innermost', () => {
  const html = speaker('::: columns\nleft\n+++\n::: columns\na\n+++\nb\n:::\n:::\n');
  assert.equal(html, [
    '<div class="columns">',
    '<div class="column">\n<p>left</p>\n</div>',
    '<div class="column">\n<div class="columns">\n<div class="column">\n<p>a</p>\n</div>\n<div class="column">\n<p>b</p>\n</div>\n</div>\n</div>',
    '</div>\n',
  ].join('\n'));
});

test('+++ is only a divider in a columns block, and one never closed runs to the end', () => {
  assert.equal(speaker('a\n\n+++\n\n::: red\n+++\n:::\n'), '<p>a</p>\n<p>+++</p>\n<p style="color: var(--gm-red)">+++</p>\n');
  assert.match(speaker('::: columns\na\n\nb\n'), /<div class="columns">\n<div class="column">\n<p>a<\/p>\n<\/div>\n<div class="column">\n<p>b<\/p>\n<\/div>\n<\/div>\n$/);
});

test('it ends a paragraph, and takes the line it opens on', () => {
  assert.match(speaker('text\n::: columns\na\n:::\n', { lines: true }), /<p data-line="0">text<\/p>\n<div class="columns" data-line="1">\n<div class="column" data-line="2">/);
});

test('an aside in or after it sits beside all of it, and never cuts it', () => {
  for (const src of ['before\n\n::: columns\na\n\nb\n~ in it\n\nc\n:::\n', 'before\n\n::: columns\na\n\nb\n\nc\n:::\n~ after it\n']) {
    const { body } = render(src);
    assert.equal(body.match(/class="columns/g).length, 1, src);
    assert.match(body, /<div class="gm-speaker">\n<div class="columns">[\s\S]*c<\/p>\n<\/div>\n<\/div>\n<\/div>\n<div class="gm-asides">/, src);
  }
});

test('columns in a list item stay in it', () => {
  const html = render('- item\n\n  ::: columns red\n  left\n  +++\n  right\n  :::\n- next\n').body;
  assert.match(html, /<ul>\n<li>\n<p>item<\/p>\n<div class="columns"[^>]*>\n<div class="column">\n<p style="color: var\(--gm-red\)">left<\/p>\n<\/div>\n<div class="column">\n<p style="color: var\(--gm-red\)">right<\/p>\n<\/div>\n<\/div>\n<\/li>\n<li>\n<p>next<\/p>\n<\/li>\n<\/ul>/);
});
