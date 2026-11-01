/**
 * A file's outline, and taking a part of it out into a file of its own.
 *
 * What the outline lists:
 *
 * - With `---` between them, the parts: each one entry, named by its first
 *   heading or, without one, its first line. The `#` to `###` headings
 *   after that are nested under it.
 * - Without `---` (an ideas page), the `#` to `###` headings themselves.
 * - In a talk, `type: slides` in the front matter, the slides,
 *   by their titles, and not the headings inside them. A slide that holds
 *   only a `#` heading, a section's title slide, gathers the slides after
 *   it up to the next one.
 *
 * Front matter is never an entry. Lines are counted from 0; an entry runs
 * from `line` up to, not including, `end`, and `head` is its first line
 * that isn't blank. A heading's entry runs to the
 * next heading at its level or above, and never past the end of its part.
 *
 * No DOM here, so the tests can run it.
 */

import { frontMatter, fenced, typeOf } from '../markdown.js';

const SEPARATOR = /^---[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const DEEPEST = 3;
// What comes before a heading's or an item's words: a box, then braces of
// style names.
const OWN = /^(?:\[[ xX]\][ \t]+)?(?:\{[\w-]+(?:[ \t]+[\w-]+)*\}[ \t]+(?=\S))?/;

/**
 * `{ matter, talk, parts, entries }`: the front matter's lines, whether the
 * file is a talk, each part's `{ line, end }`, and the outline's entries,
 * each `{ title, kind, level, line, end, children }`.
 */
export function outline(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const matter = frontMatter(lines);
  const seen = visible(lines, matter ? matter.end : 0);

  const parts = [];
  let start = matter ? matter.end : 0;
  for (let i = start; i <= lines.length; i++) {
    if (i < lines.length && !(seen[i] !== null && SEPARATOR.test(lines[i]))) continue;
    if (lines.slice(start, i).some((l) => l.trim())) parts.push({ line: start, end: i });
    start = i + 1;
  }

  const headings = [];
  seen.forEach((l, i) => {
    const m = l && HEADING.exec(l);
    // Its box and its own styles (`## [ ] {uppercase} Today`) aren't its title.
    if (m) headings.push({ level: m[1].length, title: plain(m[2].replace(OWN, '')), line: i });
  });

  const talk = parts.length > 1 && typeOf(matter?.meta) === 'slides';

  let entries;
  if (parts.length <= 1) entries = nest(headings.filter((h) => h.level <= DEEPEST), lines.length, 'heading');
  else if (talk) entries = slides(parts, headings, seen);
  else entries = parts.map((p) => part(p, headings, seen));
  const heads = (list) => list.forEach((e) => {
    e.head = e.line;
    while (e.head < e.end - 1 && !lines[e.head].trim()) e.head++;
    heads(e.children);
  });
  heads(entries);
  return { matter, talk, parts, entries };
}

/** Every entry, in the order of the file, with its depth. */
export function flatten(entries, depth = 0, out = []) {
  for (const e of entries) {
    out.push({ ...e, depth });
    flatten(e.children, depth + 1, out);
  }
  return out;
}

/**
 * The entries whose titles match `query`, best first: the words of the
 * title it starts, then where it's found in one, then its letters in order.
 */
export function find(entries, query) {
  const q = query.trim().toLowerCase();
  const all = flatten(entries);
  if (!q) return all;
  const scored = [];
  for (const e of all) {
    const t = e.title.toLowerCase();
    const at = t.indexOf(q);
    let score;
    if (at === 0) score = 3000;
    else if (at > 0) score = (/\W/.test(t[at - 1]) ? 2000 : 1000) - at;
    else {
      let gaps = 0;
      let i = -1;
      for (const c of q) {
        const j = t.indexOf(c, i + 1);
        if (j < 0) { gaps = -1; break; }
        gaps += j - i - 1;
        i = j;
      }
      if (gaps < 0) continue;
      score = 500 - gaps;
    }
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.e);
}

/** A file name from a title: `Spring Security 7!` is `spring-security-7`. */
export function slug(title) {
  const words = String(title).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  let out = '';
  for (const w of words) {
    if (out && out.length + w.length + 1 > 48) break;
    out = out ? `${out}-${w}` : w.slice(0, 48);
  }
  return out || 'section';
}

/**
 * Takes `entries` (from outline(src), not overlapping) out of `src`, each
 * to the file named in `names` beside it. Each leaves a link to its file
 * where it was, and its file starts with the front matter, its `title:`
 * telling where it came from. Returns `{ text, files: [{ name, text }] }`.
 */
export function extract(src, entries, names) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const { matter } = outline(src);
  const order = entries.map((e, i) => ({ e, name: names[i] })).sort((a, b) => b.e.line - a.e.line);
  const files = [];
  for (const { e, name } of order) {
    let a = e.line;
    let b = e.end;
    while (a < b && !lines[a].trim()) a++;
    while (b > a && !lines[b - 1].trim()) b--;
    if (a === b) continue;
    const body = lines.slice(a, b).join('\n');
    const head = matter ? `${retitle(lines.slice(0, matter.end), matter.meta.title, e.title).join('\n')}\n\n` : '';
    files.unshift({ name, text: `${head}${body}\n` });
    lines.splice(a, b - a, `→ [${e.title.replace(/[\\[\]]/g, '\\$&')}](${encodeURI(name)})`);
  }
  return { text: lines.join('\n'), files };
}

/** The front matter's lines, with a `title:` that says which part this is. */
function retitle(block, title, heading) {
  if (!title) return block;
  return block.map((l) => {
    const m = /^([ \t]*title[ \t]*:)[ \t]*(["']?)(.*?)\2[ \t]*$/i.exec(l);
    return m ? `${m[1]} ${m[2]}${m[3]} - ${heading}${m[2]}` : l;
  });
}

/**
 * Each line as it reads outside notes: `null` inside a code fence, where
 * nothing is a heading or a break, and with any `<!-- -->` taken out.
 */
function visible(lines, from) {
  const out = lines.map(() => '');
  const code = fenced();
  let note = false;
  for (let i = from; i < lines.length; i++) {
    const l = lines[i];
    // A fence opens only outside a note.
    if (!note && code(l)) {
      out[i] = null;
      continue;
    }
    let text = '';
    let rest = l;
    while (rest) {
      if (note) {
        const close = rest.indexOf('-->');
        if (close < 0) break;
        note = false;
        rest = rest.slice(close + 3);
      } else {
        const open = rest.indexOf('<!--');
        if (open < 0) { text += rest; break; }
        text += rest.slice(0, open);
        note = true;
        rest = rest.slice(open + 4);
      }
    }
    out[i] = text;
  }
  return out;
}

/** A title as it reads: the marks of emphasis, code and links taken off. */
function plain(s) {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
    .replace(/(\*\*|__|~~|\*|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** What a part with no heading is called: its first line. */
function firstLine(p, seen) {
  for (let i = p.line; i < p.end; i++) {
    const l = seen[i]?.trim();
    if (!l) continue;
    const t = plain(l.replace(/^(?:[-*+]|\d+[.)]|>|~|:::)\s*/, '').replace(OWN, ''));
    if (t) return t.length > 60 ? `${t.slice(0, 59).trimEnd()}…` : t;
  }
  return 'Notes';
}

/** The first heading of a part, if it's the first thing in it. */
function opening(p, headings, seen) {
  const first = seen.findIndex((l, i) => i >= p.line && i < p.end && l?.trim());
  return headings.find((h) => h.line === first) || null;
}

function part(p, headings, seen) {
  const top = opening(p, headings, seen);
  const inside = headings.filter((h) => h.line > p.line && h.line < p.end && h !== top && h.level <= DEEPEST);
  return {
    title: top?.title || firstLine(p, seen), kind: 'part', level: 0, line: p.line, end: p.end,
    children: nest(inside, p.end, 'heading'),
  };
}

/** Headings in a tree, each running to the next at its level or above. */
function nest(headings, end, kind) {
  const roots = [];
  const stack = [];
  headings.forEach((h, i) => {
    const next = headings.slice(i + 1).find((o) => o.level <= h.level);
    const entry = { title: h.title, kind, level: h.level, line: h.line, end: next ? next.line : end, children: [] };
    while (stack.length && stack.at(-1).level >= h.level) stack.pop();
    (stack.at(-1)?.children || roots).push(entry);
    stack.push(entry);
  });
  return roots;
}

/** A talk's slides, each section's under its title slide. */
function slides(parts, headings, seen) {
  const roots = [];
  let section = null;
  for (const p of parts) {
    const top = opening(p, headings, seen);
    const shown = seen.slice(p.line, p.end).filter((l) => l?.trim());
    const entry = { title: top?.title || firstLine(p, seen), kind: 'slide', level: 0, line: p.line, end: p.end, children: [] };
    if (top?.level === 1 && shown.length === 1) {
      section = { ...entry, kind: 'section' };
      roots.push(section);
    } else if (section) {
      section.children.push(entry);
      section.end = p.end;
    } else roots.push(entry);
  }
  return roots;
}
