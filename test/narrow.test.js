import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = readFileSync(new URL('../static/style.css', import.meta.url), 'utf8');
const NARROW = '@media (max-width: 900px) {';

test('at a narrow width, every layout of the panes has one column', () => {
  const at = style.indexOf(NARROW);
  const narrow = style.slice(at, style.indexOf('\n}\n', at));
  const selectors = (css) => [...css.matchAll(/^\s*([^{}\n]*\.split[^{}\n]*) \{[^}]*grid-template-columns: ([^;]+);/gm)]
    .flatMap((m) => m[1].split(', ').map((s) => [s, m[2]]));
  const wide = selectors(style.slice(0, at));
  assert.ok(wide.some(([s]) => s === '.split.work-mode'), 'Work has its own columns when wide');
  // The list is out of the grid here, so the page would be in the first of
  // several columns, which is an empty one in Work: it would have no width.
  const columns = new Map(selectors(narrow));
  for (const [s] of wide) assert.equal(columns.get(s), '1fr', s);
});

const TOUCH = '@media (hover: none) and (pointer: coarse) {';
const touch = () => {
  const at = style.indexOf(TOUCH);
  assert.ok(at >= 0, 'a block for touch screens');
  return style.slice(at, style.indexOf('\n}\n', at));
};

test('the way out of a deck shows only on a touch screen, big enough to tap', () => {
  assert.match(style, /^\.deck-leave \{ display: none; \}$/m);
  const leave = touch().match(/\.deck-leave \{[^}]*\}/)[0];
  assert.match(leave, /display: inline-flex/);
  for (const side of ['width', 'height']) assert.ok(Number(leave.match(new RegExp(`[\\s;]${side}: (\\d+)px`))[1]) >= 24, side);
});

test('a touch screen\'s foot of a slide is one line, without the keyboard\'s shortcuts', () => {
  assert.match(touch(), /\.deck-foot \{[^}]*white-space: nowrap/);
  assert.match(touch(), /\.deck-keys, #deckBy \{ display: none; \}/);
});
