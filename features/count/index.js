/**
 * Counts that scale: `count:` before an amount marks it as one, and
 * `multiplier:[]` sets buttons that multiply every count in its section --
 * the heading it's under, to the next heading at that level or above.
 *
 *   ## Akara
 *   Serves: count:4
 *   multiplier:[]
 *
 *   * count:2 cups dried black-eyed peas
 *   * count:1–2 fresh chili peppers
 *
 * The buttons are 1×, 2× and 3×, or those written in the brackets
 * (`multiplier:[1/2, 2, 4]`), 1× always among them. An amount is a whole
 * number, a fraction (`1/2`, `1 1/2`, `½`), a decimal or a range of them
 * (`1–2`, `2 to 3`), and it's multiplied as written: `1/2` three times is
 * `1 1/2`. A number without `count:` -- 5 minutes, 2 inches of oil -- stays
 * as it is, and so does a count in a section with no multiplier.
 *
 * Each count carries what it reads at each of its section's multiples
 * (`data-by`), and the preview swaps them in (preview.js); which is picked
 * is the reader's, not the file's, kept for the document and section
 * (`data-key`) by the page around the frame (static/views.js).
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemeRule } from '../scheme.js';
import { sections, multipliers, escapeHtml, escapeAttr } from '../source.js';
import { AMOUNT, multiply, readChoices } from './amount.js';

// What this feature keeps across a deck's slides, on `env.shared`, under a key
// no other feature can name (gh-282).
const COUNTS = Symbol('multipliers');

const BEFORE = /[\w\\]/;

export function counts(md) {
  md.inline.ruler.before('linkify', 'count', (state, silent) => {
    const colon = state.pos;
    if (state.src.charCodeAt(colon) !== 0x3A /* : */) return false;
    const start = colon - 'count'.length;
    if (start < 0 || state.src.slice(start, colon) !== 'count' || !state.pending.endsWith('count')) return false;
    if (start > 0 && BEFORE.test(state.src[start - 1])) return false;
    const m = AMOUNT.exec(state.src.slice(colon + 1, state.posMax));
    if (!m) return false;
    if (!silent) {
      state.pending = state.pending.slice(0, -'count'.length);
      const count = state.push('count', 'span', 0);
      count.content = m[0];
      count.meta = { amount: [...m] };
    }
    state.pos = colon + 1 + m[0].length;
    return true;
  });

  schemeRule(md, {
    name: 'multiplier',
    scheme: 'multiplier',
    path: /(?:)/,
    make: (state, where, label) => {
      const choices = readChoices(label);
      if (!choices) return false;
      if (state) state.push('multiplier', 'span', 0).meta = { choices };
      return true;
    },
  });

  // Each multiplier takes its section, and each count the multiplier of the
  // nearest section around it that has one.
  md.core.ruler.push('count_sections', (state) => {
    if (state.inlineMode) return;
    const { of } = sections(state);
    const shared = state.env.shared ?? state.env;
    const { bySection, nearest } = multipliers(state, of);
    for (const [section, meta] of bySection) {
      meta.id = shared[COUNTS] = (shared[COUNTS] ?? 0) + 1;
      meta.key = `${state.env.file ?? ''}#${section.title}`;
    }
    state.tokens.forEach((block, i) => {
      for (const t of block.children ?? []) if (t.type === 'count') t.meta.multiplier = bySection.get(nearest(of[i]));
    });
  });

  md.renderer.rules.count = (tokens, i) => {
    const { amount, multiplier } = tokens[i].meta;
    const typed = amount[0];
    if (!multiplier) return `<span class="count">${escapeHtml(typed)}</span>`;
    const by = Object.fromEntries(multiplier.choices.map((c) => [c.by, multiply(amount, c.by)]));
    return `<span class="count" data-multiplier="${multiplier.id}" data-by="${escapeAttr(JSON.stringify(by))}">${escapeHtml(typed)}</span>`;
  };

  md.renderer.rules.multiplier = (tokens, i, options, env) => {
    const { choices, id, key } = tokens[i].meta;
    // Only a section's first: a second would have no counts of its own. An
    // exported page has no script to press it with, and its counts are as
    // written.
    if (!id || env.drawing?.for === 'export') return '';
    const buttons = choices.map((c) => `<button type="button" class="multiply" data-by="${c.by}" aria-pressed="${c.by === 1}">${escapeHtml(c.label)}</button>`);
    return `<span class="multiplier" role="group" aria-label="Multiply the amounts" data-multiplier="${id}" data-key="${escapeAttr(key)}">${buttons.join('')}</span>`;
  };
}

export default {
  name: 'count',
  plugin: counts,
  css: fs.readFileSync(new URL('./count.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
