/**
 * A document's own accent, from its front matter:
 *
 *   ---
 *   accent: seagreen
 *   ---
 *
 * What reader draws in its accent takes the document's instead: links,
 * checkboxes and radios, a field's focused line, callouts' rules, progress
 * bars, a timer's digits, and the rest. One colour is given, a CSS colour
 * name or a `#hex`, and each theme draws its own version of it: the page's
 * stylesheet keeps it to the family's lightness, as it does any colour an
 * author gives (src/columns.css), so it's darker in the light and brighter
 * in the dark where it has to be, and it keeps its hue.
 *
 * The colour is set as `--own-accent` in the page's stylesheet, never as
 * `--gm-accent`: the stylesheet makes the accent from it, so the clamp
 * always applies, and the system's own colours (forced-colors) still win.
 */

import { COLORS } from '../features/names.js';

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `SeaGreen`, or a `#hex` in quotes or not -> the colour, in lower case, or null when it isn't one. */
export function readAccent(value) {
  const text = String(value ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim().toLowerCase();
  return COLORS.has(text) || HEX.test(text) ? text : null;
}

/** The stylesheet for front matter's `accent:`, or `''` for none. */
export function accentCss(meta = {}) {
  const color = readAccent(meta.accent);
  return color ? `:root { --own-accent: ${color}; }` : '';
}
