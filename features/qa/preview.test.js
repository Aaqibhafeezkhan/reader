import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { preview, settle, assertNotElement } from '../../test/dom.js';

const LINE = 'A: ( ) Yes ( ) [@ Something else]';
const MD = `## Proposals\nreset:[]\n\nQ (Claude): Put the page bar fix in 0.0.4?\n${LINE}\n`;

/** `md` in the preview frame: `sent()` is what each turn wrote, as [before, after], `fill` types into the blank and clicks away. */
function page(md = MD, draw = render(md).body, m = {}) {
  const p = preview();
  p.show(draw, m);
  const sent = async () => {
    await settle();
    return p.posted.splice(0).filter((x) => x.type === 'edit').map((x) => x.edits.map((e) => [e.before[0], e.after[0]]));
  };
  const boxes = () => [...p.document.querySelectorAll('.qa-choice input')];
  const fill = (value) => {
    p.document.querySelector('.qa-choices .field-inline').click();
    const input = p.document.querySelector('.qa-choices textarea');
    input.value = value;
    input.blur();
    return sent();
  };
  return { ...p, sent, boxes, fill, row: () => p.document.querySelector('.qa-choices') };
}

test('an answer\'s choice, clicked, writes its line with it picked and the rest not', async () => {
  const p = page();
  p.boxes()[0].click();
  assert.deepEqual(await p.sent(), [[[LINE, 'A: (x) Yes ( ) [@ Something else]']]]);
  assert.equal(p.row().dataset.answered, 'true');
  p.boxes()[1].click();
  assert.deepEqual(await p.sent(), [[['A: (x) Yes ( ) [@ Something else]', 'A: ( ) Yes (x) [@ Something else]']]]);
});

test('a blank that\'s one of an answer\'s choices, filled in, picks it, in one edit of its line', async () => {
  const p = page();
  assert.deepEqual(await p.fill('a later release'), [[[LINE, 'A: ( ) Yes (x) [@ Something else: a later release]']]]);
  assert.deepEqual(p.boxes().map((b) => b.checked), [false, true]);
});

test('filled in after another choice was picked, a blank picks its own and lets the other go, in one edit', async () => {
  const p = page();
  p.boxes()[0].click();
  await p.sent();
  assert.deepEqual(await p.fill('later'), [[['A: (x) Yes ( ) [@ Something else]', 'A: ( ) Yes (x) [@ Something else: later]']]]);
  // And picked away from, what's in it stays.
  p.boxes()[0].click();
  assert.deepEqual(await p.sent(), [[['A: ( ) Yes (x) [@ Something else: later]', 'A: (x) Yes ( ) [@ Something else: later]']]]);
});

test('Start over lets go of an answer\'s choice and empties its blank, as one edit of its line', async () => {
  const p = page(MD.replace(LINE, 'A: ( ) Yes (x) [@ Something else: later]'));
  p.document.querySelector('.task-reset').click();
  assert.deepEqual(await p.sent(), [[['A: ( ) Yes (x) [@ Something else: later]', LINE]]]);
  assert.deepEqual(p.boxes().map((b) => b.checked), [false, false]);
  assert.equal(p.row().dataset.answered, 'false');
  p.document.querySelector('.task-reset').click();
  assert.deepEqual(await p.sent(), [], 'nothing left to clear');
});

test('where the page can\'t be worked, an answer\'s choices show what\'s picked and can\'t be changed', async () => {
  const md = 'A: ( ) Yes (x) No\n';
  const p = page(md, slides(`${md}\n---\n\nNext\n`).slides[0].body, { deck: true });
  for (const box of p.boxes()) {
    box.focus();
    assertNotElement(p.document.activeElement, box, 'the keyboard doesn\'t reach it');
    box.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    box.click();
  }
  p.document.querySelector('.qa-choice').click();
  assert.deepEqual(await p.sent(), []);
  assert.deepEqual(p.boxes().map((b) => b.checked), [false, true]);
});

test('once the page stops being workable, nothing answered picks an answer\'s choice, and its buttons are shut', async () => {
  const p = page();
  p.window.Preview.workable = false;
  p.window.dispatchEvent(new p.window.Event('preview:workable'));
  p.document.querySelector('.qa-choices .field').dispatchEvent(new p.window.Event('preview:answered', { bubbles: true }));
  assert.deepEqual(await p.sent(), []);
  assert.deepEqual(p.boxes().map((b) => b.disabled), [true, true]);
});

test('a nested answer\'s choices pick and start over on its own line, indented as written', async () => {
  const line = '  A: ( ) Now ( ) [@ Something else]';
  const p = page(`## Proposals\nreset:[]\n\nQ: Top?\nA: Split it.\n  Q: Part A?\n${line}\n`);
  assert.deepEqual(await p.fill('an issue'), [[[line, '  A: ( ) Now (x) [@ Something else: an issue]']]]);
  p.document.querySelector('.task-reset').click();
  assert.deepEqual(await p.sent(), [[['  A: ( ) Now (x) [@ Something else: an issue]', line]]]);
  assert.equal(p.row().dataset.answered, 'false');
});
