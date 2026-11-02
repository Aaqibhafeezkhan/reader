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
