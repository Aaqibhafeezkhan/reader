import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages, isDeck } from '../src/slides.js';
import { outline } from '../static/app/sections.js';

// The daily journal 0.0.4 is to make possible, written ahead of the syntax it
// promises (see its comment). What reader can't read yet shows as written; as
// each feature lands, this should say what it now draws.
const JOURNAL = readFileSync(new URL('./fixtures/journal.md', import.meta.url), 'utf8');

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
  const out = pages(JOURNAL, { file: 'journal.md' });
  const all = out.pages.map((p) => p.body).join('\n');
  const hinted = [...all.matchAll(/<span class="field-label">([^<]*)<\/span><span class="field-value"[^>]* data-hint="([^"]*)"/g)]
    .map(([, label, hint]) => [label, hint]);
  assert.equal(hinted.length, 13);
  assert.deepEqual(hinted.slice(0, 2), [['What did you do?', 'Only for C'], ['1', 'I\'m grateful for…']]);
  assert.ok(hinted.some(([label, hint]) => label === 'The Way of Kings' && hint === 'What would you tell someone to make them pick it up?'));
  assert.doesNotMatch(all, /class="field-label">[^<]*\{/, 'no label shows its braces');
});
