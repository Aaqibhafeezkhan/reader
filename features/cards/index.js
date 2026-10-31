/**
 * Choices drawn as cards: a `:::` block named `cards` makes each item of a
 * list in it a card, bordered, to be tapped anywhere to pick it:
 *
 *   ::: cards
 *   - ( ) **A** · Strength training
 *   - ( ) **B** · Running
 *   :::
 *
 * The list stays one list, so its radios are still one choice and its
 * boxes still tick; a card's own radio or box is stretched over it, unseen,
 * so a click anywhere on the card is a click on it, and the keyboard's ring
 * goes round the card. What can be clicked inside it -- a link, a video's
 * play button, a field's own choices -- is above that, and takes its own
 * clicks (cards.css). The chosen card is drawn in the accent, a ticked
 * task's filled and faded, and a plain list's items are cards with nothing
 * to pick. Without a list, each block in it is a card, or what's between
 * `+++` lines.
 *
 * It's a grid's word too, `::: grid 2 cards`: the grid lays the cards out,
 * and its `cards` class is this one. The other names on the line are
 * styles, as on any `:::` block. An item's own background (`--card-bg`) is
 * kept when it's chosen, the choice shown by its border.
 *
 * It's built on tasks, whose boxes it draws the cards around.
 */

import fs from 'node:fs';
import { opens, panes } from '../layout.js';

export function cards(md) {
  md.block.ruler.before('fence', 'cards', rule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
}

const LIST = ['bullet_list_open', 'ordered_list_open'];

function rule(state, startLine, endLine, silent) {
  if (!opens(state, startLine, 'cards')) return false;
  if (silent) return true;

  const open = state.push('cards_open', 'div', 1);
  open.attrs = [['class', 'cards']];
  open.block = true;
  // An aside written in it or after it is about all of it (features/rows.js).
  open.meta = { whole: true };

  const { end, panes: blocks } = panes(state, startLine, endLine, 'cards');
  open.map = [startLine, Math.min(end + 1, endLine)];
  // A list alone in it is drawn by its items; they're the cards.
  const items = blocks.length === 1 && LIST.includes(blocks[0].tokens[0].type);
  for (const { tokens, map } of blocks) {
    if (items) {
      state.tokens.push(...tokens);
      continue;
    }
    const card = state.push('card_open', 'div', 1);
    card.attrs = [['class', 'card']];
    card.block = true;
    card.map = map;
    state.tokens.push(...tokens);
    state.push('card_close', 'div', -1).block = true;
  }

  state.push('cards_close', 'div', -1).block = true;
  state.line = Math.min(end + 1, endLine);
  return true;
}

export default {
  name: 'cards',
  requires: ['tasks'],
  plugin: cards,
  css: fs.readFileSync(new URL('./cards.css', import.meta.url), 'utf8'),
};
