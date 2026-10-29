import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages, isDeck } from '../src/slides.js';
import { outline } from '../static/app/sections.js';
import { app, globals } from './dom.js';

// What Work counts done is read in the app, from the pages it's sent.
globals(app());
const { mark, tally } = await import('../static/app/done.js');

// The daily journal 0.0.4 is to make possible, written ahead of the syntax it
// promises (see its comment). What reader can't read yet shows as written; as
// each feature lands, this should say what it now draws.
const JOURNAL = readFileSync(new URL('./fixtures/journal.md', import.meta.url), 'utf8');

// It's open until 4:00 the next morning, by the clock of whoever has it:
// the evening it's filled in, and the moment it's a record.
const EVENING = new Date(2026, 9, 27, 21, 0).getTime();
const CLOSING = new Date(2026, 9, 28, 4, 0).getTime();
const drawn = (now) => pages(JOURNAL, { file: 'journal.md', now }).pages.map((p) => p.body);

test('the daily journal is a workbook of its twelve pages, in order', () => {
  const out = pages(JOURNAL, { file: 'journal.md' });
  const titles = out.pages.map((p) => p.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(titles, [
    'Today’s Celebrations', 'Daily Exercise', 'Meditation', 'Work To-Do', 'Gratitude Practice', 'Body Check-In',
    'Social Connection', 'Personal To-Do', 'Learning &amp; Reading', 'Body Scan &amp; Stretch', 'Singing Warmup', 'How are you feeling?',
  ]);
});

test('it says it\'s a workbook: worked a page at a time, its pages the outline\'s entries, not a talk\'s slides', () => {
  // And it opens in Work (type-app.test.js).
  assert.equal(isDeck(JOURNAL), true);
  const { talk, entries } = outline(JOURNAL);
  assert.equal(talk, false);
  assert.equal(entries.length, 12);
});

test('its fields say what goes in them: a hint, faint in the blank, not part of its label', () => {
  const all = drawn(EVENING).join('\n');
  const hinted = [...all.matchAll(/<span class="field-label">([^<]*)<\/span><span class="field-value"[^>]* data-hint="([^"]*)"/g)]
    .map(([, label, hint]) => [label, hint]);
  assert.equal(hinted.length, 13);
  assert.deepEqual(hinted.slice(0, 2), [['What did you do?', 'Only for C'], ['1', 'I\'m grateful for…']]);
  assert.ok(hinted.some(([label, hint]) => label === 'The Way of Kings' && hint === 'What would you tell someone to make them pick it up?'));
  assert.doesNotMatch(all, /class="field-label">[^<]*\{/, 'no label shows its braces');
});

test('its to-dos count how many are reviewed, and each book how far it\'s read', () => {
  const out = drawn(EVENING);
  const bars = (body) => [...body.matchAll(/<progress value="(\d+)" max="(\d+)" aria-label="([^"]*)"><\/progress> <span class="progress-count">([^<]*)<\/span>/g)]
    .map(([, value, max, name, count]) => [value, max, name, count]);
  // Its own box, on the heading, says the page is done, and isn't counted.
  assert.deepEqual(bars(out[3]), [['0', '10', 'reviewed', '0 of 10']]);
  assert.deepEqual(bars(out[8]), [['326', '1007', 'pages', '326 of 1007'], ['22', '314', 'pages', '22 of 314'], ['241', '436', 'pages', '241 of 436']]);
  // And as a record, the same.
  assert.deepEqual(bars(drawn(CLOSING)[3]), [['0', '10', 'reviewed', '0 of 10']]);
});

test('the evening it\'s filled in, each page says until when, and its boxes, choices and blanks can be worked', () => {
  const out = drawn(EVENING);
  for (const body of out) {
    assert.match(body, /<p class="open-until" data-until="2026-10-28 04:00"[^>]*>Editable Until 4:00 on 28 October 2026<span class="open-until-away"><\/span><\/p>/);
  }
  const all = out.join('\n');
  assert.doesNotMatch(all, /<input[^>]* disabled/);
  assert.equal(all.match(/role="textbox"/g).length, 13);
  // A minute before, still.
  assert.doesNotMatch(drawn(CLOSING - 60 * 1000).join('\n'), /No Longer Editable|disabled/);
});

test('from 4:00 the next morning it\'s a record: each page says so, every box and choice is shut, and no blank asks for more', () => {
  const out = drawn(CLOSING);
  for (const body of out) {
    assert.match(body, /<p class="open-until open-until-closed" role="note" tabindex="0" aria-label="No Longer Editable. Closed at 4:00 on 28 October 2026"[^>]*>No Longer Editable<\/p>/);
  }
  const all = out.join('\n');
  const inputs = all.match(/<input[^>]*>/g);
  assert.equal(inputs.length, 40);
  assert.ok(inputs.every((i) => / disabled/.test(i)), 'every box and choice is shut');
  assert.doesNotMatch(all, /role="textbox"|data-hint|aria-placeholder|tabindex="0" role="button"|task-reset/, 'nothing to type in, pick or press');
  assert.equal(all.match(/<span class="field-blank">blank<\/span>/g).length, 13, 'its blanks left empty are said to be blank, with no hint');
});

test('Work counts its pages done, by a heading\'s box or a choice made, and still does once it\'s a record', () => {
  const count = (src, now) => tally(pages(src, { file: 'journal.md', now }).pages.map((p, i) => mark(p.body, i)));
  // Every page has something to do, and none of it's done yet.
  assert.deepEqual(count(JOURNAL, EVENING), { done: 0, of: 12 });
  const filled = JOURNAL.replace("# [ ] Today's Celebrations", "# [x] Today's Celebrations")
    .replace('- ( ) **B** · Running', '- (x) **B** · Running');
  assert.deepEqual(count(filled, EVENING), { done: 2, of: 12 });
  assert.deepEqual(count(filled, CLOSING), { done: 2, of: 12 });
});
