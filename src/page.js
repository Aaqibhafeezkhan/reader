/**
 * What every page has taken off before the features read it: its front
 * matter and its HTML comments. The rest of the source is left for markdown,
 * with, for each line of it, the line of the file it came from.
 *
 * A front matter key a feature declares as its own (its `keys`,
 * features/index.js) is that feature's to read and show, not one of the
 * page's: `reviewer #: Josh` is an alias for the asides feature, not a line
 * of the byline. Every line is still there to read, by
 * `env.frontMatter.entry(...)` (static/markdown.js). Only the features the
 * page is rendered with declare keys; one left out declares none, and its
 * lines are the page's (see src/columns.js for how they show).
 *
 * A feature may say when the page closes (its `closes(frontMatter)`): when
 * its inputs are done with and it becomes a record. The page is `closed`
 * once `env.now` is past the earliest such time (features/blank.js).
 */

import { frontMatter, fenced, withEntries } from '../features/source.js';
import { FEATURES } from '../features/index.js';

// An HTML comment on lines of its own. The renderer takes no HTML, so it would
// otherwise show as text; it's dropped instead, asides and all, which makes it
// the place for a note to whoever opens the file, such as how to review it.
const COMMENT_START_RE = /^ {0,3}<!--/;

/** The front matter keys `features` declare as theirs. */
export function keysOf(features = FEATURES) {
  return features.flatMap((f) => f.keys ?? []);
}

/**
 * A front matter line, for a copy of the page dated `days` later: as the
 * first of `features` to move it makes it (its `moved(line, days)`), so
 * that a date it says keeps its distance from the page's. Otherwise as it is.
 */
export function movedLine(line, days, features = FEATURES) {
  for (const f of features) {
    const out = f.moved?.(line, days);
    if (out != null) return out;
  }
  return line;
}

/**
 * When the page with the front matter `meta` closes, in ms, by the
 * earliest that one of `features` says (its `closes(meta)`), or null if
 * none says.
 */
export function closesAt(meta, features = FEATURES) {
  const times = features
    .map((f) => f.closes?.(meta))
    .filter((t) => Number.isFinite(t));
  return times.length ? Math.min(...times) : null;
}

/**
 * @param {string} src a page as written
 * @param {object[]} [features] the features that may declare its front matter's keys
 * @returns {{meta: object, own: boolean, source: string, lines: number[]}}
 *   `meta` is the front matter's (static/markdown.js), with `entry(...)`
 *   for every line of it, and `own` whether `src` has any. `source` is `src` with
 *   the front matter and comments taken off, and `lines` has, for each line
 *   of `source`, the 0-based line of `src` it came from. A comment inside
 *   fenced code is code, and is kept.
 */
export function extract(src, features = FEATURES) {
  const all = String(src).replace(/\r\n?/g, '\n').split('\n');
  // Josh's convention uses `-----`, but `---` works too.
  const matter = frontMatter(all, { keys: keysOf(features) });
  let i = matter?.end ?? 0;
  if (matter) while (i < all.length && !all[i].trim()) i++;

  const out = [];
  const from = [];
  const code = fenced();
  while (i < all.length) {
    const line = all[i];
    if (!code(line) && COMMENT_START_RE.test(line)) {
      // Drop the comment, through the line that closes it.
      let at = line.indexOf('<!--') + 4;
      while (i < all.length && !all[i].includes('-->', at)) {
        i++;
        at = 0;
      }
      i++;
      continue;
    }
    out.push(line);
    from.push(i);
    i++;
  }
  return { meta: matter?.meta ?? withEntries(), own: Boolean(matter), source: out.join('\n'), lines: from };
}

/**
 * Takes them off, as the first rule after normalizing (`page_extract`),
 * keeping the front matter on `env.frontMatter`. A part of a file, which
 * has none of its own (a deck's slide), keeps the `env.frontMatter` it was
 * given, its file's. When the page
 * closes is `env.closes` (`closesAt`), and whether it's closed by `env.now`
 * (now, if not given), `env.closed`. Token maps count
 * lines of what's left; `env.sourceLines[n]` is the line of the source that
 * line `n` of it came from. Features that read the file as written go before
 * this rule (`beforeExtract`, features/source.js). `features` are the ones
 * the page is rendered with, which may claim lines of its front matter.
 */
export function page(md, features = FEATURES) {
  md.core.ruler.after('normalize', 'page_extract', (state) => {
    // A note's own body, parsed nested (`env.nested`), was read with the rest.
    if (state.inlineMode || state.env.nested) return;
    const { meta, own, source, lines } = extract(state.src, features);
    state.src = source.endsWith('\n') ? source : `${source}\n`;
    state.env.frontMatter = own || !state.env.frontMatter ? meta : state.env.frontMatter;
    state.env.sourceLines = lines;
    state.env.closes = closesAt(state.env.frontMatter, features);
    state.env.closed = state.env.closes != null && (state.env.now ?? Date.now()) >= state.env.closes;
  });
}
