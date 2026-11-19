import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pages, slides } from '../src/slides.js';
import { app, globals, settle } from './dom.js';

// done.js, pages.js and deck.js are the app's, for the browser: loaded here on the app's page.
globals(app());
const { mark, tally } = await import('../static/app/done.js');
const { el, state } = await import('../static/app/state.js');
const { setPages } = await import('../static/app/pages.js');
const { loadDeck } = await import('../static/app/deck.js');

const DECK = [
  '# [x] Warm-up\n\n- [ ] not needed, the heading says',
  '# Chores\n\n- [x] trash\n- [ ] dishes',
  '# Chores, done\n\n- [x] trash\n- [x][x] onion',
  '# Quiz\n\n- ( ) red\n- (x) blue\n\n@ Day: ( ) Sat (x) Sun',
  '# Unpicked\n\n- ( ) red\n- ( ) blue',
  '# Nothing to do\n\nJust words.',
].join('\n\n---\n\n');

const drawn = (src, opts) => pages(src, { file: 'a.md', ...opts }).pages;

test("a page's name is its first heading as it's heard, an image in it by its alt", () => {
  const [page] = drawn('# Why ![Rust](rust.png) wins\n\nWords.');
  assert.equal(mark(page.body, 0).title, 'Why Rust wins');
  assert.equal(mark('<p>No heading</p>', 2).title, 'Page 3');
});

test('a page is read without its inline styles, which the app\'s policy refuses, each an error in the console (gh-272)', () => {
  const [page] = drawn('# One\n\n@ Thoughts:::\n\n~ a note\n\n[Words]{blue} and `style="kept"` in code');
  assert.match(page.body, / style="/, 'the page has inline styles');
  const { DOMParser } = globalThis;
  const was = DOMParser.prototype.parseFromString;
  const read = [];
  DOMParser.prototype.parseFromString = function parse(html, type) { read.push(html); return was.call(this, html, type); };
  try {
    assert.equal(mark(page.body, 0).title, 'One');
  } finally {
    DOMParser.prototype.parseFromString = was;
  }
  assert.doesNotMatch(read[0], /<[^>]*\sstyle="/, 'no tag keeps its style');
  assert.match(read[0], /style=&quot;kept&quot;|style="kept"/, 'the words are as written');
});

test('a slide is read without its inline styles too, and handed to the stage with them back (gh-272)', async () => {
  const { steps } = await import('../static/app/deck.js');
  const { readPage, writePage, unstyled } = await import('../static/app/html.js');
  const [page] = drawn('# One\n\n@ Thoughts:::\n\n[Words]{blue} and `style="kept"` in code\n\n- one\n- two');
  const { DOMParser } = globalThis;
  const was = DOMParser.prototype.parseFromString;
  const read = [];
  DOMParser.prototype.parseFromString = function parse(html, type) { read.push(html); return was.call(this, html, type); };
  let out;
  try {
    out = steps(page.body);
  } finally {
    DOMParser.prototype.parseFromString = was;
  }
  assert.ok(read.length, 'it was read');
  for (const html of read) assert.doesNotMatch(html, /<[^>]*\sstyle="/, 'no tag keeps its style as it\'s read');
  const styles = (html) => [...html.matchAll(/<[^>]*\sstyle="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(styles(out.body), styles(page.body), 'the stage gets each style back');
  assert.ok(styles(page.body).length >= 2, 'a field and braces have styles');
  assert.doesNotMatch(out.body, /data-style/);
  assert.match(out.body, /style=&quot;kept&quot;|style="kept"/, 'words that say style are as written');
  assert.ok(out.steps > 0, 'and its steps still counted');
  // A tag whose attribute has a `>` in its value, as innerHTML writes it, keeps its style.
  assert.equal(writePage(readPage('<p title="a > b" style="color: red">x</p>')), '<p title="a > b" style="color: red">x</p>');
  assert.equal(unstyled('<p title="a > b" style="c">x</p>'), '<p title="a > b" data-style="c">x</p>');
});

test('a page is done by what\'s tagged on it: its heading\'s box, or every box ticked and every question answered', () => {
  const marks = drawn(DECK).map((p, i) => mark(p.body, i));
  assert.deepEqual(marks.map((m) => m.done), [true, false, true, true, false, null]);
  assert.deepEqual(marks.map((m) => m.title), ['Warm-up', 'Chores', 'Chores, done', 'Quiz', 'Unpicked', 'Nothing to do']);
  assert.deepEqual(tally(marks), { done: 3, of: 5 }, 'a page with nothing to do counts neither way');
});

test('a page is done when its first heading\'s section is, by its own box or by everything in it; a section under its heading counts as one', () => {
  const SECTIONS = [
    '# [ ] Today\n\n- (x) Navy Day\n- ( ) Heritage\n\n## [ ] Ways\n\n- [x] Read\n- [x] Watch',
    '# [ ] Today\n\n- ( ) Navy Day\n\n## [ ] Ways\n\n- [x] Read',
    '# Plain\n\n## [x] Ways\n\n- [ ] Read, though the section says it\'s done\n\n## More\n\n- [x] Watch',
    '# Plain\n\n## [ ] Ways\n\n- [ ] Read',
    // A section after a done one is a part of its own, and so is a task beside a heading's.
    '# Plain\n\n## [x] Ticked\n\n## [ ] Ways\n\n- [ ] Read',
  ].join('\n\n---\n\n');
  const marks = drawn(SECTIONS).map((p, i) => mark(p.body, i));
  assert.deepEqual(marks.map((m) => m.done), [true, false, true, false, false]);
  assert.deepEqual(marks.map((m) => m.title), ['Today', 'Today', 'Plain', 'Plain', 'Plain'], 'a Done button is no part of the title');
});

test('a slide counts alike, though nothing on it can be ticked', () => {
  const marks = slides(DECK, { file: 'a.md' }).slides.map((s, i) => mark(s.body, i));
  assert.deepEqual(marks.map((m) => m.done), [true, false, true, true, false, null]);
});

test('Work draws a bar of how many pages are done beside the dots, and says which page is showing', () => {
  setPages(drawn(DECK), 'a.md');
  assert.equal(el.pageDone.hidden, false);
  const bar = el.pageDone.querySelector('progress');
  assert.equal(bar.getAttribute('value'), '3');
  assert.equal(bar.getAttribute('max'), '5');
  assert.equal(bar.getAttribute('aria-label'), 'Pages done');
  assert.equal(el.pageDone.querySelector('.progress-count').textContent, '3 of 5 done');
  assert.equal(el.pageCount.textContent, 'Page 1 of 6');
  // Drawn again from the file as a box is ticked, and the bar with it.
  setPages(drawn(DECK.replace('- [ ] dishes', '- [x] dishes')), 'a.md');
  assert.equal(el.pageDone.querySelector('.progress-count').textContent, '4 of 5 done');
  assert.equal(el.pageDots.querySelectorAll('.page-dot.done').length, 4);
});

test('a workbook with nothing to do on any page has no bar', () => {
  setPages(drawn('# One\n\n---\n\n# Two'), 'a.md');
  assert.equal(el.pageDone.hidden, true);
  assert.equal(el.pageDone.children.length, 0);
});

test('a deck being presented shows the bar beside its byline, as the file has it', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...slides(DECK, { file: 'a.md' }), meta: { author: 'Josh' } }) });
  state.current = { type: 'md', path: 'a.md' };
  assert.equal(await loadDeck(), true);
  assert.equal(el.deckBy.textContent, 'Josh');
  assert.equal(el.deckDone.hidden, false);
  assert.equal(el.deckDone.querySelector('.progress-count').textContent, '3 of 5 done');
  await settle();
});
