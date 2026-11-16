/**
 * Helpers for features that read the source as written.
 *
 * Some syntax has to be found in the file before anything else reads it --
 * a checkbox or a field remembers the line it was written on, and the line
 * as written, to be edited later -- even when it ends up in an aside, which
 * is parsed apart from the rest. Such a feature reads each line first
 * (`readLines`, as a core rule before the page's `page_extract`), keeps
 * what it found on `env`, and leaves a placeholder in the text: a number
 * between two private-use characters, which markdown passes through
 * untouched. Once the text is parsed, it turns its placeholders into tokens
 * (`splitText`).
 */

import { frontMatter, fenced, withEntries } from '../static/markdown.js';

export { frontMatter, fenced, withEntries };

/**
 * Adds `rule` to read the source as written, before the page's front matter
 * and comments come off (`page_extract`, src/page.js), and so before any
 * feature takes lines out of it (an aside's); or after normalizing it when
 * there's no such rule (a test of the feature alone).
 */
export function beforeExtract(md, name, rule) {
  try {
    md.core.ruler.before('page_extract', name, rule);
  } catch {
    md.core.ruler.after('normalize', name, rule);
  }
}

/**
 * Keeps the source's lines as written in `env.written`, ahead of every
 * feature that reads the lines and may change them, for a feature that
 * writes one back.
 */
export function keepWritten(md) {
  if (md.core.ruler.__find__('written') >= 0) return;
  md.core.ruler.after('normalize', 'written', (state) => {
    if (!state.inlineMode && !state.env.nested) state.env.written = state.src.split('\n');
  });
}

/**
 * Runs `fn(line, n, lines, i)` over each line of the source outside fenced
 * code, and puts back what it returns; `lines` are the source's lines as
 * they were, `i` this one's index among them. Skipped for a nested parse
 * (`env.nested`: its lines were read with the rest) and for inline rendering. The line numbers count
 * from `env.lineBase`, the line of the file the text starts on.
 */
export function readLines(state, fn) {
  if (state.inlineMode || state.env.nested) return;
  const base = state.env.lineBase ?? 0;
  const code = fenced();
  const lines = state.src.split('\n');
  state.src = lines.map((line, n) => (code(line) ? line : fn(line, base + n, lines, n))).join('\n');
}

/**
 * The private-use characters each feature marks the text with, in one
 * table so no two pick the same: a placeholder's two, or a marker's one.
 */
export const MARKS = {
  tasks: ['\uE000', '\uE001'],
  styles: ['\uE002', '\uE003'],
  // A list item's own styles, on its first line; a `:::` block's background's start and end (features/styles).
  items: ['\uE004', '\uE005'],
  box: ['\uE008', '\uE009'],
  attributions: ['\uE007'],
  sizes: ['\uE00E', '\uE00F'],
  fields: ['\uE010', '\uE012'],
  date: ['\uE013', '\uE014'],
  // A layout block's start, a divider between its parts, and its end (layout.js).
  layout: ['\uE021', '\uE022', '\uE023'],
  definitions: ['\uE030', '\uE031'],
};

/**
 * The names features share on `env`, which each of them may read and some
 * may write: `state.env.sourceLines` in a parsing rule, `env.sourceLines` in
 * a renderer rule. `env` is markdown-it's: the object passed to
 * `md.render(src, env)`, which every rule of one render is handed.
 *
 * Words, as the code uses them: the page is what's drawn, the whole of it;
 * a part is what's between two `---` (a slide, or one of a workbook's
 * pages) when it's drawn on its own; and the file, or the source, is the
 * markdown as written.
 *
 * Please take care to:
 *
 *   1. not add a name without strong justification: a name every feature
 *      can read is one every feature can come to rely on;
 *   2. keep your feature's own state on `env` under a key only it can
 *      name, `const KEY = Symbol('<feature>')`, then `state.env[KEY]`;
 *   3. read another feature's work by way of its tokens: add its name to
 *      your descriptor's `requires` (features/index.js), which puts your
 *      feature after it, and read its tokens in a core rule
 *      (`md.core.ruler.push`), which then runs after its own.
 *
 * If you add a name, add it here, with its type, what it holds, and how to
 * read and write it. Expect other features to write to it too, and don't
 * expect it to hold anything yet when your rule runs, unless it says it's
 * set before every rule.
 *
 * If you've come here to work with another feature's information, go to
 * that feature's documentation instead, for the tokens it makes and what's
 * in their `meta`. If you're using a name here to coordinate directly with
 * one other feature, it's likely time to rethink what each one exposes, or
 * what each reads, and why.
 *
 * Each name says how it's read, `read`, and how it's written, `write`, or
 * null where features may only read it. Lint fails on a feature that sets
 * a name not here, or one whose `write` is null (`reader/feature-tangle`,
 * eslint.config.js).
 */
export const SHARED_ENV = [

  // --- Set by render() from its options, before every rule (src/render.js) ---

  {
    name: 'lineBase',
    type: 'number',
    description: 'the line of the file the source starts on, from 0; 0 unless the source is a part',
    read: 'const fileLine = env.lineBase + (env.sourceLines?.[t.map[0]] ?? t.map[0]); // src/render.js',
    write: null,
  },
  {
    name: 'file',
    type: 'string | undefined',
    description: 'the file\'s path, from the folder reader was opened on, with `/` between folders; undefined with no file (a test)',
    read: 'const folder = path.posix.dirname(env.file || \'\'); // features/puzzles',
    write: null,
  },
  {
    name: 'read',
    type: '((path: string) => string) | undefined',
    description: 'reads another file in the folder reader was opened on, by its path from there; undefined unless the server allows it, and throws for a file it can\'t read',
    read: 'const text = env.read?.(path.posix.join(folder, \'mazes/one.maze\')); // features/puzzles',
    write: null,
  },
  {
    name: 'drawn',
    type: '{ [feature: string]: unknown } | undefined',
    description: 'what the preview frame drew, by feature, each in a shape of that feature\'s own, so that an export, which runs none of the app\'s scripts, can show it anyway (src/export.js)',
    read: 'const svg = env.drawn?.mermaid?.[text]; // features/mermaid',
    write: null,
  },
  {
    name: 'drawing',
    type: '{ for: \'preview\' | \'present\' | \'export\', what: \'file\' | \'part\' }',
    description: 'what the page is drawn for (the app\'s preview, a slide presented, or an export, a file that runs none of the app\'s scripts), and whether it\'s the whole file or a part of it',
    read: 'if (env.drawing.for === \'export\') return `<span class="timer">${said}</span>`; // features/timer',
    write: null,
  },
  {
    name: 'now',
    type: 'number | undefined',
    description: 'the time, in ms, that the page is drawn as of; undefined for now',
    read: 'const at = env.now ?? Date.now();',
    write: null,
  },
  {
    name: 'shared',
    type: 'object',
    description: 'kept across the renders of one file\'s parts, a deck\'s slides, to number things through the whole file; each feature keeps its own entry in it under a Symbol of its own',
    read: 'const seen = env.shared?.[KEY];',
    write: 'only to make it, for a render given none, and then only under your own Symbol: '
      + 'const shared = env.shared ?? (env.shared = {}); shared[KEY] ??= 0; // features/puzzles',
  },

  // --- Set by page_extract, the first rule after normalizing, before any feature reads the lines (src/page.js) ---

  {
    name: 'frontMatter',
    type: '{ [key: string]: string | { [key: string]: string } }, with entry(...keys) => Array<{ key: string, value: string, line: string }>',
    description: 'the front matter\'s keys, in lower case, to their values, quotes off, and indented keys a level deep (`multibox: stages:`); a part\'s is its file\'s. A key a feature declares (its descriptor\'s `keys`) isn\'t one of them: every line, declared or not, is read by entry(), in the order written',
    read: 'const stages = env.frontMatter.multibox?.stages; // features/tasks\n'
      + 'const aliases = env.frontMatter.entry(\'reviewer\', \'topic\'); // features/asides',
    // The date feature puts back the dates it took out of its values, which is its own to undo.
    write: null,
  },
  {
    name: 'closed',
    type: 'boolean',
    description: 'whether the page is past the earliest time any feature\'s `closes(frontMatter)` says, by `now`: a record, which can\'t be worked',
    read: 'if (closed(env)) return \'\'; // features/blank.js, which features call rather than read this',
    write: null,
  },
  {
    name: 'sourceLines',
    type: 'number[]',
    description: 'for each line of the text the parser sees, the line of the source it came from, both from 0, once the front matter, comments and asides are out',
    read: 'const fileLine = env.lineBase + (env.sourceLines?.[n] ?? n);',
    write: 'only by a feature that takes lines out of the text, to keep it in step: '
      + 'const before = state.env.sourceLines ?? []; state.env.sourceLines = kept.map((k) => before[k] ?? k); // features/asides',
  },

  // --- Written by features, for the others and the core ---

  {
    name: 'nested',
    type: 'boolean | undefined',
    description: 'true while an aside\'s own text is parsed, apart from the file\'s; a rule over the whole file skips it',
    read: 'if (state.inlineMode || state.env.nested) return;',
    write: 'on a copy, never on env itself: md.parse(text, { ...env, nested: true }); // features/asides',
  },
  {
    name: 'written',
    type: 'string[] | undefined',
    description: 'the file\'s lines as typed, before any feature changed them; there only if a feature asked for it with keepWritten(md) (features/source.js)',
    read: 'const typed = state.env.written?.[i] ?? line; // features/date',
    // keepWritten(md), at the top of features/, sets it; a feature calls that in its plugin.
    write: null,
  },
  {
    name: 'margin',
    type: 'Array<{ anchor: number, render: (attrs: string) => string }> | undefined',
    description: 'the notes set in the margin, each beside the line of the parsed text it comes before (`anchor`), its HTML given the attributes of the block it\'s beside (src/columns.js); asides\' are the only ones today',
    read: 'const count = env.margin?.length ?? 0; // src/render.js',
    write: 'env.margin = [...(env.margin ?? []), { anchor, render: (attrs) => html }];',
  },
  {
    name: 'masthead',
    type: 'string[] | undefined',
    description: 'HTML set in the masthead, under the title, in order; a masthead is drawn only for a whole file',
    read: 'none but the core\'s (src/columns.js)',
    write: 'env.masthead = [...(env.masthead ?? []), html]; // features/asides, its legend',
  },
  {
    name: 'byline',
    type: 'string[] | undefined',
    description: 'HTML put at the end of the byline, in order',
    read: 'none but the core\'s (src/columns.js)',
    write: 'env.byline = [...(env.byline ?? []), html]; // features/open-until, its notice',
  },
];

/**
 * The tags a feature may leave on a token's `meta` for the others to read,
 * named for what they mean rather than for the feature that set them:
 *
 * - `done`: the token is a thing to be done, a box, and whether it is (true
 *   or false), with the `line` it's on; a choice isn't one. What counts
 *   what's done counts these (`progress:[]`), whichever feature drew them.
 * - `answered`: the token is a question, choices of which one is to be
 *   picked, and whether one is (true or false); on the page it carries
 *   `data-answered`. What says whether a page is done (Work's dots), or
 *   how far along a section is (`progress:[]`), counts these with the
 *   things to be done.
 * - `anchor`: the id to link to the block by, `#1.d`, which it's given
 *   unless a heading, or a block before it, has it (src/anchors.js); a
 *   badged list's item says its badges.
 * - `notExported`: draw nothing for the token on an exported page, because
 *   another feature already shows there what it says, and nothing on that
 *   page could change it (a step's box, whose badge says whether it's done).
 * - `byline`: the block says who said the one before it, and goes with it
 *   (a quote's attribution); a note beside them is level with the words.
 * - `noteAttrs`: the attributes a note in the margin beside the block
 *   carries (` data-in-tab="2"`, for a block in a tab, to show with it).
 */

/** `s` with any placeholders taken out, for the words alone. */
export const unplaced = (s) => s.replace(/[\uE000-\uF8FF]\d*[\uE000-\uF8FF]?/g, '');

/** The placeholder for item `k`, between `open` and `close`. */
export const placeholder = (open, close, k) => `${open}${k}${close}`;

/**
 * Splits each text child of each inline token at the placeholders `pattern`
 * finds (a global regex whose first group is the number), putting
 * `make(k, state)` in their place: a token, or null to leave the text.
 */
export function splitText(state, pattern, make) {
  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children) continue;
    block.children = block.children.flatMap((child) => (child.type === 'text' ? split(state, child, pattern, (m) => make(Number(m[1]), state)) : [child]));
  }
}

/**
 * `child`'s text split at each match of `pattern` (a global regex),
 * `make(m)` in its place: a token, or null to leave the match as text.
 * The child itself, alone, if nothing was made.
 */
export function split(state, child, pattern, make) {
  const out = [];
  let last = 0;
  // matchAll starts from the pattern's lastIndex.
  pattern.lastIndex = 0;
  for (const m of child.content.matchAll(pattern)) {
    const made = make(m);
    if (!made) continue;
    if (m.index > last) out.push(textToken(state, child.content.slice(last, m.index)));
    out.push(made);
    last = m.index + m[0].length;
  }
  if (!last) return [child];
  if (last < child.content.length) out.push(textToken(state, child.content.slice(last)));
  return out;
}

/** Calls `fn` on each text child of `inline` outside a link, putting in its place what it returns. */
export function eachText(inline, fn) {
  const out = [];
  let link = 0;
  for (const child of inline.children ?? []) {
    if (child.type === 'link_open') link++;
    if (child.type === 'link_close') link--;
    out.push(...(child.type === 'text' && !link ? fn(child) : [child]));
  }
  inline.children = out;
}

/** `s` with what a regex reads as syntax escaped, to match as written. */
export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A text token saying `content`. */
export function textToken(state, content) {
  const t = new state.Token('text', '', 0);
  t.content = content;
  return t;
}

/** `&`, `<`, `>` and `"` escaped, for text. */
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The same, for an attribute's value. A raw `>` would be valid there, but
 * later passes find tags with `<[^>]*>` and would end the tag at it.
 */
export const escapeAttr = escapeHtml;

/**
 * Adds `name` to a token's classes, after any it has; a token that had none
 * gets its class attribute first, as markdown writes it.
 */
export function addClass(token, name) {
  const had = token.attrGet('class');
  if (had) token.attrSet('class', `${had} ${name}`);
  else token.attrs = [['class', name], ...(token.attrs || [])];
}

/**
 * The sections of a parse, as its headings make them: `list` holds each,
 * `{ level, title, line, end, parent }`, the document's own first (level 0,
 * from its first line); `of[i]` is the section token `i` is in, a heading in
 * its own. `line` is where the section starts in the file and `end` where
 * the next heading at its level or above does (Infinity for none).
 */
export function sections(state) {
  const base = state.env.lineBase ?? 0;
  const lineOf = (t) => base + (state.env.sourceLines?.[t.map[0]] ?? t.map[0]);
  const top = { level: 0, title: '', line: base, end: Infinity, parent: null };
  const list = [top];
  const of = [];
  let at = top;
  state.tokens.forEach((t, i) => {
    if (t.type === 'heading_open' && t.map) {
      const level = Number(t.tag.slice(1));
      const line = lineOf(t);
      for (; at.level >= level; at = at.parent) at.end = line;
      const title = unplaced(state.tokens[i + 1]?.content ?? '').trim();
      at = { level, title, line, end: Infinity, parent: at };
      list.push(at);
    }
    of[i] = at;
  });
  return { list, of, lineOf };
}

/**
 * The multipliers of a parse's sections (features/count), `of` being
 * `sections(state).of`: `bySection` holds each section's first, in document
 * order, and `nearest(section)` is the nearest section around `section`,
 * itself first, that has one (null for none).
 */
export function multipliers(state, of) {
  const bySection = new Map();
  state.tokens.forEach((block, i) => {
    for (const t of block.children ?? []) if (t.type === 'multiplier' && !bySection.has(of[i])) bySection.set(of[i], t.meta);
  });
  const nearest = (section) => {
    for (let s = section; s; s = s.parent) if (bySection.has(s)) return s;
    return null;
  };
  return { bySection, nearest };
}

/**
 * The ways a word is written, lower-cased: as is, plural and singular
 * (`berry`: `berries`; `beans`: `bean`).
 */
export function wordForms(word) {
  const k = word.toLowerCase();
  const all = new Set([k, `${k}s`, `${k}es`]);
  if (k.endsWith('y')) all.add(`${k.slice(0, -1)}ies`);
  if (k.endsWith('ies')) all.add(`${k.slice(0, -3)}y`);
  if (k.endsWith('es')) all.add(k.slice(0, -2));
  if (k.endsWith('s')) all.add(k.slice(0, -1));
  return [...all];
}

/**
 * A fence's language: the first word of its info string, before any braces
 * (`java` in ` ```java{3} ` and ` ```java {numbers} `), or '' for none.
 */
export function fenceLanguage(info) {
  return info.trim().split(/[\s{]/)[0];
}
