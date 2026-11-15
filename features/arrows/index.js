/**
 * `->`, `<-` and `<->` show as arrows. A backslash (`\->`) keeps them as
 * typed, and so does code.
 *
 * Each arrow in the text is drawn in a span of its own, `.arrow`, which a
 * document's `accent:` colours (arrows.css); without one it's the text's.
 * An image's alt text has no spans, only the arrows.
 *
 * Applied to the text once it's parsed, like markdown's own typographic
 * replacements, so what other syntax reads -- a search's query, a link's
 * address -- is still what was typed.
 */

import fs from 'node:fs';

const BOTH = /<->/g;
const RIGHT = /(?<![-<])->/g;
const LEFT = /<-(?![-<>])/g;

const SHOWN = /[\u2190\u2192\u2194]/g;

export function arrows(md) {
  // Before the typographer's own replacements, which make `--` a dash; and
  // before escaped characters join the text around them, so `\->` stays.
  md.core.ruler.before('replacements', 'arrows', (state) => {
    // An image's alt text is its own children's.
    const walk = (children) => {
      for (const t of children) {
        if (t.type === 'text') t.content = t.content.replace(BOTH, '\u2194').replace(RIGHT, '\u2192').replace(LEFT, '\u2190');
        else if (t.children) walk(t.children);
      }
    };
    for (const block of state.tokens) {
      if (block.type === 'inline' && block.children) walk(block.children);
    }
  });
  const text = md.renderer.rules.text;
  md.renderer.rules.text = (...args) => text(...args).replace(SHOWN, '<span class="arrow">$&</span>');
}

export default {
  name: 'arrows',
  plugin: arrows,
  css: fs.readFileSync(new URL('./arrows.css', import.meta.url), 'utf8'),
};
