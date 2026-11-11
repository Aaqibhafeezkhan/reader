import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

const page = globals(app());
const { readAddress, paramsFor, writeAddress } = await import('../static/app/address.js');

const at = (hash) => page.history.replaceState(null, '', `/${hash}`);

test('the address names a file, its lines, and how it\'s set to be seen, a # in the query encoded or not (gh-21)', () => {
  at('#notes%2Freview.md:13-18?by=%23c&about=d');
  assert.deepEqual(readAddress(), { wanted: 'notes/review.md', line: 13, last: 18, params: { by: '#c', about: 'd' } });
  at('#review.md?by=#&about=c');
  assert.deepEqual(readAddress().params, { by: '#', about: 'c' }, 'as the issue wrote it, by hand');
  at('#review.md');
  assert.deepEqual(readAddress(), { wanted: 'review.md', line: undefined, last: NaN, params: {} });
  at('#%E0%A4%A');
  assert.deepEqual(readAddress(), { params: {} }, 'one that doesn\'t decode names nothing');
});

test('how a file is set to be seen is kept only while the address names that file, and an empty setting is left out', () => {
  at('#review.md?by=%23');
  assert.deepEqual(paramsFor('review.md'), { by: '#' });
  assert.deepEqual(paramsFor('other.md'), {}, 'another file opens as it is');
  writeAddress('review.md', { by: '#c', about: '' });
  assert.equal(page.location.hash, '#review.md?by=%23c');
  writeAddress('a b.md', {});
  assert.equal(page.location.hash, '#a%20b.md');
});
