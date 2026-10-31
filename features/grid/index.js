/**
 * What's in it laid out in columns: a `:::` block named `grid`, with how
 * many after it. A list in it lays out its items, row by row; otherwise
 * each block in it is a cell:
 *
 *   ::: grid 2
 *   - ( ) **A** · Strength training
 *   - ( ) **B** · Running
 *   - ( ) **C** · Something else
 *   :::
 *
 * The list stays one list, so a radio list in a grid is still one group and
 * a task list's boxes still tick. With no count, as many columns fit as
 * there's room for; with one, no more than that, and fewer on a narrow
 * page, down to one. A cell of more than one block is written between `+++`
 * lines, as a column is. The other names on the line are styles, as on any
 * `:::` block (`::: grid 2 gray`), and grids nest in other `:::` blocks.
 *
 * The styles feature reads the fences, leaving this block's as the marks in
 * features/layout.js, with the count after the name; any other word that
 * comes to be a grid's own there (`owns()`) is a class here, `grid-<word>`.
 */

import fs from 'node:fs';
import { opens, panes, words } from '../layout.js';

export function grid(md) {
  md.block.ruler.before('fence', 'grid', rule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
}

const LIST = ['bullet_list_open', 'ordered_list_open'];

function rule(state, startLine, endLine, silent) {
  if (!opens(state, startLine, 'grid')) return false;
  if (silent) return true;

  const own = words(state, startLine);
  const count = own.find((w) => /^\d+$/.test(w));
  const open = state.push('grid_open', 'div', 1);
  open.block = true;
  // An aside written in it or after it is about all of it (features/rows.js).
  open.meta = { whole: true };

  const { end, panes: cells } = panes(state, startLine, endLine, 'grid');
  open.map = [startLine, Math.min(end + 1, endLine)];
  // A list alone in it is laid out by its items; they're its cells.
  const items = cells.length === 1 && LIST.includes(cells[0].tokens[0].type);
  const classes = ['grid', items && 'grid-items', ...own.filter((w) => w !== count).map((w) => `grid-${w}`)];
  open.attrs = [['class', classes.filter(Boolean).join(' ')]];
  if (Number(count) > 0) open.attrs.push(['style', `--grid: ${Number(count)}`]);

  for (const { tokens, map } of cells) {
    if (items) {
      state.tokens.push(...tokens);
      continue;
    }
    const cell = state.push('grid_cell_open', 'div', 1);
    cell.attrs = [['class', 'grid-cell']];
    cell.block = true;
    cell.map = map;
    state.tokens.push(...tokens);
    state.push('grid_cell_close', 'div', -1).block = true;
  }

  state.push('grid_close', 'div', -1).block = true;
  state.line = Math.min(end + 1, endLine);
  return true;
}

export default {
  name: 'grid',
  plugin: grid,
  css: fs.readFileSync(new URL('./grid.css', import.meta.url), 'utf8'),
};
