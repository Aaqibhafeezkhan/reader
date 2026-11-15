/**
 * An ordinal's suffix is raised, as typesetting raises it: the `st`, `nd`,
 * `rd` or `th` right after a number (1st, 22nd, 3rd, 4th, 1,000th). Only
 * the suffix the number takes is raised, so `11th` is and `11st` isn't. A
 * number that's part of a word (`4thly`, `x1st`), code, and a link's
 * address are left alone, and so is a link that shows its own address; a
 * backslash (`1\st`) keeps the suffix as typed.
 *
 * A `late` plugin, splitting the text once every other feature has read it,
 * so the words an aside chooses (`~[the 1st]`) are still found in one piece.
 */

import fs from 'node:fs';
import { textToken } from '../source.js';

const ORDINAL = /(?<![\p{L}\p{N}_]|\d[.,])(\d{1,3}(?:,\d{3})+|\d+)(\\?)(st|nd|rd|th)(?![\p{L}\p{N}_])/gu;

/** The suffix `n` (its digits) takes: `st` for 1, 21 and 101, `th` for 11, 12 and 13. */
export function suffix(n) {
  const tens = Number(n.slice(-2));
  if (tens >= 11 && tens <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n.slice(-1)] ?? 'th';
}

function raise(state, child) {
  const out = [];
  let text = '';
  let last = 0;
  for (const m of child.content.matchAll(ORDINAL)) {
    const [whole, number, escaped, end] = m;
    if (suffix(number.replace(/,/g, '')) !== end) continue;
    text += child.content.slice(last, m.index);
    last = m.index + whole.length;
    if (escaped) {
      text += number + end;
      continue;
    }
    text += number;
    out.push(textToken(state, text));
    const sup = new state.Token('ordinal', 'sup', 0);
    sup.content = end;
    out.push(sup);
    text = '';
  }
  if (!last) return [child];
  text += child.content.slice(last);
  if (text) out.push(textToken(state, text));
  return out.filter((t) => t.type !== 'text' || t.content);
}

export function ordinals(md) {
  md.core.ruler.push('ordinals', (state) => {
    // An image's alt text is left as typed: it can only be text.
    const walk = (inline) => {
      const out = [];
      let shown = 0;
      for (const c of inline.children) {
        // A link that shows its own address: `<https://x.test/1st>`.
        if (c.type === 'link_open' && (c.markup === 'linkify' || c.markup === 'autolink')) shown++;
        if (c.type === 'link_close' && shown && (c.markup === 'linkify' || c.markup === 'autolink')) shown--;
        out.push(...(c.type === 'text' && !shown ? raise(state, c) : [c]));
      }
      inline.children = out;
    };
    for (const block of state.tokens) {
      if (block.type === 'inline' && block.children) walk(block);
    }
  });
  md.renderer.rules.ordinal = (tokens, i) => `<sup class="ordinal">${tokens[i].content}</sup>`;
}

export default {
  name: 'ordinals',
  late: ordinals,
  css: fs.readFileSync(new URL('./ordinals.css', import.meta.url), 'utf8'),
};
