import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';
import { preview, settle } from './dom.js';

// A choice whose words are a blank still to write in, in each place a
// choice is written: a list, a field and an answer. Picking it with the
// mouse or Space gives its blank the keyboard; the arrow keys go through
// it to the next, as they go through a group's choices (gh-81's review).
const WRITTEN = {
  'a list': '- ( ) Yes\n- ( ) [@ Other]\n- ( ) No\n',
  'a field': '@ Pick: ( ) Yes ( ) [@ Other] ( ) No\n',
  'an answer': 'Q: Which?\nA: ( ) Yes ( ) [@ Other] ( ) No\n',
};

async function page(markdown) {
  const p = preview();
  p.show(render(markdown).body);
  await settle();
  const radios = [...p.document.querySelectorAll('input[type=radio]')];
  const key = (node, k) => {
    node.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  };
  const up = (node, k) => node.dispatchEvent(new p.window.KeyboardEvent('keyup', { key: k, bubbles: true }));
  // An arrow key on a radio, as a browser does it: the key goes down, the
  // next radio is picked, with its click and its change, then the key comes up.
  const arrow = (from, to) => {
    from.focus();
    key(from, 'ArrowDown');
    to.focus();
    to.checked = true;
    to.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
    to.dispatchEvent(new p.window.Event('change', { bubbles: true }));
    up(to, 'ArrowDown');
  };
  // Space on a radio: the key, then, if it wasn't picked, its click and
  // change; on one already picked, Chromium and WebKit send no click.
  const space = (box) => {
    key(box, ' ');
    up(box, ' ');
    if (box.checked) return;
    box.checked = true;
    box.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
    box.dispatchEvent(new p.window.Event('change', { bubbles: true }));
  };
  const blankHas = () => p.document.activeElement?.closest?.('[data-unwritten], .field-value') != null;
  return { ...p, radios, arrow, space, blankHas };
}

for (const [where, markdown] of Object.entries(WRITTEN)) {
  test(`in ${where}, the arrow keys go through a choice with a blank, which stays shut until Space opens it`, async () => {
    const p = await page(markdown);
    const [yes, other, no] = p.radios;
    p.arrow(yes, other);
    assert.equal(p.document.activeElement, other, 'the keyboard stays on the choice an arrow picked');
    assert.equal(other.closest('[data-answered]')?.dataset.answered, 'false', 'picked, but not yet an answer');
    p.arrow(other, no);
    assert.equal(p.document.activeElement, no, 'and goes on to the next');
    p.arrow(no, other);
    p.space(other);
    assert.ok(p.blankHas(), 'Space on the choice opens its blank');
  });

  test(`in ${where}, a click on a choice with a blank opens its blank, picked already or not`, async () => {
    const p = await page(markdown);
    const [yes, other] = p.radios;
    p.arrow(yes, other);
    assert.ok(!p.blankHas());
    other.dispatchEvent(new p.window.PointerEvent('pointerdown', { bubbles: true }));
    other.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
    assert.ok(p.blankHas(), 'a click on it, already picked by an arrow');
  });
}
