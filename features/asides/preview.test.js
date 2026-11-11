import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { preview, settle } from '../../test/dom.js';

const DOC = `---
reviewer #: Josh
reviewer c: Claude
topic d: Design
---

One.
~#d [ ] Does it?
~~c Yes.
~~# Then steps only.

Two.
~c About the rest.

Three.
~ My own.
`;

/** The preview frame showing `markdown`, the address saying `address`. */
function page(markdown = DOC, address = {}) {
  const p = preview();
  p.show(render(markdown).body, { address });
  const $ = (sel) => p.document.querySelector(sel);
  const $$ = (sel) => [...p.document.querySelectorAll(sel)];
  const click = (node) => node.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const dimmed = () => $$('.gm-filtered-out').map((el) => el.textContent.trim().replace(/\s+/g, ' '));
  const chip = (name) => $$('.gm-legend button[data-filter]').find((b) => b.textContent.startsWith(name));
  const addresses = () => p.posted.splice(0).filter((m) => m.type === 'address').map((m) => m.params);
  return { ...p, $, $$, click, dimmed, chip, addresses };
}

// --- the legend's filter (gh-21) -------------------------------------------

test('the address\'s filter dims the other attributed asides, a thread showing when any voice in it does, the writer\'s own left alone', () => {
  const p = page(DOC, { by: 'c' });
  assert.deepEqual(p.dimmed(), ['JoshDesignDoes it?', 'JoshThen steps only.'], 'Josh\'s thread shows, for Claude\'s reply in it, and each of Josh\'s voices in it is dimmed, the aside that opened it too');
  assert.equal(p.chip('Claude').getAttribute('aria-pressed'), 'true');
  assert.equal(p.chip('Josh').getAttribute('aria-pressed'), 'false');
  assert.equal(p.$('.gm-legend-clear').hidden, false);

  const both = page(DOC, { by: '#', about: 'd' });
  assert.deepEqual(both.dimmed(), ['ClaudeYes.', 'ClaudeAbout the rest.'], 'reviewers and topics together: both must match, a reply naming no topic about its thread\'s');
  assert.deepEqual(page(DOC, {}).dimmed(), [], 'with no filter, nothing is dimmed');
  assert.equal(page(DOC, {}).$('.gm-legend-clear').hidden, true);
});

test('a chip toggles its reviewer or topic in the address, any of each, and the × clears them all', async () => {
  const p = page();
  p.click(p.chip('Josh'));
  p.click(p.chip('Claude'));
  p.click(p.chip('Design'));
  assert.deepEqual(p.addresses(), [{ by: '#', about: '' }, { by: '#c', about: '' }, { by: '#c', about: 'd' }]);
  assert.deepEqual(p.dimmed(), ['ClaudeAbout the rest.'], 'Josh\'s or Claude\'s, about Design: the whole Design thread, its replies about its topic');
  p.click(p.chip('Josh'));
  assert.deepEqual(p.addresses(), [{ by: 'c', about: 'd' }]);
  p.click(p.$('.gm-legend-clear'));
  assert.deepEqual(p.addresses(), [{ by: '', about: '' }]);
  assert.deepEqual(p.dimmed(), []);
  await settle();
  assert.equal(p.posted.filter((m) => m.type === 'edit').length, 0, 'a view, not the file: nothing is written');
});

test('a reply naming no topic is about its thread\'s, and one naming its own is about those alone', () => {
  const p = page(DOC.replace('~~# Then steps only.', '~~#d Then steps only.\n~~c Off it: what about drinks?').replace('topic d: Design', 'topic d: Design\ntopic k: Drinks').replace('~~c Off it:', '~~ck Off it:'), { about: 'd' });
  assert.deepEqual(p.dimmed(), ['ClaudeDrinksOff it: what about drinks?', 'ClaudeAbout the rest.']);
});

test('the filter is drawn again when only the address changes, as when it\'s edited by hand', () => {
  const p = page();
  p.send({ type: 'address', params: { about: 'd' } });
  assert.deepEqual(p.dimmed(), ['ClaudeAbout the rest.']);
  assert.equal(p.chip('Design').getAttribute('aria-pressed'), 'true');
});

test('exported, the legend is words, with nothing to click', () => {
  const { body } = render(DOC, { exported: true });
  assert.match(body, /<div class="gm-legend"><span class="gm-who" style="--by: var\(--gm-key-1\)">Josh <b>2<\/b><span class="gm-unresolved"/);
  assert.doesNotMatch(body, /gm-legend-clear|data-filter/);
});

// --- a thread's box (gh-199) -----------------------------------------------

test('a thread\'s Resolve button writes its aside\'s line ticked, and unticked again, as one edit the editor can undo, and is shut on a slide', async () => {
  const p = page();
  const button = p.$('button.gm-resolve');
  p.click(button);
  await settle();
  const [edit] = p.posted.splice(0).filter((m) => m.type === 'edit');
  assert.equal(edit.undo, true);
  assert.deepEqual(edit.edits.map((e) => [e.from, e.before.join(''), e.after.join('')]), [[7, '~#d [ ] Does it?', '~#d [x] Does it?']]);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  p.click(button);
  await settle();
  assert.deepEqual(p.posted.filter((m) => m.type === 'edit')[0].edits.map((e) => e.after.join('')), ['~#d [ ] Does it?']);

  const deck = preview();
  deck.show(slides(`${DOC}\n---\n\n# Next\n`).slides[0].body, { deck: true });
  const shut = deck.document.querySelector('button.gm-resolve');
  assert.equal(shut.disabled, true);
  deck.document.querySelector('button.gm-resolve').dispatchEvent(new deck.window.MouseEvent('click', { bubbles: true }));
  await settle();
  assert.equal(deck.posted.filter((m) => m.type === 'edit').length, 0);
});

test('every aside folds and opens, a resolved one starting folded, and what\'s folded by hand is kept over a render, written nowhere', async () => {
  const p = page();
  const threads = () => p.$$('details.gm-thread').map((d) => d.open);
  assert.deepEqual(threads(), [true, true, true], 'none resolved, all open');
  const thread = p.$$('details.gm-thread')[0];
  thread.open = false;
  thread.dispatchEvent(new p.window.Event('toggle'));
  p.show(render(DOC).body);
  assert.deepEqual(threads(), [false, true, true]);
  await settle();
  assert.equal(p.posted.filter((m) => m.type === 'edit').length, 0);
  assert.deepEqual(page(DOC.replace('~#d [ ]', '~#d [x]')).$$('details.gm-thread').map((d) => d.open), [false, true, true]);
});

test('an aside of a line and no more, with no replies, has nothing to fold: no chevron, and open', () => {
  // The test page lays nothing out, so every line fits on one.
  const p = page(DOC.replace('~ My own.', '~ [x] My own, resolved.'));
  const [thread, claude, mine] = p.$$('details.gm-thread');
  assert.equal(thread.classList.contains('gm-one-line'), false, 'a thread has its replies to fold');
  assert.equal(claude.classList.contains('gm-one-line'), true);
  assert.equal(mine.classList.contains('gm-one-line'), true);
  assert.equal(mine.open, true, 'resolved, but with nothing to fold away');
  const click = new p.window.MouseEvent('click', { bubbles: true, cancelable: true });
  claude.querySelector('summary').dispatchEvent(click);
  assert.equal(click.defaultPrevented, true, 'its line takes no click');
});
