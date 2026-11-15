/**
 * Reading markdown as it's written, before anything parses it: where the
 * front matter is and what it says, and which lines are fenced code. The
 * server's rendering (src/, features/) and the app (static/app) both read
 * a file this way, so they agree on it; no DOM here, and no Node.
 */

// Front matter is fenced by three or more dashes (`-----` as well as `---`).
const MATTER = /^-{3,}[ \t]*$/;
// `key: value`, the key a word or a few (`title font`), or a kind and a
// character, as an aside's alias is declared (`reviewer #: Josh`).
const ENTRY = /^[ \t]*([A-Za-z][\w -]*?(?:[ \t]+\S)?)[ \t]*:(.*)$/;

/**
 * The front matter at the top of `lines`, or null: fenced by dashes on the
 * first line, and taken only when every line in it is blank or reads as
 * `key: value`, so a file that opens with a `---` rule isn't swallowed to
 * the next. `end` is the line after its closing dashes, and `meta` each key,
 * in lower case, to its value, quotes taken off. A key with no value and
 * indented entries under it holds them, a level deep, as YAML does:
 *
 *   multibox:
 *     stages: have, in place, used
 *
 * is `{ multibox: { stages: 'have, in place, used' } }`.
 *
 * Every line is also kept as written, for `meta.entry(...names)`, which
 * isn't one of its keys: each line with one of those keys, in the order
 * written, as `{ key, value, line, declared }`, the key as written, the
 * value with its quotes off, and whether a feature declared it. A kind names its aliases' keys, so `reviewer`
 * names `reviewer #: Josh`. A key in `keys`, which the features declare
 * as theirs (features/index.js), is read only that way, and isn't one of
 * `meta`'s: `reviewer #` and `reviewer c` can't be told apart once lower
 * cased, nor shown in the byline as written.
 */
export function frontMatter(lines, { keys = [] } = {}) {
  if (!MATTER.test(lines[0] ?? '')) return null;
  const close = lines.findIndex((l, n) => n > 0 && MATTER.test(l));
  if (close < 0) return null;
  const inner = lines.slice(1, close);
  if (!inner.every((l) => !l.trim() || ENTRY.test(l))) return null;
  const meta = {};
  const all = [];
  const declared = keys.map((k) => k.toLowerCase());
  // The key with no value that indented entries go under, if any.
  let parent = null;
  for (const l of inner) {
    if (!l.trim()) continue;
    const m = ENTRY.exec(l);
    if (parent && m && /^[ \t]/.test(l)) {
      if (typeof meta[parent] !== 'object') meta[parent] = {};
      meta[parent][m[1].trim().toLowerCase()] = unquote(m[2].trim());
      continue;
    }
    parent = null;
    if (!m) continue;
    const written = m[1].trim();
    const own = named(written, declared);
    all.push({ key: written, value: unquote(m[2].trim()), line: l, declared: own });
    if (own) continue;
    const key = written.toLowerCase();
    meta[key] = unquote(m[2].trim());
    if (!meta[key] && !/^[ \t]/.test(l)) parent = key;
  }
  return { end: close + 1, meta: withEntries(meta, all) };
}

/**
 * Whether the key `written` is one of `names`, in lower case: the whole
 * key, or a kind with its one-character alias after it (`reviewer #`).
 */
function named(written, names) {
  const k = written.toLowerCase();
  return names.some((n) => k === n || (k.startsWith(n) && /^[ \t]+\S$/.test(k.slice(n.length))));
}

/**
 * `meta`, with `entry(...names)` to read the front matter's lines `all`,
 * as frontMatter's are; not one of its keys, so a spread or JSON of it
 * has only those.
 */
export function withEntries(meta = {}, all = []) {
  const entry = (...names) => all.filter((e) => named(e.key, names.map((n) => n.toLowerCase())));
  return Object.defineProperty(meta, 'entry', { value: entry });
}

const TYPES = ['slides', 'workbook'];

/**
 * What a document says it is, by `type:` in its front matter `meta`:
 * `slides`, to present; `workbook`, a packet to fill in a page at a time;
 * or, without one of those, a `document`. What it does follows from that,
 * and nothing is guessed from its `---` breaks or its speaker notes.
 */
export function typeOf(meta) {
  const type = String(meta?.type ?? '').trim().toLowerCase();
  return TYPES.includes(type) ? type : 'document';
}

function unquote(v) {
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

// A fence's opening line, after the `>` of any blockquotes it's in and the
// markers of any list items; and the line that closes it.
const FENCE = /^((?:[ \t]*>)*)([ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)*)(`{3,}|~{3,})/;
const QUOTES = /^(?:[ \t]*>)*/;
const CLOSING = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;

/**
 * A reader of lines in turn, saying whether each is fenced code: a fence's
 * opening line, what's in it, or its closing line. A fence may be in a
 * blockquote or a list item, and ends with it: at a line with fewer `>`, or,
 * in a list item, at one indented less than the fence. A line indented as
 * code that reads as a fence is taken for one too, which it is, as code.
 */
export function fenced() {
  let fence = null;
  return (line) => {
    const quotes = (QUOTES.exec(line)[0].match(/>/g) ?? []).length;
    if (fence) {
      const rest = line.replace(QUOTES, '');
      const indent = /^[ \t]*/.exec(rest)[0].length;
      const out = quotes < fence.quotes || (fence.column != null && rest.trim() && indent < fence.column);
      if (!out) {
        const c = CLOSING.exec(rest);
        if (c && quotes === fence.quotes && c[1][0] === fence.mark[0] && c[1].length >= fence.mark.length) fence = null;
        return true;
      }
      fence = null;
    }
    const f = FENCE.exec(line);
    if (!f) return false;
    // Out of a list and not indented as code, a fence's lines may be indented less than it is.
    const inList = f[2].length > 3 || /[-*+\d]/.test(f[2]);
    fence = { mark: f[3], quotes, column: inList ? f[2].length : null };
    return true;
  };
}
