/**
 * Text set in a color and a font, by naming the styles in braces after it:
 * `[this is red]{red}`, `[both]{darkgreen times-new-roman}`. A CSS color name
 * sets the color (the first one given wins); any other name is a font, with
 * hyphens for spaces, tried in order before the page's own. A topic's alias
 * or `circle`, `underline`, `dotted`, `wavy` or `highlight` marks the text
 * instead, and a color then is the mark's (features/mark.js). `uppercase`
 * sets the words in capitals, a little spaced, though they're kept, and
 * read aloud, as they're written. For whole
 * paragraphs, lists or tables, fence them with `:::`:
 *
 *   ::: slategray georgia
 *   Everything here is gray and in Georgia,
 *   :::
 *
 * A span is an inline rule. A `:::` block is read line by line before the
 * blocks are parsed: its fence lines read as blank, and each line inside
 * gets a marker naming the styles, after whatever opens its block (`>`, `~`,
 * a bullet, `#`) and after each table pipe, so it lands in the paragraph,
 * heading, list item or cell that line belongs to. Once the blocks are
 * parsed, the markers come out, before the inline rules can take them for
 * letters, and that block takes the styles. Blocks nest; the innermost's
 * font leads and its color wins.
 *
 * The layouts, `columns`, `row`, `tabs`, `compare`, `grid` and `cards`,
 * are not styles: a block named one has its fences, and the `+++` lines in
 * it, left as the layouts' marks (features/layout.js), with the layout's own
 * words (`reverse`, a grid's count), and any other names on it are its
 * styles. Which are layouts each layout's feature says, so one left out is
 * read here as a style.
 */

import fs from 'node:fs';
import { beforeExtract, fenced, MARKS } from '../source.js';
import { layoutsOf, owns, OPEN as LAYOUT_OPEN, DIVIDER, CLOSE as LAYOUT_CLOSE } from '../layout.js';
import { marking, markSpan } from '../mark.js';
import { COLORS, GENERIC } from '../names.js';

const DIV = /^[ \t]{0,3}:::(?:[ \t]+([\w-]+(?:[ \t]+[\w-]+)*))?[ \t]*$/;
const NAMES = /^\{([\w-]+(?:[ \t]+[\w-]+)*)\}/;
const [OPEN, CLOSE] = MARKS.styles;
const MARK = new RegExp(`${OPEN}([^${CLOSE}]*)${CLOSE}`, 'g');
// A list item's own styles, as written, and a `:::` block's background.
const [ITEM_OPEN, ITEM_CLOSE] = MARKS.items;
const ITEM_MARK = new RegExp(`${ITEM_OPEN}([^${ITEM_CLOSE}]*)${ITEM_CLOSE}`, 'g');
const [BOX_OPEN, BOX_CLOSE] = MARKS.box;
const [TASK_OPEN, TASK_CLOSE] = MARKS.tasks;
// A list item's first line with braces where it's declared, after its
// bullet and any box (as typed, or as tasks has placed it), and before its
// text: `- ( ) {bg-honeydew} **A**`. A heading's are the same, after its
// `#`s and any box: `## [ ] {uppercase} Today`.
const ITEM = new RegExp('^([ \\t]*(?:>[ \\t]*)*(?:(?:[-*+]|\\d{1,9}[.)])[ \\t]+'
  + `(?:(?:${TASK_OPEN}\\d+${TASK_CLOSE}|(?:\\[[ xX]\\])+|\\([ xX]\\))[ \\t]+)?`
  + `|#{1,6}[ \\t]+(?:(?:${TASK_OPEN}\\d+${TASK_CLOSE}|\\[[ xX]\\])[ \\t]+)?))`
  + '(\\{([\\w-]+(?:[ \\t]+[\\w-]+)*)\\}[ \\t]+)(?=\\S)');
// Words that set how text is cased rather than its color or font.
const CASES = new Set(['uppercase']);
// What opens a line's block, for the marker to go after.
// An aside's `~` can carry aliases and the words it's about: `~c[the lazy dog] `.
const PREFIX = /^[ \t]*(?:~[^\s~[]*(?:\[(?:[^\]\\\n]|\\.)+\](?:\{[a-z]+\})?)?[ \t]+|[>~][ \t]*)*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(?:#{1,6}[ \t]+)?/;
// Lines a marker would change the meaning of.
const RULE = /^[ \t]*([-*_=])(?:[ \t]*\1)*[ \t]*$/;
const DELIMITER_ROW = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const REFERENCE_DEF = /^[ \t]{0,3}\[[^\]]+\]:/;
// What sets a layout's panes apart, with the next one's label.
const PLUS = /^[ \t]{0,3}\+{3,}(?:[ \t]+(.*?))?[ \t]*$/;

export function styles(md) {
  beforeExtract(md, 'style_lines', lines);
  md.block.ruler.before('fence', 'style_box', box, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.inline.ruler.before('link', 'style_span', span);
  md.core.ruler.before('inline', 'style_unmark', unmark);
  // Before other features look at the text: a marker isn't theirs to see.
  // A class they add to the block then comes after this one's.
  md.core.ruler.after('text_join', 'style_blocks', blocks);
  md.renderer.rules.style_span_open = (tokens, i, opts, env, self) => self.renderToken(tokens, i, opts);
  md.renderer.rules.style_span_close = (tokens, i, opts, env, self) => self.renderToken(tokens, i, opts);
}

/** Marks each line inside a `:::` block with the styles it's in. */
function lines(state) {
  if (state.inlineMode || state.env.nested) return;
  const open = [];
  const code = fenced();
  const layouts = layoutsOf(state.md);
  state.src = state.src.split('\n').map((line) => {
    if (code(line)) return line;
    const div = DIV.exec(line);
    // A layout's marks keep the line's indent, to stay in a list item.
    const indent = /^[ \t]*/.exec(line)[0];
    if (div) {
      // The fence lines themselves read as blank, keeping the line count; a
      // layout's are left for it to find.
      if (div[1]) {
        const names = div[1].trim().split(/\s+/);
        const layout = names.map((n) => n.toLowerCase()).find((n) => layouts.has(n));
        // A layout's own words (`::: row reverse`) go with it, not the styles.
        const own = names.map((n) => n.toLowerCase()).filter((n) => owns(layouts.get(layout), n));
        const style = (n) => !layouts.has(n.toLowerCase()) && !own.includes(n.toLowerCase());
        // A background on a block that isn't a layout is one box round it all.
        const bg = !layout && names.find(background);
        open.push({ names: names.filter((n) => style(n) && !(bg && background(n))), layout, bg });
        if (layout) return indent + LAYOUT_OPEN + [layout, ...own].join(' ');
        return bg ? indent + BOX_OPEN + bg.slice(3).toLowerCase() : '';
      }
      if (open.length) {
        const o = open.pop();
        return o.layout ? indent + LAYOUT_CLOSE : o.bg ? indent + BOX_CLOSE : '';
      }
      return line;
    }
    line = item(line);
    const plus = PLUS.exec(line);
    if (plus && open.some((o) => o.layout)) return indent + DIVIDER + (plus[1] ?? '');
    // Innermost first, so its font leads and its color wins.
    const names = open.flatMap((o) => o.names.length ? [o.names] : []).reverse().flat().join(' ');
    return names ? mark(line, names) : line;
  }).join('\n');
}

/** Whether `name` is a background: `bg-` and a CSS color name. */
const background = (name) => /^bg-/i.test(name) && COLORS.has(name.slice(3).toLowerCase());

/**
 * Whether `name` is one a list item's or a heading's braces can hold: a
 * color, a background, a generic font, a case.
 */
const known = (name) => COLORS.has(name.toLowerCase()) || background(name) || GENERIC.has(name.toLowerCase()) || CASES.has(name.toLowerCase());

/**
 * A list item's or a heading's line with braces of style names after its
 * bullet or `#`s and box,
 * with the braces, and the space after them, a marker that keeps them as
 * written, for the item to take once the blocks are parsed. Braces naming
 * anything else -- a word -- are left as they are.
 */
function item(line) {
  const m = ITEM.exec(line);
  if (!m || !m[3].split(/\s+/).every(known)) return line;
  return m[1] + ITEM_OPEN + m[2] + ITEM_CLOSE + line.slice(m[0].length);
}

/** Puts back an item's braces where they turned out not to head a list item or a heading. */
const written = (s) => s.replace(ITEM_MARK, '$1');

/**
 * Leave a marker naming `names` inside the block this line belongs to, after
 * whatever opens the block, and after each table pipe so every cell is
 * marked. Lines where a marker would change what the block is -- rules,
 * table delimiters, reference definitions, alerts -- are left alone.
 */
function mark(line, names) {
  if (RULE.test(line) || DELIMITER_ROW.test(line) || REFERENCE_DEF.test(line)) return line;
  const lead = PREFIX.exec(line)[0];
  const rest = line.slice(lead.length);
  if (!rest.trim() || rest.startsWith('[!')) return line;
  const marker = `${OPEN}${names}${CLOSE}`;
  const cells = rest.replace(/(?<!\\)\|[ \t]*(?=\S)/g, `$&${marker}`);
  return lead + (rest.startsWith('|') ? cells : marker + cells);
}

/**
 * Takes the markers out of each block's inline source, keeping the styles
 * they name for its block. Left in, a marker reads as a letter before the
 * line's first character, so `**[a](b)**` or `*(aside)*` wouldn't open
 * emphasis, nor `"` a quote.
 */
function unmark(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'inline' && t.content.includes(ITEM_OPEN)) own(tokens, i);
    if (t.type !== 'inline' || !t.content.includes(OPEN)) continue;
    let names = null;
    t.content = t.content.replace(MARK, (m, n) => {
      names ??= n;
      return '';
    });
    t.meta = { ...t.meta, styles: names };
  }
}

/**
 * An item's braces, on the first line of the list item or the heading the
 * inline token at `i` opens, are that item's styles; anywhere else they
 * stay as written.
 */
function own(tokens, i) {
  const t = tokens[i];
  const li = tokens[i - 1]?.type === 'heading_open' ? tokens[i - 1]
    : tokens[i - 1]?.type === 'paragraph_open' && tokens[i - 2]?.type === 'list_item_open' ? tokens[i - 2] : null;
  const firstLine = t.content.indexOf('\n') < 0 ? t.content.length : t.content.indexOf('\n');
  t.content = t.content.replace(ITEM_MARK, (m, braces, at) => {
    if (!li || li.meta?.own || at > firstLine) return braces;
    li.meta = { ...li.meta, own: braces.trim().slice(1, -1).trim() };
    return '';
  });
}

/**
 * Takes any markers left out of the text, styling the block each was in: its
 * paragraph, heading or cell, or, in a tight list where paragraphs aren't
 * shown, its list item. In code they just go.
 */
function blocks(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'code_block' || t.type === 'fence') {
      t.content = written(t.content.replace(MARK, ''));
      continue;
    }
    if (t.type !== 'inline' || !t.children) continue;
    let names = t.meta?.styles ?? null;
    for (const c of t.children) {
      if (c.type !== 'text' && c.type !== 'code_inline') continue;
      c.content = written(c.content.replace(MARK, (m, n) => {
        if (c.type === 'text') names ??= n;
        return '';
      }));
    }
    const block = names && holder(tokens, i);
    if (block && !block.meta?.styled) {
      block.meta = { ...block.meta, styled: true };
      // An item's own styles come before its block's, so its color wins.
      apply(block, block.meta.own ? `${block.meta.own} ${names}` : names);
    }
  }
  for (const t of tokens) {
    if (!['list_item_open', 'heading_open'].includes(t.type) || !t.meta?.own || t.meta.styled) continue;
    t.meta = { ...t.meta, styled: true };
    apply(t, t.meta.own);
  }
}

/**
 * A `:::` block with a background, which the line pass left as marks of
 * its own: what's in it, in one box with that background.
 */
function box(state, startLine, endLine, silent) {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const text = (n) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
  const first = text(startLine);
  if (!first.startsWith(BOX_OPEN)) return false;
  if (silent) return true;
  // To the end that's its own, past any box inside it.
  let end = startLine + 1;
  for (let depth = 0; end < endLine; end++) {
    const line = text(end);
    if (line.startsWith(BOX_OPEN)) depth++;
    else if (line === BOX_CLOSE && !depth--) break;
  }
  const open = state.push('style_box_open', 'div', 1);
  open.block = true;
  open.map = [startLine, Math.min(end + 1, endLine)];
  apply(open, `bg-${first.slice(BOX_OPEN.length).trim()}`);
  const { lineMax } = state;
  state.lineMax = end;
  state.md.block.tokenize(state, startLine + 1, end);
  state.lineMax = lineMax;
  state.push('style_box_close', 'div', -1).block = true;
  state.line = Math.min(end + 1, endLine);
  return true;
}

/** The element an inline token's text shows in. */
function holder(tokens, i) {
  const open = tokens[i - 1];
  if (!open) return null;
  if (['heading_open', 'th_open', 'td_open'].includes(open.type)) return open;
  // A definition's meaning: its entry, the term with it (features/definitions).
  if (open.type === 'def_meaning_open') return tokens.findLast((t, k) => k < i && t.type === 'def_open') ?? null;
  if (open.type !== 'paragraph_open') return null;
  if (!open.hidden) return open;
  for (let k = i - 2; k >= 0; k--) {
    if (tokens[k].type === 'list_item_open' && tokens[k].level < open.level) return tokens[k];
  }
  return null;
}

/** `[text]{names}`: the text, which is markdown, in a span with those styles. */
function span(state, silent) {
  // Asked only to skip past it, while a link's label is being measured: let
  // the brackets count as brackets, so a link can hold a span.
  if (silent) return false;
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x5B /* [ */) return false;
  if (start > 0 && state.src.charCodeAt(start - 1) === 0x21 /* ! */) return false;
  const end = state.md.helpers.parseLinkLabel(state, start, false);
  if (end < 0 || state.src.slice(start + 1, end).includes('\n')) return false;
  const names = NAMES.exec(state.src.slice(end + 1));
  if (!names) return false;
  const open = state.push('style_span_open', 'span', 1);
  // A mark's colour is the mark's, not the text's (features/mark.js).
  const marked = marking(names[1], state.env.topics);
  if (marked) {
    const color = marked.rest.find((n) => COLORS.has(n.toLowerCase()))?.toLowerCase();
    const rest = marked.rest.filter((n) => !COLORS.has(n.toLowerCase()));
    markSpan(open, { style: marked.style, color: color ?? marked.topic?.color, topic: marked.topic?.name });
    if (rest.length) apply(open, rest.join(' '));
  } else {
    apply(open, names[1]);
  }
  const max = state.posMax;
  state.pos = start + 1;
  state.posMax = end;
  state.md.inline.tokenize(state);
  state.posMax = max;
  state.push('style_span_close', 'span', -1);
  state.pos = end + 1 + names[0].length;
  return true;
}

/**
 * Adds `names` to a token's attributes: a CSS color name sets the color (the
 * first one given wins), and `bg-` and one its background, `--bg` for the
 * stylesheet to keep readable, marking the element `bg`; `uppercase` marks
 * it for the stylesheet to set in capitals; every other name is a font,
 * tried in order before falling back to the page's own, and marks the
 * element `font` for the stylesheet.
 */
function apply(token, names) {
  let color = null;
  let bg = null;
  let upper = false;
  const fonts = [];
  for (const name of names.trim().split(/\s+/)) {
    const key = name.toLowerCase();
    if (COLORS.has(key)) color ??= key;
    else if (background(key)) bg ??= key.slice(3);
    else if (CASES.has(key)) upper = true;
    else fonts.push(GENERIC.has(key) ? key : `'${name.replace(/-/g, ' ')}'`);
  }
  const css = [color && `color: ${color}`, bg && `--bg: ${bg}`, fonts.length && `--font: ${fonts.join(', ')}`].filter(Boolean).join('; ');
  for (const [cls, on] of [['bg', bg], ['font', fonts.length], ['uppercase', upper]]) {
    if (!on) continue;
    const had = token.attrGet('class');
    if (had) token.attrSet('class', `${cls} ${had}`);
    else token.attrs = [['class', cls], ...(token.attrs || [])];
  }
  if (!css) return;
  const style = token.attrGet('style');
  token.attrSet('style', style ? `${style.replace(/;?\s*$/, '; ')}${css}` : css);
}

export default {
  name: 'styles',
  plugin: styles,
  css: fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8'),
};
