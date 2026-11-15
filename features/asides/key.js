/**
 * Who an aside is from, and what it's about, by the key its file's front
 * matter declares (features/key.js).
 */

import { ownColor } from '../color.js';

/**
 * The class for something drawn in an alias's colour, a chip, a pill or
 * the words an aside chose: ` gm-own` for a colour an author wrote that
 * isn't the family's, for the page to keep readable (src/columns.css), or ''.
 */
export function ownClass(color) {
  return ownColor(color) ? ' gm-own' : '';
}

/**
 * The run after an aside's `~` -> `{ who, topics, unknown }`: the first
 * reviewer named, the topics, and the alias not in the key, if one isn't;
 * or null when it isn't a run of aliases.
 */
export function attribute(run, key) {
  if (!run || !key?.size) return null;
  const chars = [...run];
  const declared = chars.filter((c) => key.has(c)).length;
  if (!declared || chars.length - declared > 1) return null;
  let who = null;
  const topics = [];
  const unknown = [];
  for (const c of chars) {
    const e = key.get(c);
    if (!e) unknown.push(c);
    else if (e.kind === 'reviewer') who ??= e;
    else if (!topics.includes(e)) topics.push(e);
  }
  return { who, topics, unknown };
}
