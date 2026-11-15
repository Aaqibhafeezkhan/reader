import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { parseDate, readable } from './index.js';

test('date: reads a day, and only a real one', () => {
  assert.deepEqual(parseDate('2026-11-10'), { year: 2026, month: 11, day: 10 });
  assert.deepEqual(parseDate('2024-02-29'), { year: 2024, month: 2, day: 29 });
  assert.equal(parseDate('2026-02-29'), null);
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('2026-11-00'), null);
  assert.equal(readable('2026-11-10'), 'November 10, 2026');
  assert.equal(readable('2026-01-01'), 'January 1, 2026');
});

test('date: shows as words, and knows where it was written', () => {
  const { body } = render('# Plan\n\nDue date:2026-11-10[], after date:2026-11-03[the kickoff].\n');
  assert.match(body, /Due <time class="date" datetime="2026-11-10" data-line="2" data-col="4" data-text="Due date:2026-11-10\[\], after date:2026-11-03\[the kickoff\]\." tabindex="0" role="button" aria-haspopup="dialog">November 10, 2026<\/time>, after /);
  assert.match(body, /<time class="date" datetime="2026-11-03" data-line="2" data-col="29" [^>]*>the kickoff<\/time>\./);
});

test('date: an empty one is a blank to pick into', () => {
  const { body } = render('When: date:[] or date:[some day]\n');
  assert.match(body, /<span class="date date-blank" data-line="0" data-col="6" [^>]*>pick a date<\/span> or <span class="date date-blank" data-line="0" data-col="17" [^>]*>some day<\/span>/);
});

test('date: on a slide, where no calendar is shown, is only read, not a button', () => {
  const { body } = slides('# One\n\nDue date:2026-11-10[], or date:[]\n\n---\n\n# Two\n').slides[0];
  assert.match(body, /<time class="date" datetime="2026-11-10" data-line="\d+" data-col="4" data-text="[^"]*">November 10, 2026<\/time>/);
  assert.match(body, /<span class="date date-blank" data-line="\d+" data-col="\d+" data-text="[^"]*">pick a date<\/span>/);
  assert.doesNotMatch(body, /tabindex|role="button"|aria-haspopup/);
});

test('date: on an exported page, with no calendar to show, is only read, not a button', () => {
  const { body } = render('Due date:2026-11-10[]\n', { for: 'export' });
  assert.match(body, /<time class="date" datetime="2026-11-10"[^>]*>November 10, 2026<\/time>/);
  assert.doesNotMatch(body, /tabindex|role="button"|aria-haspopup/);
});

test('date: what is not a date, is escaped, or is in code stays as typed', () => {
  const { body } = render('date:2026-02-30[] update:2026-11-10[] \\date:2026-11-10[] `date:2026-11-10[]`\n\n```\ndate:2026-11-10[]\n```\n\n    date:2026-11-10[]\n');
  assert.doesNotMatch(body, /class="date"/);
  assert.doesNotMatch(body, /[\uE000-\uF8FF]/);
  assert.match(body, /date:2026-02-30\[\] update:2026-11-10\[\] \\date:2026-11-10\[\] <code>date:2026-11-10\[\]<\/code>/);
  assert.equal(body.match(/date:2026-11-10\[\]/g).length, 5);
});

test('date: a date in code leaves the one beside it placed', () => {
  const { body } = render('`date:2026-01-01[]` then date:2026-11-10[]\n');
  assert.match(body, /<code>date:2026-01-01\[\]<\/code> then <time class="date" datetime="2026-11-10" data-line="0" data-col="25" [^>]*>November 10, 2026<\/time>/);
});

test('date: keeps its place on a line another feature reads first', () => {
  const src = '- [ ] ship by date:2026-11-10[]\n\n::: red\nby date:2026-12-01[]\n:::\n';
  const { body } = render(src);
  assert.match(body, /data-on="- \[x\] ship by date:2026-11-10\[\]"/);
  assert.match(body, /<time class="date" datetime="2026-11-10" data-line="0" data-col="14" data-text="- \[ \] ship by date:2026-11-10\[\]"/);
  assert.match(body, /<time class="date" datetime="2026-12-01" data-line="3" data-col="3" data-text="by date:2026-12-01\[\]"/);
});

test('date: in an aside, in a table and from a later line of the file', () => {
  const { body } = render('text\n\n~ back on date:2026-11-10[]\n\n| a | b |\n| --- | --- |\n| x | date:2026-11-11[] |\n', { line: 5 });
  assert.match(body, /gm-aside-cell[\s\S]*<time class="date" datetime="2026-11-10" data-line="7" data-col="10" data-text="~ back on date:2026-11-10\[\]"/);
  assert.match(body, /<td><time class="date" datetime="2026-11-11" data-line="11" data-col="6" /);
});

test('date: in the front matter is left as written', () => {
  const { body } = render('-----\ntitle: Due date:2026-11-10[]\n-----\n\nhello\n');
  assert.doesNotMatch(body, /[\uE000-\uF8FF]/);
  assert.match(body, /Due date:2026-11-10\[\]/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('date:2026-11-10[]\n').css, /\.date-cal \{/);
});
