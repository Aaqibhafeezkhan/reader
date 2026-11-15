/**
 * Each heading's id, made from its words the way GitHub makes them, so that
 * a link to `#the-plan` goes to `## The plan` in reader and on GitHub alike
 * (gh-244): lower-cased, with what isn't a letter, a number, `-`, `_` or a
 * space dropped, and each space a `-`. A heading said again gets `-1`, then
 * `-2`, after the first, through the whole document, a deck's slides too.
 *
 * The words are the heading's as read, not as marked: what a feature makes
 * of its line (a box, `{uppercase}`, a `[word]{red}` mark) isn't in them,
 * and neither is an emoji, which GitHub drops. They're taken as soon as the
 * heading's inline text is parsed, before the typographer and the arrows
 * turn `--` and `->` into a dash and an arrow, which GitHub leaves be.
 *
 * In the core rather than a feature, as every heading gets one whatever
 * features draw it, and render() says where each is (`anchors`), for the app
 * to go to one on a page it isn't showing, or in a file it's opening.
 */

import EMOJI from 'markdown-it-emoji/lib/data/full.mjs';
import { unplaced } from '../features/source.js';

const SHORTCODE = /:([a-z0-9_+-]+):/gi;
// The tokens whose words a heading reads as: its text, escaped or not, and its code.
const WORDS = new Set(['text', 'text_special', 'code_inline']);
const IDS = Symbol('anchors');

/** The id GitHub makes from `words`: `The plan!` is `the-plan`. */
export function slug(words) {
  return String(words).trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

/**
 * A heading's words, as read: its inline token's text and code, without a
 * feature's placeholders or an emoji's shortcode.
 */
export function wordsOf(inline) {
  const said = (inline.children ?? []).filter((t) => WORDS.has(t.type)).map((t) => t.content).join('');
  return unplaced(said).replace(SHORTCODE, (code, name) => (EMOJI[name.toLowerCase()] ? '' : code));
}

/**
 * Gives every heading of the page its id, once its inline text is parsed.
 * What's been given, `{ id: line }`, is kept on `env` under a Symbol of its
 * own, and on `env.shared` for the slides after it to go on from; `anchors`
 * reads it.
 */
export function headingIds(md) {
  md.core.ruler.after('inline', 'heading_ids', (state) => {
    if (state.inlineMode || state.env.nested) return;
    const { env } = state;
    const shared = env.shared ?? {};
    // Each id made, by the words that made it, and how many times since.
    const seen = (shared[IDS] ??= new Map());
    const ids = (env[IDS] = {});
    const base = env.lineBase ?? 0;
    state.tokens.forEach((t, i) => {
      if (t.type !== 'heading_open') return;
      const first = slug(wordsOf(state.tokens[i + 1] ?? {}));
      if (!first) return;
      let id = first;
      // As GitHub does: `-1` after the first, and on past one that's taken.
      while (seen.has(id)) {
        seen.set(first, seen.get(first) + 1);
        id = `${first}-${seen.get(first)}`;
      }
      seen.set(id, 0);
      t.attrSet('id', id);
      if (t.map) ids[id] = base + (env.sourceLines?.[t.map[0]] ?? t.map[0]);
    });
  });
}

/** The ids given to a parse's headings, each to its line of the file (0-based). */
export const anchors = (env) => env[IDS] ?? {};
