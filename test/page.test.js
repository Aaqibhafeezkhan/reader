/**
 * What every page has taken off before the features read it (src/page.js):
 * its front matter and its comments, with each line left traced back to
 * the file.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { extract, keysOf, page } from '../src/page.js';
import { render } from '../src/render.js';

// --- front matter ---------------------------------------------------------

test('reads ----- front matter', () => {
  const { meta, source } = extract('-----\nTitle: A Talk\nAuthor: jz\nTags: spec\n-----\n\nbody\n');
  assert.equal(meta.title, 'A Talk');
  assert.equal(meta.author, 'jz');
  assert.equal(meta.tags, 'spec');
  assert.equal(source.trim(), 'body');
});

test('reads --- front matter too', () => {
  const { meta } = extract('---\nTitle: B\n---\n\nbody\n');
  assert.equal(meta.title, 'B');
});

test('a leading rule that is not front matter is left alone', () => {
  const { meta, own, source } = extract('---\n\nbody\n');
  assert.deepEqual(meta, {});
  assert.equal(own, false);
  assert.deepEqual(meta.entry('title'), []);
  assert.match(source, /^---/);
});

test('a key a feature declares is read by entry(), not one of the meta\'s (gh-283)', () => {
  const { meta } = extract('---\nTitle: B\nreviewer #: Josh\ntopic c: Coherence\nopen-until: 2026-11-20\n---\n\nbody\n');
  assert.deepEqual(meta, { title: 'B' });
  assert.deepEqual(meta.entry('reviewer', 'topic').map((e) => e.value), ['Josh', 'Coherence']);
  assert.deepEqual(meta.entry('open-until').map((e) => e.value), ['2026-11-20']);
  assert.deepEqual(keysOf(), ['open-until', 'reviewer', 'topic']);
});

test('a part with no front matter of its own keeps its file\'s, and one with its own reads that (gh-283)', () => {
  const md = new MarkdownIt().use(page);
  const deck = extract('---\nreviewer #: Josh\n---\n').meta;
  const env = { frontMatter: deck };
  md.parse('body\n', env);
  assert.equal(env.frontMatter, deck);
  md.parse('---\nreviewer m: Maria\n---\n\nbody\n', env);
  assert.deepEqual(env.frontMatter.entry('reviewer').map((e) => e.value), ['Maria']);
});

// --- comments -------------------------------------------------------------

test('an HTML comment is dropped, asides and all', () => {
  const src = '-----\nreviewer D: Drew\n-----\n\n<!--\nHow to review:\n\n~D like this\n-->\n\nbody\n';
  const { source } = extract(src);
  assert.doesNotMatch(source, /review|<!--|-->/);
  assert.match(source, /body/);
  assert.equal(render(src).notes, 0);
  assert.equal(extract('<!-- one line -->\nbody\n').source, 'body\n');
});

test('a comment in fenced code is code, and is kept', () => {
  assert.match(extract('```\n<!-- kept -->\n```\n').source, /kept/);
});

// --- tracing lines --------------------------------------------------------

test('each line left is traced back to the file', () => {
  assert.deepEqual(extract('---\nTitle: B\n---\n\na\n<!-- x -->\nb\n').lines, [4, 6, 7]);
});

test('a block is marked with its line of the file, past front matter, comments and asides', () => {
  const { body } = render('---\nTitle: B\n---\n\n<!--\nnote\n-->\none\n\n~ aside\n\ntwo\n', { lines: true });
  assert.match(body, /<p data-line="7">one<\/p>/);
  assert.match(body, /<p data-line="11">two<\/p>/);
});
