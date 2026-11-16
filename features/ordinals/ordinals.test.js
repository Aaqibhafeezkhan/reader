import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { suffix } from './index.js';

const text = (src) => {
  const { body } = render(src);
  return body.slice(body.indexOf('<div class="gm-speaker">'), body.indexOf('</section>'));
};
const sup = (s) => `<sup class="ordinal">${s}</sup>`;

test('the suffix a number takes', () => {
  assert.deepEqual(['1', '2', '3', '4', '11', '12', '13', '21', '22', '23', '101', '111', '112', '1000'].map(suffix),
    ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'st', 'nd', 'rd', 'st', 'th', 'th', 'th']);
});

test("an ordinal's suffix is raised", () => {
  const html = text('The 1st, 2nd, 3rd and 21st of the month, and the 4th.\n');
  assert.match(html, new RegExp(`The 1${sup('st')}, 2${sup('nd')}, 3${sup('rd')} and 21${sup('st')} of the month, and the 4${sup('th')}\\.`));
  assert.match(text('the 11th, 12th, 113th and 1,000th\n'), new RegExp(`11${sup('th')}, 12${sup('th')}, 113${sup('th')} and 1,000${sup('th')}`));
});

test("only the suffix the number takes", () => {
  assert.doesNotMatch(text('the 11st, 2th, 3nd and 21th\n'), /<sup/);
});

test('a number in a word, code, or a link address is left alone', () => {
  assert.doesNotMatch(text('4thly, x1st, 2nds, 1st_place, v1.2nd\n'), /<sup/);
  assert.match(text('`1st`\n'), /<code>1st<\/code>/);
  assert.match(text('```\n1st\n```\n'), /<code>1st\n<\/code>/);
  assert.match(text('[the 1st](https://x.test/1st)\n'), new RegExp(`<a href="https://x\\.test/1st">the 1${sup('st')}</a>`));
  assert.match(text('https://x.test/1st and <https://x.test/2nd>\n'), /<a href="https:\/\/x\.test\/1st">https:\/\/x\.test\/1st<\/a> and <a href="https:\/\/x\.test\/2nd">https:\/\/x\.test\/2nd<\/a>/);
  assert.match(text('![the 1st](i.png)\n'), /alt="the 1st"/);
});

test('a backslash keeps it as typed', () => {
  assert.match(text('the 1\\st and the 2nd\n'), new RegExp(`the 1st and the 2${sup('nd')}`));
});

test('in a heading, emphasis and a list', () => {
  assert.match(text('## The 3rd day\n'), new RegExp(`The 3${sup('rd')} day`));
  assert.match(text('- **22nd**\n'), new RegExp(`<strong>22${sup('nd')}</strong>`));
});

test('an aside still finds words with an ordinal in them', () => {
  const html = text('On the 1st of May.\n~[the 1st] which year?\n');
  assert.match(html, /data-mark="mk-1"[^>]*>the 1<sup class="ordinal">st<\/sup><\/span>/i);
});
