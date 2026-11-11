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
  assert.deepEqual(p.dimmed(), ['JoshThen steps only.'], 'Josh\'s thread shows, for Claude\'s reply in it, its other replies dimmed');
  assert.equal(p.chip('Claude').getAttribute('aria-pressed'), 'true');
  assert.equal(p.chip('Josh').getAttribute('aria-pressed'), 'false');
  assert.equal(p.$('.gm-legend-clear').hidden, false);

  const both = page(DOC, { by: '#', about: 'd' });
  assert.deepEqual(both.dimmed(), ['ClaudeYes.', 'JoshThen steps only.', 'ClaudeAbout the rest.'], 'reviewers and topics together: both must match, so a reply about no topic is dimmed');
  assert.deepEqual(page(DOC, {}).dimmed(), [], 'with no filter, nothing is dimmed');
  assert.equal(page(DOC, {}).$('.gm-legend-clear').hidden, true);
});

test('a chip toggles its reviewer or topic in the address, any of each, and the × clears them all', async () => {
  const p = page();
  p.click(p.chip('Josh'));
  p.click(p.chip('Claude'));
  p.click(p.chip('Design'));
  assert.deepEqual(p.addresses(), [{ by: '#', about: '' }, { by: '#c', about: '' }, { by: '#c', about: 'd' }]);
  assert.deepEqual(p.dimmed(), ['ClaudeYes.', 'JoshThen steps only.', 'ClaudeAbout the rest.'], 'Josh\'s or Claude\'s, about Design: only the aside that opened the thread');
  p.click(p.chip('Josh'));
  assert.deepEqual(p.addresses(), [{ by: 'c', about: 'd' }]);
  p.click(p.$('.gm-legend-clear'));
  assert.deepEqual(p.addresses(), [{ by: '', about: '' }]);
  assert.deepEqual(p.dimmed(), []);
  await settle();
  assert.equal(p.posted.filter((m) => m.type === 'edit').length, 0, 'a view, not the file: nothing is written');
});

test('the filter is drawn again when only the address changes, as when it\'s edited by hand', () => {
  const p = page();
  p.send({ type: 'address', params: { about: 'd' } });
  assert.deepEqual(p.dimmed(), ['ClaudeYes.', 'JoshThen steps only.', 'ClaudeAbout the rest.']);
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
