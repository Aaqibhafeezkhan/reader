/**
 * `link:#id[]` links to something on the page by its id: a heading, as
 * `[text](#the-plan)` does (gh-244), or an item of a badged list, `1)`,
 * `a)`, by its badges (gh-262): `#1.d` is item d) of item 1).
 *
 *   link:#1.d[]               "1 d)", the item's own badges
 *   link:#5[Proposals]        "Proposals"
 *   link:#the-plan[]          "the-plan", as it's written
 *
 * The brackets name it, as any link's do; empty, an item is named by its
 * badges, and anything else by its id. Like `[text](#1.d)`, which goes to
 * the same place, it's text on GitHub.
 */

import { schemeLinks } from '../scheme.js';

// An item's id: its badges, outermost first, each a number or a letter, joined by dots.
const ITEM = /^(?:\d+|[a-z])(?:\.(?:\d+|[a-z]))*$/;

/** `path` is the `#` and the id. */
export function link(path, label) {
  const id = path.slice(1);
  const text = label.trim();
  if (text) return { href: path, label: text };
  return { href: path, label: ITEM.test(id) ? `${id.split('.').join(' ')})` : id };
}

export function links(md) {
  schemeLinks(md, {
    name: 'link',
    scheme: 'link',
    path: /#[^\s[\]]+/,
    link,
  });
}

export default {
  name: 'link',
  plugin: links,
};
