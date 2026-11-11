/**
 * Fold: every heading in the text can fold away its section, in Edit and
 * Work, so a long document can be read a part at a time (gh-100). Its
 * section runs to the next heading of the same level or higher, across the
 * page's rows (src/columns.js), asides and all. Folding is a way of seeing
 * the page, not part of it, so nothing is written: a heading opens folded
 * when its box is ticked, `# [x] Done`, and open otherwise, and what's been
 * folded or opened since is kept while the page is open (preview.js).
 *
 * Here, a ticked heading is marked to open folded (`data-fold="closed"`),
 * read from its line as written, whichever feature draws its box.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keepWritten } from '../source.js';

const TICKED = /^ {0,3}#{1,6}[ \t]+\[[xX]\](?=\s|$)/;

export function fold(md) {
  keepWritten(md);
  md.core.ruler.after('block', 'fold_ticked', (state) => {
    if (state.inlineMode || state.env.nested) return;
    // Each heading's line as written, traced back through what's been
    // taken out (src/page.js): a box's `[x]` may be a placeholder by now.
    const { written = [], sourceLines = [] } = state.env;
    for (const t of state.tokens) {
      if (t.type !== 'heading_open' || !t.map) continue;
      if (TICKED.test(written[sourceLines[t.map[0]] ?? t.map[0]] ?? '')) t.attrSet('data-fold', 'closed');
    }
  });
}

export default {
  name: 'fold',
  plugin: fold,
  css: fs.readFileSync(new URL('./fold.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
