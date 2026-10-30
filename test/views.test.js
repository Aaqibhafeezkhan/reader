import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frames as framed, page, run } from './dom.js';

/**
 * A page of two preview frames with views.js loaded: `told[i]` is what the
 * i-th frame has been told of views (or, with `of: 'picked'`, of picks), and
 * `ask(i, data)` sends what it asks.
 */
function app({ stored, storage = true, of = 'viewed' } = {}) {
  const window = page('<iframe></iframe><iframe></iframe>');
  const told = [[], []];
  const frames = [...window.document.querySelectorAll('iframe')].map((f, i) => {
    const w = { postMessage: (m) => m.type === of && told[i].push(structuredClone(m)) };
    Object.defineProperty(f, 'contentWindow', { value: w });
    return w;
  });
  if (stored) window.localStorage.setItem('reader:views', JSON.stringify(stored));
  if (!storage) {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('no storage here'); } });
  }
  run(framed(window), 'static/views.js');
  const ask = (i, data) => window.dispatchEvent(new window.MessageEvent('message', { data, source: frames[i] ?? {} }));
  const latest = (i) => told[i].at(-1)?.[of === 'picked' ? 'keys' : 'views'];
  return { window, told, ask, latest };
}

test('a frame is told the views as the page loads, and again when it asks', () => {
  const { told, ask } = app({ stored: [['multiplier:#Akara', '2']] });
  const viewed = { type: 'viewed', views: { 'multiplier:#Akara': '2' } };
  assert.deepEqual(told, [[viewed], [viewed]]);
  ask(1, { type: 'views' });
  assert.deepEqual(told, [[viewed], [viewed, viewed]]);
});

test('a view set is kept, and every frame told; one set to nothing is forgotten', () => {
  const { window, ask, latest } = app();
  ask(0, { type: 'view', key: 'a', value: '2' });
  ask(0, { type: 'view', key: 'b', value: '3' });
  assert.deepEqual(latest(1), { a: '2', b: '3' });
  assert.deepEqual(JSON.parse(window.localStorage.getItem('reader:views')), [['b', '3'], ['a', '2']]);
  ask(1, { type: 'view', key: 'a', value: null });
  assert.deepEqual(latest(0), { b: '3' });
});

test('only so many are kept, the oldest let go', () => {
  const { window, ask } = app();
  for (let i = 0; i < 201; i++) ask(0, { type: 'view', key: `k${i}`, value: '2' });
  const kept = JSON.parse(window.localStorage.getItem('reader:views'));
  assert.equal(kept.length, 200);
  assert.deepEqual([kept[0][0], kept.at(-1)[0]], ['k200', 'k1']);
});

test('what isn\'t one of the page\'s frames, or isn\'t a view, is ignored', () => {
  const { told, ask } = app();
  ask(2, { type: 'view', key: 'a', value: '2' });
  ask(2, { type: 'views' });
  ask(0, { type: 'view', key: 7, value: '2' });
  assert.deepEqual(told.map((t) => t.length), [1, 1]);
});

test('a view set in another window is told to the frames here', () => {
  const { window, latest } = app();
  window.localStorage.setItem('reader:views', JSON.stringify([['a', '2']]));
  window.dispatchEvent(new window.StorageEvent('storage', { key: 'reader:other' }));
  assert.deepEqual(latest(0), {});
  window.dispatchEvent(new window.StorageEvent('storage', { key: 'reader:views' }));
  assert.deepEqual(latest(0), { a: '2' });
});

test('without storage, views are kept as long as the page lasts', () => {
  const { window, ask, latest } = app({ storage: false });
  assert.throws(() => window.localStorage);
  ask(0, { type: 'view', key: 'a', value: '2' });
  assert.deepEqual(latest(1), { a: '2' });
});

test('a version picked is kept, latest first, and every frame told', () => {
  const { window, told, ask, latest } = app({ of: 'picked' });
  assert.deepEqual(told, [[{ type: 'picked', keys: [] }], [{ type: 'picked', keys: [] }]]);
  ask(0, { type: 'pick', key: 'KJV' });
  ask(1, { type: 'pick', key: 'RSV' });
  ask(0, { type: 'pick', key: 'KJV' });
  assert.deepEqual(latest(1), ['KJV', 'RSV']);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('reader:tabs')), ['KJV', 'RSV']);
  assert.equal(window.localStorage.getItem('reader:views'), null);
  for (let i = 0; i < 60; i++) ask(0, { type: 'pick', key: `k${i}` });
  assert.equal(latest(0).length, 50);
  ask(1, { type: 'picks' });
  assert.equal(told[1].at(-1).keys[0], 'k59');
});
