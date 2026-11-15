import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

const page = globals(app());
const { readAddress, paramsFor, writeAddress, clearAddress, addressOf } = await import('../static/app/address.js');

const at = (address) => page.history.replaceState(null, '', address);
const shown = () => page.location.pathname + page.location.search + page.location.hash;

test('the address names a file in its path, its lines, and how it\'s set to be seen, a # in the query encoded (gh-21, gh-292)', () => {
  at('/read/notes/review.md:13-18?by=%23c&about=d');
  assert.deepEqual(readAddress(), { wanted: 'notes/review.md', line: 13, last: 18, params: { by: '#c', about: 'd' } });
  at('/read/review.md');
  assert.deepEqual(readAddress(), { wanted: 'review.md', line: undefined, last: NaN, params: {} });
  at('/read/a%3A1.md:2');
  assert.deepEqual(readAddress(), { wanted: 'a:1.md', line: 2, last: 2, params: {} }, 'a : in a name is the name\'s');
  at('/read/plan.md#the-plan');
  assert.equal(readAddress().wanted, 'plan.md', 'the hash is a heading\'s, not the file\'s');
  at('/read/%E0%A4%A');
  assert.deepEqual(readAddress(), { params: {} }, 'one that doesn\'t decode names nothing');
});

test('an address in the old form, the file in the hash, still names it, and says it\'s old', () => {
  at('/#notes%2Freview.md:13-18?by=%23c&about=d');
  assert.deepEqual(readAddress(), { wanted: 'notes/review.md', line: 13, last: 18, params: { by: '#c', about: 'd' }, old: true });
  at('/#review.md?by=#&about=c');
  assert.deepEqual(readAddress().params, { by: '#', about: 'c' }, 'as gh-21 wrote it, by hand');
  at('/#notes/talk.md:13');
  assert.equal(readAddress().wanted, 'notes/talk.md', 'as a line\'s address was copied, its folders not encoded');
  at('/');
  assert.deepEqual(readAddress(), { wanted: '', line: undefined, last: NaN, params: {} }, 'no file');
});

test('a file\'s address encodes each folder\'s name apart, and its lines', () => {
  assert.equal(addressOf('notes/a b.md'), '/read/notes/a%20b.md');
  assert.equal(addressOf('a?#:.md', { line: 3, last: 5 }), '/read/a%3F%23%3A.md:3-5');
  assert.equal(addressOf('a.md', { line: 3, last: 3, params: { by: '#' } }), '/read/a.md:3?by=%23');
});

test('how a file is set to be seen is kept only while the address names that file, and an empty setting is left out', () => {
  at('/read/review.md?by=%23');
  assert.deepEqual(paramsFor('review.md'), { by: '#' });
  assert.deepEqual(paramsFor('other.md'), {}, 'another file opens as it is');
  writeAddress('review.md', { by: '#c', about: '' });
  assert.equal(shown(), '/read/review.md?by=%23c');
  writeAddress('a b.md', {});
  assert.equal(shown(), '/read/a%20b.md');
});

test('a heading in the hash stays while the file does, and an old address is written anew', () => {
  at('/read/plan.md#the-plan');
  writeAddress('plan.md', { by: '#' });
  assert.equal(shown(), '/read/plan.md?by=%23#the-plan');
  writeAddress('other.md', {});
  assert.equal(shown(), '/read/other.md', 'another file\'s isn\'t its heading');
  at('/#plan.md');
  writeAddress('plan.md', {});
  assert.equal(shown(), '/read/plan.md', 'the old form\'s hash was the file');
  clearAddress();
  assert.equal(shown(), '/');
});
