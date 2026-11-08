/**
 * A thing beside its text: a `:::` block named `row` sets its first block at
 * that block's own width and stacks the rest beside it, top-aligned, a cover
 * beside a book's title and how far it's read:
 *
 *   ::: row
 *   ![](cover.jpg =56x)
 *
 *   **[The Way of Kings](https://example.com/book)** · Brandon Sanderson
 *
 *   progress:[326/1007] pages
 *   :::
 *
 * With `+++` lines, what's before the first is the first block, however many
 * blocks it is, and the rest is beside it. `::: row reverse` puts the first
 * block on the right. An image alone in the first block is just the image,
 * not a figure with a caption (src/render.js), its alt text still its name.
 * Where the rest has no room beside it, on a phone, it goes under.
 *
 * The other names on the fence are styles, as on any `:::` block. The styles
 * feature reads the fences, leaving this block's as the marks in
 * features/layout.js, which splits what's between them.
 */

import fs from 'node:fs';
import { declare, opens, panes, words } from '../layout.js';

export function row(md) {
  declare(md, 'row', ['reverse']);
  md.block.ruler.before('fence', 'row', rule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.core.ruler.after('inline', 'row_image', bare);
}

function rule(state, startLine, endLine, silent) {
  if (!opens(state, startLine, 'row')) return false;
  if (silent) return true;

  const open = state.push('row_open', 'div', 1);
  open.attrs = [['class', words(state, startLine).includes('reverse') ? 'row row-reverse' : 'row']];
  open.block = true;
  // An aside written in it or after it is about all of it (features/rows.js).
  open.meta = { whole: true };

  const { end, panes: blocks } = panes(state, startLine, endLine, 'row');
  open.map = [startLine, Math.min(end + 1, endLine)];
  const [lead, ...rest] = blocks;
  if (lead) side(state, 'row-lead', [lead]);
  if (rest.length) side(state, 'row-rest', rest);

  state.push('row_close', 'div', -1).block = true;
  state.line = Math.min(end + 1, endLine);
  return true;
}

/** A side of the row, holding `blocks`. */
function side(state, name, blocks) {
  const open = state.push('row_side_open', 'div', 1);
  open.attrs = [['class', name]];
  open.block = true;
  open.map = [blocks[0].map[0], blocks.at(-1).map[1]];
  for (const { tokens } of blocks) state.tokens.push(...tokens);
  state.push('row_side_close', 'div', -1).block = true;
}

/**
 * An image alone in the first block's paragraph is drawn without the
 * paragraph, so it's the image, and not the figure an image alone in its
 * paragraph becomes. A linked image is too.
 */
function bare(state) {
  const tokens = state.tokens;
  for (let i = 0; i + 3 < tokens.length; i++) {
    if (tokens[i].type !== 'row_side_open' || tokens[i].attrGet('class') !== 'row-lead') continue;
    const [p, inline, close, after] = tokens.slice(i + 1, i + 5);
    if (p.type !== 'paragraph_open' || close.type !== 'paragraph_close' || after.type !== 'row_side_close') continue;
    if (!image(inline.children)) continue;
    p.hidden = true;
    close.hidden = true;
  }
}

/** Whether `children` are an image alone, or one alone in its link. */
function image(children = []) {
  const shown = children.filter((c) => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak');
  const types = shown.map((c) => c.type).join(' ');
  return types === 'image' || types === 'link_open image link_close';
}

export default {
  name: 'row',
  plugin: row,
  css: fs.readFileSync(new URL('./row.css', import.meta.url), 'utf8'),
};
