import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages, isDeck } from '../src/slides.js';
import { render } from '../src/render.js';
import { createContent } from '../src/content.js';
import { app, globals, preview, settle } from './dom.js';

// What Work counts done is read in the app, from the pages it's sent.
globals(app());
const { mark, tally } = await import('../static/app/done.js');

// The samples of what reader is for, in samples/, each a folder of its own,
// published with the docs and zipped to download (.github/workflows/docs.yml).
const SAMPLES = fileURLToPath(new URL('../samples/', import.meta.url));
const documents = fs.readdirSync(SAMPLES, { recursive: true })
  .filter((rel) => rel.endsWith('.md') && !rel.split(path.sep).some((part) => part.startsWith('.')))
  .sort();

// What a page shows as text, its code and what it says how to write left out.
const shown = (body) => body.replace(/<(pre|code)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '');

test('there are samples, each a folder of its own, and the README naming each one', () => {
  assert.ok(documents.includes(path.join('daily-journal', '2026-11-02.md')));
  assert.ok(documents.includes(path.join('take-notes-like-a-boss', 'tutorial.md')));
  const readme = fs.readFileSync(path.join(SAMPLES, 'README.md'), 'utf8');
  const folders = fs.readdirSync(SAMPLES, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name);
  for (const folder of folders) assert.match(readme, new RegExp(`\\]\\(${folder}/`), `the README links into ${folder}/`);
});

for (const rel of documents) {
  test(`${rel} renders with nothing of its syntax left as typed`, () => {
    const text = fs.readFileSync(path.join(SAMPLES, rel), 'utf8');
    const file = path.basename(rel);
    const bodies = isDeck(text) ? pages(text, { file }).pages.map((p) => p.body) : [render(text, { file }).body];
    const all = shown(bodies.join('\n'));
    assert.doesNotMatch(all, /\b(?:progress|timer|pitch|date|yt|reset):\[|^\s*(?::::|\+\+\+ |@ |~ |- \[[ x]\]|- \([ x]\))/m);
    assert.doesNotMatch(all, /\[!(?:NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/);
  });
}

// The daily journal: test/fixtures/journal.md, 0.0.4's acceptance test, made
// anyone's, as someone's Monday filled in and kept.
const JOURNAL_FILE = path.join('daily-journal', '2026-11-02.md');
const JOURNAL = fs.readFileSync(path.join(SAMPLES, JOURNAL_FILE), 'utf8');
const EVENING = new Date(2026, 10, 2, 21, 0).getTime();
const KEPT = new Date(2026, 10, 3, 4, 0).getTime();
const drawn = (text, now) => pages(text, { file: '2026-11-02.md', now }).pages;
const count = (text, now) => tally(drawn(text, now).map((p, i) => mark(p.body, i)));

test('the daily journal is a workbook of twelve pages, which opens in Work', () => {
  assert.equal(isDeck(JOURNAL), true);
  assert.match(JOURNAL, /^type: workbook$/m);
  const titles = drawn(JOURNAL, EVENING).map((p) => p.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(titles, [
    'Today’s Celebrations', 'Daily Exercise', 'Meditation', 'Work To-Do', 'Gratitude Practice', 'Body Check-In',
    'Social Connection', 'Personal To-Do', 'Learning &amp; Reading', 'Body Scan &amp; Stretch', 'Singing Warmup', 'How are you feeling?',
  ]);
});

test('it\'s nobody\'s own: no one\'s project, issues, board or shelf', () => {
  assert.doesNotMatch(JOURNAL, /jzheaux|gh:|trello|hardcover/i);
});

test('it\'s a day kept: filled in that evening, and from 4:00 the next morning a record of it', () => {
  assert.deepEqual(count(JOURNAL, EVENING), { done: 9, of: 12 });
  assert.doesNotMatch(drawn(JOURNAL, EVENING).map((p) => p.body).join('\n'), /<input[^>]* disabled/);
  const kept = drawn(JOURNAL, KEPT).map((p) => p.body);
  for (const body of kept) assert.match(body, /<p class="open-until open-until-closed"[^>]*>No Longer Editable<\/p>/);
  assert.deepEqual(count(JOURNAL, KEPT), { done: 9, of: 12 });
  assert.match(shown(kept[4]), /The first frost, and the light on it at seven/);
});

test('Copy for today makes today\'s from it: today\'s name and date, open until 4:00 tomorrow, and every answer cleared', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-samples-'));
  fs.cpSync(path.join(SAMPLES, 'daily-journal'), path.join(base, 'daily-journal'), { recursive: true });
  const content = createContent(base);
  const day = '2026-11-07';
  // As the app asks: drawn whole and open, and started over in a frame.
  const plan = content.copyFrom('daily-journal/2026-11-02.md', day);
  assert.equal(plan.to, `daily-journal/${day}.md`);
  const p = preview();
  p.show(render(plan.text, { file: plan.from, lines: true, now: 0 }).body);
  await settle();
  p.posted.splice(0);
  p.send({ type: 'start-over' });
  await settle();
  const { edits, failed } = p.posted.find((m) => m.type === 'started-over');
  assert.equal(failed, null);
  const made = content.copy(plan.from, { mtime: plan.mtime, edits, day });
  const text = fs.readFileSync(path.join(base, made.path), 'utf8');

  assert.match(text, /^date: 2026-11-07$/m);
  assert.match(text, /^open-until: 2026-11-08 04:00$/m);
  assert.doesNotMatch(text, /\[x\]|\(x\)/, 'no box or choice is left ticked');
  assert.doesNotMatch(text, /^@ [^:\n]*:+ \S/m, 'no field is left filled');
  assert.deepEqual(count(text, new Date(2026, 10, 7, 21, 0).getTime()), { done: 0, of: 12 });
  // What's not an answer is kept: the pages, the books, and how far each is read.
  assert.equal(drawn(text, 0).length, 12);
  assert.match(text, /progress:\[212\/432\] pages/);
});
