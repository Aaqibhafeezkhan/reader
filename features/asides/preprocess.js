/**
 * Source-level pass that lifts asides out of a document *before* the
 * markdown block parser runs, once the page's front matter and comments are
 * off (src/page.js), and before any other feature reads the lines: an aside
 * is exactly its own `~` lines, so what's left is the page as if it had
 * never been annotated, and no other feature need know an aside's syntax.
 *
 * This is the heart of the extension. An aside is a marginal thought, so it
 * must not change the shape of the thing it is written beside. If the `~` line
 * were left in place, the block parser would read it as ordinary content and it
 * would terminate the list item it sits inside, split a paragraph, or reset a
 * numbered list. By removing aside lines here, the speaker's outline parses
 * exactly as it would have if you had never annotated it, and each aside keeps
 * an anchor -- the line of the cleaned source it was written after -- so it can
 * be re-attached once the structure is known.
 */

import { attribute } from './key.js';
import { STYLES } from '../mark.js';
import { fenced } from '../source.js';

// A `~` on its own, or followed by whitespace. `~~strike~~` and the `~~~` fence
// are both excluded by requiring the next character not to be another tilde.
// A run of aliases may come between the `~` and the space (see key.js), and
// after them the words in the line above it's about, in brackets, with how
// to mark them in braces (see marks.js): `~v[jumped]{circle}`.
const ASIDE_RE = new RegExp(String.raw`^([ \t]*)~(?!~)([^\s~[]*)(?:\[((?:[^\]\\\n]|\\.)+)\](?:\{(${STYLES.join('|')})\})?)?([ \t]+.*)?$`, 'i');

// A reply, `~~` at the start of a line and then a space or a run of aliases
// (`~~c Yes.`): an answer to the aside above it, in its thread. `~~strike~~`
// has no space after its run, and `~~~` is a fence.
const REPLY_RE = /^([ \t]*)~~([^\s~[]*)([ \t]+.*)?$/;

// A box straight after an aside's aliases, `~# [ ]`, as after a heading's
// hashes: the thread can be resolved, and `[x]` says it is.
const BOX_RE = /^\[([ xX])\](?=\s|$)[ \t]*/;

/** Is `line` a reply, and if so, whose: `{ m, by }`. */
function replyOf(line, key) {
  const m = REPLY_RE.exec(line);
  if (!m || !m[3]?.trim()) return null;
  if (!m[2]) return { m, by: null };
  const by = attribute(m[2], key);
  return by ? { m, by } : null;
}

/**
 * Is `line` an aside, and if so, whose and about what: `{ by, select }`,
 * with `by` null for the writer's own and `select` null when it names no
 * words.
 */
function asideOf(line, key) {
  const m = ASIDE_RE.exec(line);
  if (!m) return null;
  const select = m[3] == null ? null : selection(m[3], m[4]);
  if (!m[2]) return { m, by: null, select };
  const by = attribute(m[2], key);
  return by ? { m, by, select } : null;
}

/** `the#2` -> `{ text: 'the', nth: 2, style }`: the second `the`. */
function selection(written, style) {
  const n = /#(\d+)$/.exec(written);
  const text = (n ? written.slice(0, n.index) : written).replace(/\\(.)/g, '$1');
  return { text, nth: n ? Number(n[1]) : 1, style: style?.toLowerCase() ?? null };
}

/**
 * The page's asides, kept on `env` under a key no other feature can name
 * (gh-282). Another feature reads an aside's notes in the margin
 * (`env.margin`) and the topics (`topicsOf`, features/key.js), not these.
 */
export const ASIDES = Symbol('asides');

/**
 * @param {string} src the page's source, its front matter and comments off
 * @param {Map} [key] the aliases declared (see key.js)
 * @returns {{source: string, asides: Array<{anchor: number, text: string, line: number}>, lines: number[]}}
 *   `source` is `src` with the aside lines removed;
 *   `anchor` is an index into `source`'s lines -- the aside belongs immediately
 *   before that line; `line` is the aside's 0-based line in `src`.
 *   `lines` has, for each line of `source`, the 0-based line of `src`
 *   it came from, so positions in `source` can be traced back to it.
 *   An aside written with the key's aliases
 *   has `by: { who, topics, unknown }`. One naming words in brackets
 *   has `select: { text, nth, style }`, and `within` when it's written
 *   straight under the line they're in. One with a box after its aliases
 *   has `box: { checked, on, off }`, its line ticked and not; and one
 *   answered has `replies`, each `{ text, line, lines, prefixes, by }`.
 *   Each aside's and reply's `lines` has, for each line of its `text`, the
 *   line of `src` it's on, and `prefixes` what comes before it on that line,
 *   its mark and aliases, for a feature that writes a line back
 *   (features/source.js's `noteEnv`).
 */
export function preprocess(src, key = new Map()) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  const out = [];
  const from = [];
  const asides = [];
  const code = fenced();

  while (i < lines.length) {
    const line = lines[i];

    // Never look inside fenced code.
    if (code(line)) {
      out.push(line);
      from.push(i);
      i++;
      continue;
    }

    const found = asideOf(line, key);
    if (!found) {
      out.push(line);
      from.push(i);
      i++;
      continue;
    }

    // An aside written straight under a line of text, rather than after a
    // blank, comments on that line from inside its paragraph: the line after
    // it is the paragraph going on, not the aside wrapping, and a blank after
    // it still ends the paragraph.
    const within = out.length > 0 && out[out.length - 1].trim() !== '';

    // Collect the aside: its first line, and the lines straight under it
    // with the same mark, read as a quote's `>` lines are (see `carryOn`).
    const am = found.m;
    const startLine = i;
    let first = (am[5] || '').trimStart();
    // A box after its aliases makes it a thread that can be resolved: the
    // line as written, ticked and not, for the page to write back.
    const box = BOX_RE.exec(first);
    if (box) first = first.slice(box[0].length);
    const body = { text: [first], lines: [i], prefixes: [line.slice(0, line.length - first.length)] };
    i = carryOn(i, (next) => {
      const m = asideOf(next, key)?.m;
      if (!m || m[2] !== am[2] || m[3] != null) return null;
      const rest = m[5] ?? '';
      return BOX_RE.test(rest.trimStart()) ? null : rest;
    }, body);
    const aside = {
      anchor: out.length,
      text: body.text.join('\n').replace(/\s+$/, ''),
      line: startLine,
      lines: body.lines,
      prefixes: body.prefixes,
      ...(found.by && { by: found.by }),
      ...(found.select && { select: found.select, within }),
      ...(box && { box: boxOf(line, box[1] !== ' ') }),
    };

    // Its replies, each `~~` straight under it or under the last, with the
    // same lines of their own: one thread, flat, as the replies to a comment.
    const replies = [];
    for (let r; i < lines.length && (r = replyOf(lines[i], key));) {
      const at = i;
      const said = (r.m[3] || '').trimStart();
      const words = { text: [said], lines: [at], prefixes: [lines[at].slice(0, lines[at].length - said.length)] };
      i = carryOn(i, (next) => {
        const m = REPLY_RE.exec(next);
        return m && m[2] === r.m[2] ? m[3] ?? '' : null;
      }, words);
      replies.push({ text: words.text.join('\n').replace(/\s+$/, ''), line: at, lines: words.lines, prefixes: words.prefixes, ...(r.by && { by: r.by }) });
    }
    if (replies.length) aside.replies = replies;

    // Swallow one blank line after the aside so removing it does not leave a
    // double blank that would loosen or split the surrounding list -- unless
    // there was none before it, when that blank is all that keeps what comes
    // next from joining the paragraph above.
    if (!within && i < lines.length && !lines[i].trim()) i++;

    asides.push(aside);
  }

  /**
   * The lines that carry on an aside or a reply that starts on `lines[at]`:
   * each straight under it with the same mark and aliases, as a quote's
   * lines each start with `>`. `same(line)` says what follows the mark on
   * one, or null for a line that doesn't carry it on, which ends it. Like a
   * quote's, a line's words, one space off, join the line before's
   * paragraph, and one with the mark alone starts the next paragraph.
   * Nothing else carries it on: a line with no mark is the page's own.
   * Pushes each onto `body`, with its line and what comes before its words
   * there, and returns the line after them.
   */
  function carryOn(at, same, body) {
    let k = at + 1;
    for (let rest; k < lines.length && (rest = same(lines[k])) != null; k++) {
      const words = rest.replace(/^[ \t]/, '');
      body.text.push(words);
      body.lines.push(k);
      body.prefixes.push(lines[k].slice(0, lines[k].length - words.length));
    }
    return k;
  }

  return { source: out.join('\n'), asides, lines: from };
}

/** An aside's box: whether it's ticked, and its line both ways, `on` and `off`. */
function boxOf(line, checked) {
  const at = (mark) => line.replace(/^([ \t]*~[^\s~[]*[ \t]+)\[[ xX]\]/, `$1[${mark}]`);
  return { checked, on: at('x'), off: at(' ') };
}
