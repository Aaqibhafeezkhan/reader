import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { AMOUNT, multiply, readChoices, writeNumber } from './amount.js';

const times = (s, by) => multiply(AMOUNT.exec(s), by);
const counts = (body) => [...body.matchAll(/<span class="count"([^>]*)>([^<]*)<\/span>/g)].map((m) => ({ attrs: m[1], text: m[2] }));
const by = (c) => JSON.parse(c.attrs.match(/data-by="([^"]*)"/)[1].replace(/&quot;/g, '"'));

test('an amount is multiplied as a cook would write it', () => {
  assert.equal(times('2', 3), '6');
  assert.equal(times('1/2', 3), '1 1/2');
  assert.equal(times('1 1/2', 2), '3');
  assert.equal(times('3/4', 1 / 2), '3/8');
  assert.equal(times('½', 3), '1½');
  assert.equal(times('1⅓', 2), '2⅔');
  assert.equal(times('0.75', 2), '1.5');
  assert.equal(times('1', 1 / 2), '1/2');
  assert.equal(times('1–2', 2), '2–4');
  assert.equal(times('2 to 3', 2), '4 to 6');
  assert.equal(writeNumber(1 / 7, 'fraction'), '0.14');
});

test('a multiplier offers 1×, 2× and 3×, or what it names, with 1× always', () => {
  assert.deepEqual(readChoices('').map((c) => c.label), ['1×', '2×', '3×']);
  assert.deepEqual(readChoices('1/2, 2x, 4').map((c) => c.label), ['½×', '1×', '2×', '4×']);
  assert.equal(readChoices('lots'), null);
});

test('counts in a multiplier\'s section carry what they read at each multiple', () => {
  const { body } = render('## Akara\nServes: count:4\nmultiplier:[]\n\n### Ingredients\n* count:1/2 teaspoon salt\n\n### Steps\n1) Fry count:5–6 at a time, for 3 minutes.\n', { file: 'recipes.md' });
  assert.match(body, /<span class="multiplier" role="group" aria-label="Multiply the amounts" data-multiplier="1" data-key="recipes.md#Akara"><button type="button" class="multiply" data-by="1" aria-pressed="true">1×<\/button><button[^>]*data-by="2"[^>]*>2×<\/button><button[^>]*data-by="3"/);
  const found = counts(body);
  assert.deepEqual(found.map((c) => c.text), ['4', '1/2', '5–6']);
  assert.deepEqual(by(found[0]), { 1: '4', 2: '8', 3: '12' });
  assert.deepEqual(by(found[1]), { 1: '1/2', 2: '1', 3: '1 1/2' });
  assert.deepEqual(by(found[2]), { 1: '5–6', 2: '10–12', 3: '15–18' });
  assert.match(body, /for 3 minutes/);
});

test('each recipe has its own multiplier, and one without has counts that stay', () => {
  const { body } = render('## Yam\n* count:2 cups flour\n\n## Akara\nmultiplier:[1/2]\n* count:2 cups peas\n');
  const [yam, akara] = counts(body);
  assert.equal(yam.attrs, '');
  assert.match(akara.attrs, /data-multiplier="1"/);
  assert.deepEqual(by(akara), { 0.5: '1', 1: '2' });
});

test('count: without an amount, after a word, or in code is left as typed', () => {
  const { body } = render('multiplier:[]\n\ncount:some, recount:2, `count:2`\n');
  assert.equal(counts(body).length, 0);
  assert.match(body, /count:some, recount:2, <code>count:2<\/code>/);
});

test('an exported page has no multiplier or reset to press, its counts as written', () => {
  const { body } = render('## Akara\nmultiplier:[]\nreset:[]\n\n* count:2 cups peas\n', { for: 'export' });
  assert.doesNotMatch(body, /class="multiplier"|task-reset|task-log/);
  assert.match(body, /<span class="count"[^>]*>2<\/span> cups peas/);
});
