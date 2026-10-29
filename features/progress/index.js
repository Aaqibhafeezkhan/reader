/**
 * `progress:` draws a bar, and says how far along it is: what's counted is
 * the words after it, outside the brackets.
 *
 *   progress:[326/1007] pages        a bar a third full, "326 of 1007 pages"
 *   progress:[] reviewed             "3 of 11 reviewed"
 *
 * Empty brackets count the boxes in its section -- the heading it's under,
 * to the next at that level or above, or the slide it's on -- and how many
 * are done; the heading's own box, which says the whole section is done,
 * isn't one of them. A box is whatever a feature tags as a thing to be done
 * (`done`, see source.js's tags), so it counts any feature's, without
 * knowing which drew them. A choice isn't a thing to be done.
 *
 * Each bar that counts carries the lines of the boxes it counted
 * (`data-lines`), and the preview counts them again as they're ticked
 * (preview.js). Where the page can't be worked, as on a slide or in a
 * record, it's drawn as the file stands, as the boxes are.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemeRule } from '../scheme.js';
import { sections, unplaced } from '../source.js';
import { progressBar } from '../../static/progress.js';

const NUMBER = '(\\d+(?:\\.\\d+)?)';
const WRITTEN = new RegExp(`^\\s*${NUMBER}\\s*/\\s*${NUMBER}\\s*$`);
const WORDS = new Set(['text', 'code_inline']);

export function progress(md) {
  schemeRule(md, {
    name: 'progress',
    scheme: 'progress',
    path: /(?:)/,
    make: (state, where, label) => {
      const m = WRITTEN.exec(label);
      if (!m && label.trim()) return false;
      if (state) state.push('progress', 'span', 0).meta = m ? { done: Number(m[1]), of: Number(m[2]) } : { counted: true };
      return true;
    },
  });

  // Each bar is named by the words after it on its line, and one that
  // counts finds the boxes of its section, by the tags on them.
  md.core.ruler.push('progress_count', (state) => {
    if (state.inlineMode) return;
    const { of } = sections(state);
    const boxes = [];
    state.tokens.forEach((block, i) => {
      // A heading's own box is the heading's, not its section's.
      const heading = state.tokens[i - 1]?.type === 'heading_open' ? of[i] : null;
      for (const t of [block, ...(block.children ?? [])]) {
        if (typeof t.meta?.done === 'boolean') boxes.push({ meta: t.meta, section: of[i], heading });
      }
    });
    state.tokens.forEach((block, i) => {
      (block.children ?? []).forEach((t, j, children) => {
        if (t.type !== 'progress') return;
        t.meta.name = nameAfter(children, j);
        if (!t.meta.counted) return;
        const section = of[i];
        const counted = boxes.filter((b) => b.heading !== section && within(b.section, section));
        t.meta.done = counted.filter((b) => b.meta.done).length;
        t.meta.of = counted.length;
        t.meta.lines = counted.map((b) => b.meta.line).filter((n) => Number.isInteger(n));
      });
    });
  });

  md.renderer.rules.progress = (tokens, i) => {
    const { done, of, name, counted, lines } = tokens[i].meta;
    // What it counted, to count again on the page; a bar that's written
    // stays as it's written.
    const attrs = counted ? ` data-lines="${lines.join(' ')}"` : '';
    return progressBar(done, of, { name: name || 'Progress', attrs });
  };
}

/** Whether section `s` is `around`, or inside it. */
function within(s, around) {
  for (let p = s; p; p = p.parent) if (p === around) return true;
  return false;
}

/** The words after token `j`, to the end of its line. */
function nameAfter(children, j) {
  const words = [];
  for (const t of children.slice(j + 1)) {
    if (t.type === 'softbreak' || t.type === 'hardbreak') break;
    if (WORDS.has(t.type)) words.push(t.content);
  }
  return unplaced(words.join('')).replace(/\s+/g, ' ').trim();
}

export default {
  name: 'progress',
  plugin: progress,
  css: fs.readFileSync(new URL('./progress.css', import.meta.url), 'utf8'),
  // Counts the boxes again as they're ticked.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
