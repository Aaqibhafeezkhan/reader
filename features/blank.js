/**
 * Blanks: a place on the page to write into, as a form field is
 * (features/fields) and as a term heard but not yet looked up is
 * (features/definitions). Any feature can draw one, as
 *
 *   <span class="field" data-line data-text data-head>
 *     <span class="field-value" data-value ...typable(label, env)>value</span>
 *   </span>
 *
 * `data-line` is the line it's on, `data-text` that line as written, and
 * `data-head` what goes before the value when it's written back (`@ Notes:`,
 * `!SLAB:`). A blank can say what goes in it while it's empty, its hint
 * (`hinted`). The fields feature's preview opens any blank for typing and
 * writes `head value` back to its line. Without fields, a blank is only read.
 *
 * And whether a page can be worked at all, where it's drawn, is asked here,
 * so that every feature drawing something to fill in or pick gets the same
 * answer. In the preview frame the same answer is `Preview.workable`
 * (static/preview-api.js), which every feature's clicks and keys go by,
 * and whether the page is a record is `Preview.closed`.
 */

import { escapeAttr, escapeHtml } from './source.js';

/**
 * Is the page a record now, past the time it was open until? A feature that
 * reads that time says so, on `env.closed` (src/page.js asks each feature's
 * `closes`, and judges it by `env.now`). A record shows what was filled in,
 * and nothing more: not a hint of what would have gone in a blank.
 */
export const closed = (env) => Boolean(env.closed);

/**
 * Can the page be worked where it's drawn -- a blank filled in, a date
 * picked? Not on a slide, which the deck keeps shut, nor on an exported
 * page, which has no script to do it with, nor once it's a record.
 */
export const workable = (env) => !env.exported && !env.deck && !closed(env);

/**
 * A box's or a choice's attribute where the page can't be worked, as on a
 * slide or in a record: `disabled`, so it's drawn as it stands and read
 * with its state, but can't be reached or changed. An exported page keeps
 * its boxes as they are, unless it's a record: one ticks there without a
 * script, for whoever has the page, though nothing is saved.
 */
export const shut = (env) => (workable(env) || (env.exported && !closed(env)) ? '' : ' disabled');

/**
 * A blank's attributes, so it can be reached by the keyboard and is read as
 * a box named `label`: the preview opens it for typing when it's focused.
 * Where it can't be filled in, it's only read, as its label and its value.
 */
export function typable(label, env) {
  return workable(env) ? ` tabindex="0" role="textbox" aria-label="${escapeAttr(label)}"` : '';
}

/**
 * A blank's hint, what goes in it (`e.g. 7.5`): `data-hint`, which the
 * stylesheet shows faint in it while it's empty, and where it can be typed
 * in, `aria-placeholder`, so it's heard as a box's placeholder is, after
 * its name. Where it can't be, `unfilled` says it. Not part of its label,
 * so not of its name. Shown wherever the blank is empty, worked or not: on
 * a slide or an exported page it still says what goes there. Not in a
 * record, where an empty blank was left empty.
 */
export function hinted(hint, env) {
  if (!hint || closed(env)) return '';
  const h = escapeAttr(hint);
  return workable(env) ? ` data-hint="${h}" aria-placeholder="${h}"` : ` data-hint="${h}"`;
}

/**
 * Where a blank can't be filled in, an empty one says so to a screen reader
 * ("Thoughts: blank"), unseen, and what goes there, if it's hinted
 * ("Hours: blank, e.g. 7.5"), unless it's a record's. Kept out of the blank
 * itself, which is drawn by whether it's empty.
 */
export function unfilled(value, env, hint = '') {
  if (value || workable(env)) return '';
  if (closed(env)) return '<span class="field-blank">blank</span>';
  return `<span class="field-blank">blank${hint ? `, ${escapeHtml(hint)}` : ''}</span>`;
}
