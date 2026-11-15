/**
 * The key a file's front matter declares: one-
 * character aliases, declared in its front matter, one per line,
 *
 *   -----
 *   reviewer #: Josh
 *   reviewer m: Maria, teal
 *   topic c: Coherence
 *   topic v: Verbs, teal, circle
 *   -----
 *
 * and used in a run straight after an aside's `~`, in any order:
 *
 *   ~#c This contradicts §2.        Josh, about Coherence
 *
 * A colour after the name (a CSS name or `#hex`) is the alias's own, a
 * common name drawn in the family's hue for it (see features/color.js), and a
 * topic can name how it marks the words its asides choose (`circle`,
 * `underline` or `highlight`; see features/mark.js); the
 * rest are dealt from a palette in the order they're declared, reviewers
 * from its start and topics from its end, so the two don't look paired. A run counts when its aliases are
 * declared, all but one at most: that one is taken for a slip of the
 * finger and shown as not declared. So `~word` in a document without a
 * key, or prose that happens to start with a `~` (`~approximately`), is
 * left as it was.
 *
 * Asides reads who an aside is from and what it's about from the key
 * (features/asides/key.js); a mark in braces, `[words]{c}`, reads its
 * topics (features/mark.js), when asides declares the key's lines. Both read it from
 * `env.frontMatter`, by `keyOf` and `topicsOf`, which nothing writes.
 */

import { STYLES } from './mark.js';
import { inFamily } from './color.js';

// The front matter keys the key is declared with: `reviewer #: Josh`, `topic c: Coherence`.
export const KEYS = ['reviewer', 'topic'];

const ENTRY = /^\s*(reviewer|topic)\s+(\S)\s*:\s*(.+?)\s*$/i;
const COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i;

// The family's hues, as features/asides/asides.css names them for a key, which read as
// text on the page, light or dark, and the page on them.
const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--gm-key-${i + 1})`);

/** A front matter line declaring an alias -> `{ kind, alias, name, color, style }`, or null. */
export function readEntry(line) {
  const m = ENTRY.exec(line);
  if (!m || m[2] === '~') return null;
  const [name, ...after] = m[3].split(/\s*,\s*/);
  if (!name) return null;
  let color = null;
  let style = null;
  for (const a of after) {
    if (STYLES.includes(a.toLowerCase())) style ??= a.toLowerCase();
    else if (COLOR.test(a)) color ??= a;
  }
  return { kind: m[1].toLowerCase(), alias: m[2], name, color, style };
}

/** Entries -> the key: each alias to its entry, with every colour filled in. */
export function makeKey(entries) {
  const key = new Map();
  const dealt = { reviewer: 0, topic: 0 };
  for (const e of entries) {
    if (key.has(e.alias)) continue;
    const k = dealt[e.kind]++ % PALETTE.length;
    key.set(e.alias, { ...e, color: inFamily(e.color) || PALETTE[e.kind === 'reviewer' ? k : PALETTE.length - 1 - k] });
  }
  return key;
}

// Each front matter's key, made once however many rules read it.
const made = new WeakMap();

/** A declaration of the key's, when the feature that owns its keys is drawn: asides, today. */
const declaring = (frontMatter) => (frontMatter?.entry ? frontMatter.entry(...KEYS).filter((e) => e.declared) : []);

/**
 * The key `frontMatter` declares (`env.frontMatter`): each alias to its
 * entry, its colour filled in. Without the feature that declares its keys,
 * there's none, and `{c}` is a font, not a topic.
 */
export function keyOf(frontMatter) {
  if (!frontMatter?.entry) return new Map();
  if (!made.has(frontMatter)) made.set(frontMatter, makeKey(declaring(frontMatter).map((e) => readEntry(e.line)).filter(Boolean)));
  return made.get(frontMatter);
}

/** The topics `frontMatter` declares, by alias, for a mark in braces to be in (`[words]{c}`). */
export function topicsOf(frontMatter) {
  return new Map([...keyOf(frontMatter)].filter(([, e]) => e.kind === 'topic'));
}

/** The lines declaring an alias that can't be read, `reviewer ~: Josh`, each `{ key, value, line }`. */
export function unreadOf(frontMatter) {
  return declaring(frontMatter).filter((e) => !readEntry(e.line));
}
