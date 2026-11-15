import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../../src/render.js';

const text = (src) => {
  const { body } = render(src);
  return body.slice(body.indexOf('<div class="gm-speaker">'), body.indexOf('</section>'));
};

test('arrows, but not in code, comments or when escaped', () => {
  assert.match(text('a -> b <- c <-> d\n'), /a <span class="arrow">\u2192<\/span> b <span class="arrow">\u2190<\/span> c <span class="arrow">\u2194<\/span> d/);
  assert.match(text('`a -> b`\n'), /<code>a -&gt; b<\/code>/);
  assert.match(text('```\n->\n```\n'), /<code>-&gt;\n<\/code>/);
  assert.match(text('a <!-- x --> b\n'), /a &lt;!-- x --&gt; b/);
  assert.match(text('\\-> and \\<-\n'), /-&gt; and &lt;-/);
  assert.match(text('a => b <= c\n'), /a =&gt; b &lt;= c/);
});

test('a search keeps the arrow it was asked for; its label shows the arrow', () => {
  assert.match(text('search:[a -> b]\n'), /href="https:\/\/www\.google\.com\/search\?q=a\+-%3E\+b">a <span class="arrow">\u2192<\/span> b<\/a>/);
});

test('a link keeps its address as typed', () => {
  assert.match(text('[a -> b](https://x.test/a->b)\n'), /<a href="https:\/\/x\.test\/a-%3Eb">a <span class="arrow">\u2192<\/span> b<\/a>/);
});

test("an image's alt text shows arrows too", () => {
  assert.match(text('![a -> b](i.png)\n'), /alt="a \u2192 b"/);
});

test("an arrow is drawn in the document's accent, and in the text's colour without one", () => {
  const css = readFileSync(new URL('./arrows.css', import.meta.url), 'utf8');
  assert.match(css, /^\.arrow \{ color: var\(--gm-doc-accent, currentcolor\); \}$/m);
  // one typed as itself is an arrow too; in code it's as typed
  assert.match(text('a \u2192 b `\u2192`\n'), /a <span class="arrow">\u2192<\/span> b <code>\u2192<\/code>/);
  assert.match(render('a -> b\n').css, /\.arrow \{/);
});

test("in a colour an author gives, an arrow keeps it, not the accent", () => {
  const css = readFileSync(new URL('./arrows.css', import.meta.url), 'utf8');
  assert.match(css, /^:is\(\[style\^="color:"\], \.gm-own\) \.arrow \{ color: inherit; \}$/m);
  // which is how a colour is set, on words, a block, a heading's words and a card
  const doc = '---\naccent: seagreen\n---\n\n';
  assert.match(text(`${doc}[a -> b]{red}\n`), /<span style="color: var\(--gm-red\)">a <span class="arrow">/);
  assert.match(text(`${doc}::: red\na -> b\n:::\n`), /<p style="color: var\(--gm-red\)">a <span class="arrow">/);
  assert.match(text(`${doc}## [a -> b]{red}\n`), /<h2[^>]*><span style="color: var\(--gm-red\)">a <span class="arrow">/);
  assert.match(text(`${doc}::: cards red\n- a -> b\n:::\n`), /<li style="color: var\(--gm-red\)">a <span class="arrow">/);
});
