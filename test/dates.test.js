import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStart, dateOf, today, startable, withDate } from '../src/dates.js';

test('a file is dated by its `date:` front matter', () => {
  assert.equal(dateOf('list.md', '---\ndate: 2026-10-31\n---\n\n# A\n'), '2026-10-31');
  assert.equal(dateOf('list.md', '---\r\ndate: "2026-10-31"\r\n---\r\n'), '2026-10-31');
  assert.equal(dateOf('list.md', '---\ndate: 2026-10-31T09:00\n---\n'), '2026-10-31');
});

test('without one, a file is dated by its own name', () => {
  assert.equal(dateOf('journal/2026-10-31.md'), '2026-10-31');
  assert.equal(dateOf('journal-2026-10-31-morning.md'), '2026-10-31');
  assert.equal(dateOf('journal/2026-10-31.review.md'), '2026-10-31');
  assert.equal(dateOf('2026-10-31.md', '# A\n\ndate: 2020-01-01\n'), '2026-10-31');
});

test('the folders a file is in don\'t date it', () => {
  for (const rel of ['2026-10-31/notes.md', '2026/10/31/notes.md', 'years/2026/10/31.md', '2026-10-31/2026-13-45.md']) {
    assert.equal(dateOf(rel), null, rel);
  }
  assert.equal(dateOf('2026-10-31/notes.md', '---\ndate: 2026-11-01\n---\n'), '2026-11-01');
});

test('a `date:` wins over the name, and a folder\'s date gives way to the name\'s', () => {
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
  assert.equal(dateOf('2026-10-31-2026-13-45.md'), '2026-10-31');
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

test('a day can start later than midnight, and before then it\'s still the day before', () => {
  const at = (...when) => () => new Date(...when).getTime();
  const four = dayStart('04:00');
  assert.equal(today(at(2026, 10, 1, 1, 0), four), '2026-10-31');
  assert.equal(today(at(2026, 10, 1, 3, 59), four), '2026-10-31');
  assert.equal(today(at(2026, 10, 1, 4, 0), four), '2026-11-01');
  // Across a year, and with no start given.
  assert.equal(today(at(2027, 0, 1, 1, 0), four), '2026-12-31');
  assert.equal(today(at(2026, 10, 1, 0, 0)), '2026-11-01');
});

test('a day\'s start is a time of day', () => {
  assert.equal(dayStart('04:00'), 240);
  assert.equal(dayStart('4:30'), 270);
  assert.equal(dayStart('00:00'), 0);
  for (const not of ['24:00', '04:60', '4', 'soon', '', undefined]) assert.equal(dayStart(not), null, not);
});

const md = (path, date) => ({ path, type: 'md', date });

test('a folder of files dated by their names, with none for today, can start it from its latest', () => {
  const files = [md('journal/2026-10-29.md', '2026-10-29'), md('journal/2026-10-30.md', '2026-10-30'), md('journal/2026-10-28.md', '2026-10-28')];
  assert.deepEqual(startable(files, '2026-11-03'), [{ dir: 'journal', from: 'journal/2026-10-30.md', to: 'journal/2026-11-03.md' }]);
  // One file is a journal just begun; and the top of the folder is a folder.
  assert.deepEqual(startable([md('2026-10-30.md', '2026-10-30')], '2026-11-03'), [{ dir: '', from: '2026-10-30.md', to: '2026-11-03.md' }]);
});

test('the latest goes by date, not by when it was changed, and a date to come is skipped', () => {
  const files = [
    { ...md('j/2026-10-29.md', '2026-10-29'), mtime: 9 },
    { ...md('j/2026-10-30.md', '2026-10-30'), mtime: 1 },
    { ...md('j/2099-01-01.md', '2099-01-01'), mtime: 1 },
  ];
  assert.equal(startable(files, '2026-11-03')[0].from, 'j/2026-10-30.md');
  assert.deepEqual(startable([md('j/2099-01-01.md', '2099-01-01')], '2026-11-03'), []);
});

test('a stray dated file among notes offers nothing; half the folder does', () => {
  const notes = [md('n/a.md', null), md('n/b.md', null)];
  assert.deepEqual(startable([...notes, md('n/2026-10-01.md', '2026-10-01')], '2026-11-03'), []);
  assert.equal(startable([notes[0], md('n/2026-10-01.md', '2026-10-01')], '2026-11-03').length, 1);
});

test('nothing to start where today has a file, by its date or its name, or where only folders or versions are dated', () => {
  assert.deepEqual(startable([md('j/2026-10-30.md', '2026-10-30'), md('j/plan.md', '2026-11-03')], '2026-11-03'), []);
  assert.deepEqual(startable([md('j/2026-10-30.md', '2026-10-30'), md('j/2026-11-03.md', '2026-11-01')], '2026-11-03'), []);
  assert.deepEqual(startable([md('2026/10/31/notes.md', '2026-10-31')], '2026-11-03'), []);
  assert.deepEqual(startable([md('j/2026-10-30.draft.md', '2026-10-30')], '2026-11-03'), []);
});

test('today\'s name is the latest\'s with today in it', () => {
  assert.equal(startable([md('j/log-2026-10-30-am.markdown', '2026-10-30')], '2026-11-03')[0].to, 'j/log-2026-11-03-am.markdown');
});

test('`date:` is set if there is one, and nothing else changes', () => {
  assert.equal(withDate('---\ntitle: A\ndate: 2026-10-30\n---\n\n# A\n', '2026-11-03'), '---\ntitle: A\ndate: 2026-11-03\n---\n\n# A\n');
  assert.equal(withDate('---\r\ntitle: A\r\nDate:  "2026-10-30"  \r\n---\r\n\r\ndate: x\r\n', '2026-11-03'), '---\r\ntitle: A\r\nDate:  "2026-11-03"  \r\n---\r\n\r\ndate: x\r\n');
  assert.equal(withDate('---\ndate: 2026-10-30T09:00\n---\n', '2026-11-03'), '---\ndate: 2026-11-03T09:00\n---\n');
  assert.equal(withDate('---\ndate: soon\n---\n', '2026-11-03'), '---\ndate: 2026-11-03\n---\n');
  for (const same of ['---\ntitle: A\n---\n\ndate: 2026-10-30\n', '# A\n\ndate: 2026-10-30\n', '---\nnot front matter\ndate: 2026-10-30\n---\n']) {
    assert.equal(withDate(same, '2026-11-03'), same);
  }
  assert.equal(withDate('---\nfoo:\n  date: 2026-10-30\ndate: 2026-10-30\n---\n', '2026-11-03'), '---\nfoo:\n  date: 2026-10-30\ndate: 2026-11-03\n---\n');
});
