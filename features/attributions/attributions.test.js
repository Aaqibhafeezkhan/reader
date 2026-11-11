import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('a blockquote closing with -- gets an attribution', () => {
  const { body } = render(
    '> The road of excess\n> -- [William Blake](https://x.test)\n\n> one\n>\n> -- scripture:[Psalm 23]\n\n> a\n> -- b\n> c\n',
  );
  assert.match(body, /<p>The road of excess<\/p>\n<p class="quote-by"><a href="https:\/\/x\.test">William Blake<\/a><\/p>/);
  assert.match(body, /<p class="quote-by"><a href="https:\/\/www\.blueletterbible\.org\/rsv\/psalm\/23">Psalm 23<\/a><\/p>/);
  assert.match(body, /<p>a\n– b\nc<\/p>/);
});

test('an attribution split off a styled paragraph keeps its style; in an aside the line stays as typed', () => {
  const { body } = render('::: red georgia\n> quoted\n> -- Author\n:::\n\ntext\n\n~ > thought\n~ > -- Me\n');
  assert.match(body, /<p class="font" style="color: red; --font: 'georgia'">quoted<\/p>\n<p class="font quote-by" style="color: red; --font: 'georgia'">Author<\/p>/);
  assert.match(body, /<summary><span class="gm-mark" aria-hidden="true">~<\/span><\/summary>\n<blockquote>\n<p>-- Me<\/p>/);
});

test('with lines, a split attribution names its own line', () => {
  const { body } = render('para\n\n> The road\n> of excess\n> -- Blake\n', { lines: true });
  assert.match(body, /<p data-line="2">The road\nof excess<\/p>\n<p class="quote-by" data-line="4">Blake<\/p>/);
});

test('an aside after a quote is beside it whole, its attribution with it', () => {
  for (const src of ['> If the example is wrong.\n> -- Dana\n\n~ Ours is.\n\nafter\n', '> If the example is wrong.\n>\n> -- Dana\n\n~ Ours is.\n\nafter\n']) {
    const { body } = render(src);
    assert.match(body, /<blockquote class="quoted">\n<p>If the example is wrong.<\/p>\n<p class="quote-by">Dana<\/p>\n<\/blockquote>\n<\/div>\n<div class="gm-asides">/);
  }
});

test('a quote an aside cuts goes on as the same quote', () => {
  const { body } = render('> First.\n>\n> Second.\n~ about the second\n> -- Dana\n');
  assert.match(body, /<blockquote class="quoted">\n<p>First.<\/p>\n<\/blockquote>/);
  assert.match(body, /<blockquote class="quoted gm-cont">\n<p>Second.<\/p>\n<p class="quote-by">Dana<\/p>\n<\/blockquote>/);
});

test('an aside can name words in a quote\'s attribution', () => {
  const { body } = render('> If the example is wrong.\n> -- Dana Whitfield\n~[Dana Whitfield] who is she?\n');
  assert.match(body, /<p class="quote-by"><span class="mk mk-underline" role="mark" data-mark="mk-1">Dana Whitfield<\/span><\/p>/);
  assert.match(body, /<blockquote class="quoted">\n<p>If the example is wrong.<\/p>/);
});
