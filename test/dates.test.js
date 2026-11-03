import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateOf, today } from '../src/dates.js';

test('a file is dated by its `date:` front matter', () => {
  assert.equal(dateOf('list.md', '---\ndate: 2026-10-31\n---\n\n# A\n'), '2026-10-31');
  assert.equal(dateOf('list.md', '---\r\ndate: "2026-10-31"\r\n---\r\n'), '2026-10-31');
  assert.equal(dateOf('list.md', '---\ndate: 2026-10-31T09:00\n---\n'), '2026-10-31');
});

test('without one, a file is dated by its name or path', () => {
  assert.equal(dateOf('journal/2026-10-31.md'), '2026-10-31');
  assert.equal(dateOf('journal-2026-10-31-morning.md'), '2026-10-31');
  assert.equal(dateOf('2026-10-31/notes.md'), '2026-10-31');
  assert.equal(dateOf('2026/10/31/notes.md'), '2026-10-31');
  assert.equal(dateOf('years/2026/10/31.md'), '2026-10-31');
  assert.equal(dateOf('journal/2026-10-31.review.md'), '2026-10-31');
  assert.equal(dateOf('2026-10-31.md', '# A\n\ndate: 2020-01-01\n'), '2026-10-31');
});

test('a `date:` wins over the name, and of several in a path the nearest the file does', () => {
  assert.equal(dateOf('journal/2026-10-31.md', '---\ndate: 2020-01-01\n---\n'), '2020-01-01');
  assert.equal(dateOf('2020-01-01/2026-10-31.md'), '2026-10-31');
  assert.equal(dateOf('2020/01/01/2026-10-31.md'), '2026-10-31');
});

test('what isn\'t a date doesn\'t date a file', () => {
  for (const name of ['2026-13-45.md', '2026-02-30.md', '2026-00-10.md', '2026-10-00.md', '2026/13/45/notes.md',
    '12026-10-31.md', '2026-10-311.md', 'v2026/10/31/notes.md', '2026/10/31x/notes.md', 'notes.md', '2026-10.md']) {
    assert.equal(dateOf(name), null, name);
  }
  assert.equal(dateOf('2024-02-29.md'), '2024-02-29');
  assert.equal(dateOf('2026-02-29.md'), null);
  // A bad date beside a good one leaves the good one.
  assert.equal(dateOf('2026-10-31/2026-13-45.md'), '2026-10-31');
});

test('a `date:` that isn\'t a date leaves the name to say', () => {
  for (const date of ['soon', '2026-13-45', 'October 31, 2026', '']) {
    assert.equal(dateOf('2026-10-31.md', `---\ndate: ${date}\n---\n`), '2026-10-31', date);
    assert.equal(dateOf('notes.md', `---\ndate: ${date}\n---\n`), null, date);
  }
});

test('a `date:` that isn\'t in front matter says nothing', () => {
  assert.equal(dateOf('notes.md', '---\n\nJust a rule, and then prose.\n\ndate: 2026-10-31\n\n---\n'), null);
  assert.equal(dateOf('notes.md', '---\ndate: 2026-10-31\n'), null);
  assert.equal(dateOf('notes.md', '\n---\ndate: 2026-10-31\n---\n'), null);
});

test('today is the local date by the clock it\'s given', () => {
  assert.equal(today(() => new Date(2026, 9, 31, 23, 59).getTime()), '2026-10-31');
  assert.equal(today(() => new Date(2026, 10, 1, 0, 0).getTime()), '2026-11-01');
  assert.equal(today(() => new Date(2026, 0, 2, 12).getTime()), '2026-01-02');
});
