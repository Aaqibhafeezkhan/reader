/**
 * An ordered list written with `1)` in place of `1.` has its numbers drawn
 * as badges, as a code fence's callouts are, and so does a lettered one,
 * `a)` (lists.js), at any depth:
 *
 *   1) Clone the repo
 *      a) with `gh`
 *   2) Run `npm install`
 *
 * It numbers itself as any list does, from where its first item says. Each
 * item carries its number, or letter, so a list the asides cut in two
 * keeps counting. And each says its badges, outermost first, joined by dots
 * (`1.d`), as the id to link to it by (the `anchor` tag, see source.js), a
 * list that isn't badged between them leaving it none.
 */

import fs from 'node:fs';
import { addClass } from '../source.js';
import { lists as badgeLists } from './lists.js';

/** The `n`th of a list of kind `marker`: a number, or for letters, its letter. */
const labelOf = (marker, n) => (marker === 'letter' ? String.fromCharCode(96 + n) : String(n));

export function badges(md) {
  md.use(badgeLists);
  md.core.ruler.push('badges', (state) => {
    // Each list we're in, its kind and its next number, or null for one that isn't badges.
    const lists = [];
    // The badges of the item we're in, in each list we're in.
    const path = [];
    for (const t of state.tokens) {
      if (t.type === 'ordered_list_open' || t.type === 'bullet_list_open') {
        const badged = t.type === 'ordered_list_open' && t.markup === ')';
        if (badged) addClass(t, 'badges');
        lists.push(badged ? { marker: t.meta?.marker, next: Number(t.attrGet('start') ?? 1) } : null);
      } else if (t.type === 'ordered_list_close' || t.type === 'bullet_list_close') {
        lists.pop();
      } else if (t.type === 'list_item_open') {
        const list = lists.at(-1);
        path.length = lists.length - 1;
        if (list == null) {
          path.push(null);
          continue;
        }
        const n = labelOf(list.marker, list.next++);
        t.attrSet('data-n', n);
        path.push(n);
        if (path.every((p) => p != null)) t.meta = { ...t.meta, anchor: path.join('.') };
      }
    }
  });
}

export default {
  name: 'badges',
  plugin: badges,
  css: fs.readFileSync(new URL('./badges.css', import.meta.url), 'utf8'),
};
