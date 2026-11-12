import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choicesIn, pickedAt } from './choices.js';

test('choices are a run of marks, each with words after it, from where they start', () => {
  const line = 'A: ( ) Yes  (x) No ';
  const found = choicesIn(line, 3);
  assert.deepEqual(found.map((c) => [c.checked, line.slice(c.start, c.end), line.slice(c.label.start, c.label.end)]), [
    [false, '( )', 'Yes'],
    [true, '(x)', 'No'],
  ]);
  assert.equal(pickedAt(line, found, 0), 'A: (x) Yes  ( ) No ');
  assert.equal(pickedAt(line, found), 'A: ( ) Yes  ( ) No ');
});

test('words before the first mark, or a mark with none after it, are no choices', () => {
  assert.equal(choicesIn('A: I said ( ) once', 3), null);
  assert.equal(choicesIn('A: ( ) Yes ( )', 3), null);
  assert.equal(choicesIn('A: nothing', 3), null);
});

test('a mark in what\'s skipped, a blank\'s answer, is part of it', () => {
  const line = '( ) Yes ( ) [@ Else: (x) this]';
  const found = choicesIn(line, 0, [{ start: 12, end: line.length }]);
  assert.equal(found.length, 2);
  assert.equal(pickedAt(line, found, 1), '( ) Yes (x) [@ Else: (x) this]');
});
