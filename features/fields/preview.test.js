import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides, pages } from '../../src/slides.js';
import { applyEdits } from '../../static/edits.js';
import { frame, run, preview, settle, assertElement, assertNotElement } from '../../test/dom.js';

/**
 * The fields of `markdown` as rendered, in a page with preview.js loaded:
 * `await fill(i, value)` types `value` into the i-th and clicks away, and
 * `edits` is what it asked to be written by the end of that turn.
 */
function page(markdown) {
  const { window, document, posted } = frame(render(markdown).body);
  run(window, 'static/preview-api.js', 'features/fields/preview.js');
  const fields = [...document.querySelectorAll('.field')];
  // What it asked to be written, as it went up to the page around it.
  const edits = [];
  const heard = () => edits.splice(0, Infinity, ...posted.filter((m) => m.type === 'edit').flatMap((m) => m.edits));

  const open = (i) => {
    fields[i].click();
    return fields[i].querySelector('.field-value textarea');
  };
  const fill = async (i, value) => {
    const input = open(i);
    input.value = value;
    input.blur();
    await settle();
    heard();
  };
  const press = async (input, key) => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await settle();
    heard();
  };
  return { fields, edits, open, fill, press };
}

const lines = (edits) => edits.map((e) => e.after[0]);

test('a field on a line of its own is written with its value after its colons', async () => {
  const { edits, fill } = page('@ Name: Josh\n\n@ Notes ::: it went\n');
  await fill(0, 'Ann');
  await fill(1, 'it went well');
  assert.deepEqual(edits, [
    { from: 0, to: 1, before: ['@ Name: Josh'], after: ['@ Name: Ann'] },
    { from: 2, to: 3, before: ['@ Notes ::: it went'], after: ['@ Notes ::: it went well'] },
  ]);
});

test('a field emptied is written as only its label and colons', async () => {
  const { edits, fill } = page('@ Name: Josh\n');
  await fill(0, '');
  assert.deepEqual(lines(edits), ['@ Name:']);
});

test('a field filled is written again from what it was last written as', async () => {
  const { edits, fill } = page('@ Name: Josh\n');
  await fill(0, 'Ann');
  await fill(0, 'Bea');
  assert.deepEqual(edits.map((e) => [e.before[0], e.after[0]]), [['@ Name: Josh', '@ Name: Ann'], ['@ Name: Ann', '@ Name: Bea']]);
});

test('what\'s typed is written on one line, and nothing is written when it\'s the same', async () => {
  const { edits, fill } = page('@ Name: Josh\n');
  await fill(0, '  Josh  ');
  assert.deepEqual(edits, []);
  await fill(0, ' two\n  lines ');
  assert.deepEqual(lines(edits), ['@ Name: two lines']);
});

test('Esc puts a field back as it was, and writes nothing', async () => {
  const { fields, edits, open, press } = page('@ Name: Josh\n');
  const input = open(0);
  input.value = 'Ann';
  await press(input, 'Escape');
  assert.deepEqual(edits, []);
  assert.equal(fields[0].querySelector('.field-value').textContent, 'Josh');
});

test('a hinted blank keeps its hint while it\'s typed in, and writes it back with its label', async () => {
  const { edits, open, fill } = page('@ Hours {e.g. 7.5}:\n@ Name: Josh\n');
  assert.equal(open(0).placeholder, 'e.g. 7.5');
  assert.equal(open(1).placeholder, '');
  await fill(0, '8');
  assert.deepEqual(lines(edits), ['@ Hours {e.g. 7.5}: 8']);
});

test('a field in a sentence is written into its place, and the ones after it move along', async () => {
  const { fields, edits, fill } = page('I am [@ name: Josh] and [@ age:] years, from [@ city: x].\n');
  await fill(0, 'Joshua');
  await fill(2, 'Provo');
  await fill(1, '40');
  await fill(0, '');
  assert.deepEqual(lines(edits), [
    'I am [@ name: Joshua] and [@ age:] years, from [@ city: x].',
    'I am [@ name: Joshua] and [@ age:] years, from [@ city: Provo].',
    'I am [@ name: Joshua] and [@ age: 40] years, from [@ city: Provo].',
    'I am [@ name] and [@ age: 40] years, from [@ city: Provo].',
  ]);
  // Each knows where it is on the line as now written.
  const now = edits.at(-1).after[0];
  for (const f of fields) {
    assert.equal(f.dataset.text, now);
    assert.match(now.slice(Number(f.dataset.start), Number(f.dataset.end)), /^\[@ \w+(: [^\]]+)?\]$/);
  }
});

test('in a sentence, brackets typed go round, so as not to end the field', async () => {
  const { edits, fill } = page('Say [@ what: x] now.\n');
  await fill(0, 'a [b] c');
  assert.deepEqual(lines(edits), ['Say [@ what: a (b) c] now.']);
});

test('the keyboard reaching a blank opens it, and Enter writes it and leaves the keyboard there to open it again', async () => {
  const { fields, edits, press } = page('@ Name: Josh\n\n!REPL:\n');
  const slot = fields[0].querySelector('.field-value');
  slot.focus();
  let input = slot.querySelector('textarea');
  assert.equal(input.getAttribute('aria-label'), 'Name');
  input.value = 'Ann';
  await press(input, 'Enter');
  assert.deepEqual(lines(edits), ['@ Name: Ann']);
  assertElement(slot.ownerDocument.activeElement, slot);
  assert.equal(slot.querySelector('textarea'), null);
  await press(slot, 'Enter');
  input = slot.querySelector('textarea');
  assertElement(slot.ownerDocument.activeElement, input);
  // A term not yet defined is a blank named by the term.
  await press(input, 'Escape');
  const blank = fields[1].querySelector('.field-value');
  blank.focus();
  assert.equal(blank.querySelector('textarea').getAttribute('aria-label'), 'REPL');
});

test('a blank written keeps the keyboard through the render that follows', () => {
  const p = preview();
  p.show(render('@ Name: Josh\n').body);
  p.document.querySelector('.field-value').focus();
  const input = p.document.querySelector('.field-value textarea');
  input.value = 'Ann';
  input.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  p.show(render('@ Name: Ann\n').body);
  const slot = p.document.querySelector('.field-value');
  assert.equal(slot.textContent, 'Ann');
  assertElement(p.document.activeElement, slot);
  assert.equal(slot.querySelector('textarea'), null);
});

test('a field\'s choice picks, writing its line; on a slide, none does, by a click or a key', async () => {
  const md = '# One\n\n@ Session: ( ) Sat AM (x) Sat PM\n';
  const p = preview();
  p.show(render(md).body);
  const picks = () => [...p.document.querySelectorAll('.field-choice > input')];
  picks()[0].click();
  await settle();
  assert.deepEqual(p.posted.filter((m) => m.type === 'edit').flatMap((m) => m.edits.map((e) => e.after[0])), ['@ Session: (x) Sat AM ( ) Sat PM']);
  p.show(slides(`${md}\n---\n\n# Next\n`).slides[0].body, { deck: true });
  p.posted.length = 0;
  for (const pick of picks()) {
    pick.focus();
    assertNotElement(p.document.activeElement, pick, 'the keyboard doesn\'t reach it');
    pick.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    pick.click();
    pick.closest('label').click();
  }
  await settle();
  assert.deepEqual(p.posted.filter((m) => m.type === 'edit'), []);
  assert.deepEqual(picks().map((x) => x.checked), [false, true]);
});

test('a number field takes only a number, and writes it back as number:', async () => {
  const { fields, edits, open, fill } = page('@ Age {e.g. 12}: number:[]\n@ Score: number:12[a dozen]\n');
  const input = open(0);
  assert.equal(input.inputMode, 'decimal');
  for (const typed of ['1', '12', '12a', '12.']) {
    input.value = typed;
    input.dispatchEvent(new input.ownerDocument.defaultView.Event('input'));
  }
  assert.equal(input.value, '12.');
  input.blur();
  await settle();
  await fill(1, '');
  assert.deepEqual(edits.map((e) => [e.before[0], e.after[0]]), [
    ['@ Age {e.g. 12}: number:[]', '@ Age {e.g. 12}: number:12[]'],
    ['@ Score: number:12[a dozen]', '@ Score: number:[]'],
  ]);
  assert.equal(fields[0].querySelector('.field-value').textContent, '12');
});

test('a number field opens on its number, not what is shown for it, and what is not one is put back', async () => {
  const { edits, open, fill } = page('@ Score: number:12[a dozen]\n');
  assert.equal(open(0).value, '12');
  open(0).blur();
  await settle();
  await fill(0, '-');
  assert.deepEqual(edits, []);
});

test('a date field picks a day into its place on the line, and Tab goes past it', async () => {
  const p = preview();
  p.show(render('@ Name: Josh\n@ When {a Friday}: date:[]\n@ Age: number:[]\n').body);
  const date = p.document.querySelector('.field[data-kind="date"] .date');
  let answered = null;
  p.document.addEventListener('preview:answered', (e) => { answered = e.target; });
  date.click();
  p.document.querySelector('.date-cal-grid button[data-date$="-10"]').click();
  await settle();
  assert.equal(answered, date, 'a day picked says it answered what it is in');
  const [edit] = p.posted.filter((m) => m.type === 'edit').flatMap((m) => m.edits);
  assert.equal(edit.before[0], '@ When {a Friday}: date:[]');
  assert.match(edit.after[0], /^@ When \{a Friday\}: date:\d{4}-\d{2}-10\[\]$/);
});

test('Tab in a blank writes it and leaves the browser to go on, to a link, a date or the next blank, as it would', async () => {
  const p = preview();
  p.show(render('@ Name: Josh\n\nRead [the book](https://example.com/book) first.\n\n@ When: date:[]\n@ Age: number:[]\n').body);
  const name = p.document.querySelector('.field .field-value');
  for (const shiftKey of [false, true]) {
    name.click();
    const input = p.document.querySelector('.field textarea');
    input.value = shiftKey ? 'Ada' : 'Josh Long';
    const tab = new p.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    input.dispatchEvent(tab);
    await settle();
    assert.equal(tab.defaultPrevented, false, 'the browser moves the keyboard on');
    assertElement(p.document.activeElement, name, 'from the blank, its value written');
    assert.equal(p.document.querySelector('textarea'), null, 'and no other blank opened past what\'s between');
  }
  const written = p.posted.filter((m) => m.type === 'edit').flatMap((m) => m.edits.map((e) => e.after[0]));
  assert.deepEqual(written, ['@ Name: Josh Long', '@ Name: Ada']);
  // The browser's Tab lands on the next blank, which opens.
  p.document.querySelector('.field[data-kind="number"] .field-value').focus();
  assert.ok(p.document.querySelector('.field[data-kind="number"] textarea'));
});

/**
 * The preview showing `markdown`: `press()` presses its first Start over,
 * and is what went up by the end of that turn, as `{ edits, undo, text }`
 * for each ask, `text` being the file with its edits made, as the server
 * would. A file with edits it would refuse has no text.
 */
function startOver(markdown, draw = render(markdown).body) {
  const p = preview();
  p.show(draw);
  const sent = () => p.posted.splice(0).filter((m) => m.type === 'edit');
  const made = (edits) => {
    const c = applyEdits(markdown, edits);
    return c && markdown.slice(0, c.start) + c.text + markdown.slice(c.end);
  };
  const press = async () => {
    sent();
    p.document.querySelector('.task-reset').click();
    await settle();
    return sent().map((m) => ({ edits: m.edits, undo: m.undo, text: made(m.edits) }));
  };
  return { ...p, press, sent, made };
}

test('Start over empties the fields of its section with its boxes, as one edit to undo, and no other section\'s', async () => {
  const md = [
    '## Morning', '', '@ Grateful for: the sun', '@ When: date:2026-11-03[]', '- [x] Walk', '- (x) Rested', '', 'reset:[]', '',
    '## Evening', '', '@ Thoughts: a good day',
  ].join('\n');
  const [one, ...rest] = await startOver(md).press();
  assert.deepEqual(rest, [], 'one edit');
  assert.equal(one.undo, true);
  assert.equal(one.text, [
    '## Morning', '', '@ Grateful for:', '@ When: date:[]', '- [ ] Walk', '- ( ) Rested', '', 'reset:[]', '',
    '## Evening', '', '@ Thoughts: a good day',
  ].join('\n'));
});

test('Start over empties a field wherever it is in the section: in tabs, columns, a callout or a list item', async () => {
  const md = [
    '## Morning', 'reset:[]', '',
    '::: tabs', '+++ One', '@ In a tab: a', '+++ Two', '@ In the other: b', ':::', '',
    '::: columns', '@ Left: c', '+++', '@ Right: d', ':::', '',
    '> [!NOTE]', '> Written [@ a word: e] here', '',
    '- Item', '  @ Under it: f',
  ].join('\n');
  const [{ text }] = await startOver(md).press();
  assert.equal(text, [
    '## Morning', 'reset:[]', '',
    '::: tabs', '+++ One', '@ In a tab:', '+++ Two', '@ In the other:', ':::', '',
    '::: columns', '@ Left:', '+++', '@ Right:', ':::', '',
    '> [!NOTE]', '> Written [@ a word] here', '',
    '- Item', '  @ Under it:',
  ].join('\n'));
});

test('Start over empties every blank on a line, and its box, in one edit of it', async () => {
  const md = '## Morning\nreset:[]\n\n- [x] Walk to [@ where: the river] and [@ then: home] [@ empty]\n- (x) Other: [@ what: this]\n- ( ) No\n';
  const [{ edits, text }] = await startOver(md).press();
  assert.equal(edits.length, 2);
  assert.equal(text, '## Morning\nreset:[]\n\n- [ ] Walk to [@ where] and [@ then] [@ empty]\n- ( ) Other: [@ what]\n- ( ) No\n');
});

test('Start over keeps a field the kind it is: its colons, hint and head, a date, a number, its choices', async () => {
  const md = [
    '## Morning', 'reset:[]', '',
    '@ Notes ::: it went well',
    '@ Hours {e.g. 7.5}: 8',
    '@ When {a Friday}: date:2026-11-03[the day]',
    '@ Age: number:12[twelve]',
    '@ Session: ( ) Sat (x) Sun',
    '@ Stays blank: date:[]',
    '@ And this: number:[]',
    '@ And these: ( ) Sat ( ) Sun',
    '@ And me:',
  ].join('\n');
  const p = startOver(md);
  const [{ edits, text }] = await p.press();
  assert.equal(edits.length, 5, 'nothing to write of what\'s empty');
  assert.equal(text, [
    '## Morning', 'reset:[]', '',
    '@ Notes :::',
    '@ Hours {e.g. 7.5}:',
    '@ When {a Friday}: date:[]',
    '@ Age: number:[]',
    '@ Session: ( ) Sat ( ) Sun',
    '@ Stays blank: date:[]',
    '@ And this: number:[]',
    '@ And these: ( ) Sat ( ) Sun',
    '@ And me:',
  ].join('\n'));
  // Until the next render, the page is what the file says.
  const session = p.document.querySelector('.field[data-choices]');
  assert.equal(session.dataset.answered, 'false');
  assert.deepEqual([...session.querySelectorAll('input')].map((i) => i.checked), [false, false]);
  assert.equal(p.document.querySelector('.field-value').textContent, '');
  assert.deepEqual(await p.press(), [], 'nothing left to clear, nothing to write');
});

test('Start over leaves a date in a sentence, a log\'s heading and a definition: they aren\'t answers', async () => {
  const md = '## Akara\nreset:[]\n\nDue date:2026-11-10[] or date:2026-11-12[the party].\n\n!Term: a meaning\n\n### Log\n#### date:2026-10-01[]\n@ Note: good\n';
  const [{ text }] = await startOver(md).press();
  assert.equal(text, md.replace('@ Note: good', '@ Note:'));
});

test('under no heading, Start over is for the whole page', async () => {
  const md = '@ Before: a\n\nreset:[]\n\n@ After: b\n\n## Later\n\n@ Under: c\n';
  const [{ text }] = await startOver(md).press();
  assert.equal(text, '@ Before:\n\nreset:[]\n\n@ After:\n\n## Later\n\n@ Under:\n');
});

test('on a workbook\'s page, Start over is for that page, by its lines in the file', async () => {
  const md = '---\ntype: workbook\n---\n\n@ One: a\n\n---\n\n@ Two: b\n\nreset:[]\n';
  const page = pages(md).pages[1];
  const [{ text }] = await startOver(md, page.body).press();
  assert.equal(text, md.replace('@ Two: b', '@ Two:'));
});

test('Start over clears what was written since the page was drawn, made on what was written', async () => {
  const md = '## Morning\nreset:[]\n\n- [ ] Walk to [@ where]\n';
  const p = startOver(md);
  const blank = p.document.querySelector('.field');
  blank.click();
  const input = blank.querySelector('textarea');
  input.value = 'the river';
  input.blur();
  await settle();
  const typed = p.sent().flatMap((m) => m.edits);
  assert.deepEqual(typed.map((e) => e.after[0]), ['- [ ] Walk to [@ where: the river]']);
  const box = p.document.querySelector('.task-box');
  box.click();
  await settle();
  const ticked = p.sent().flatMap((m) => m.edits);
  assert.deepEqual(ticked.map((e) => e.after[0]), ['- [x] Walk to [@ where: the river]']);
  const [{ edits }, ...rest] = await p.press();
  assert.deepEqual(rest, []);
  assert.deepEqual(edits, [{ from: 3, to: 4, before: ['- [x] Walk to [@ where: the river]'], after: ['- [ ] Walk to [@ where]'] }]);
});

test('Start over lets go of what\'s being typed in a field it empties, and not in one it doesn\'t', async () => {
  const md = '## Morning\nreset:[]\n\n@ Name: Josh\n\n## Evening\n@ Other: x\n';
  const p = startOver(md);
  const [name, other] = p.document.querySelectorAll('.field');
  name.click();
  name.querySelector('textarea').value = 'half typed';
  assert.deepEqual((await p.press()).map((x) => x.text), [md.replace('@ Name: Josh', '@ Name:')]);
  assert.equal(name.querySelector('textarea'), null);
  other.click();
  await p.press();
  assert.ok(other.querySelector('textarea'), 'still open');
});

test('Preview.startOver clears the lines it\'s given, with no click, and returns the edits, sending nothing', async () => {
  const md = '# One\n\n@ A: a\n- [x] b\n\n---\n\n# Two\n\n@ C: c\nI [@ d: e] it.\n';
  const p = startOver(md);
  const { Preview } = p.window;
  p.sent();
  assert.deepEqual(JSON.parse(JSON.stringify(Preview.startOver({ from: 2, to: 3 }))), [{ from: 2, to: 3, before: ['@ A: a'], after: ['@ A:'] }]);
  const edits = Preview.startOver();
  await settle();
  assert.deepEqual(p.sent(), [], 'nothing sent, nothing to save');
  assert.equal(p.made(edits), '# One\n\n@ A: a\n- [ ] b\n\n---\n\n# Two\n\n@ C:\nI [@ d] it.\n');
});

test('Preview.startOver works on a page that can\'t be worked', () => {
  const md = '@ A: a\n@ When: date:2026-11-03[]\n- [x] b\n';
  const p = startOver(md);
  p.window.Preview.workable = false;
  assert.equal(p.made(p.window.Preview.startOver()), '@ A:\n@ When: date:[]\n- [ ] b\n');
});

test('on a slide there\'s no Start over, and its fields are left', async () => {
  const md = '## One\nreset:[]\n\n@ A: a\n\n---\n\n# Next\n';
  const p = preview();
  p.show(slides(md).slides[0].body, { deck: true });
  assert.equal(p.document.querySelector('.task-reset'), null);
});

test('asked by the app, the frame starts the page over and says the edits, on a page past its time too', async () => {
  const md = '---\nopen-until: 2020-01-01\n---\n\n@ A: a\n- [x][x] b\n- [x] c\n';
  const p = preview();
  p.show(render(md, { lines: true, now: 0 }).body);
  p.posted.length = 0;
  p.send({ type: 'start-over' });
  const [told] = p.posted.filter((m) => m.type === 'started-over');
  assert.equal(p.window.Preview.closed, true);
  assert.equal(told.failed, null);
  const c = applyEdits(md, told.edits);
  assert.equal(md.slice(0, c.start) + c.text + md.slice(c.end), '---\nopen-until: 2020-01-01\n---\n\n@ A:\n- [ ][ ] b\n- [ ] c\n');
  assert.deepEqual(p.posted.filter((m) => m.type === 'edit'), [], 'nothing goes up as an edit of the page');
});

test('a feature that fails starting over is said, not passed off as cleared', () => {
  const p = preview();
  p.show(render('@ A: a\n', { lines: true }).body);
  p.document.addEventListener('preview:start-over', () => { throw new Error('no such luck'); });
  p.posted.length = 0;
  p.send({ type: 'start-over' });
  assert.match(p.posted.find((m) => m.type === 'started-over').failed ?? '', /no such luck/);
});

test('someone else\'s message starts nothing over', () => {
  const p = preview();
  p.show(render('@ A: a\n', { lines: true }).body);
  p.posted.length = 0;
  p.send({ type: 'start-over' }, { origin: 'http://elsewhere.example' });
  assert.deepEqual(p.posted, []);
});
