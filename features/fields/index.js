/**
 * A line starting `@ ` is a form field: a label, a colon, and whatever's
 * filled in after it, which can be nothing yet. Each colon is a line of
 * blank, so `@ Notes:::` gets three.
 *
 *   @ My Name: Josh
 *   @ Date:
 *
 * Braces at the end of the label are its hint, what goes in the blank,
 * shown faint there while it's empty (features/blank.js). They aren't part
 * of the label, but are of the head, so they're written back with it; a
 * label that really ends in braces escapes them, `@ Set \{a, b\}:`.
 *
 *   @ Hours of sleep {e.g. 7.5}:
 *
 * The field carries its line, the line as written and its head (up to the
 * colons), so the preview can open the blank for typing and write the new
 * value back after the head. The value is shown as typed, with no markdown.
 *
 * A value that's all `( )` and `(x)` choices is one to pick instead, its
 * radio buttons in a row:
 *
 *   @ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM
 *
 * A blank in a sentence (below) can be one of them, or in one's words: it's
 * a blank, and only its button picks it, as filling it in does.
 *
 *   @ Milestone: ( ) 0.0.5 ( ) [@ Something else]
 *
 * Each button carries the line as it reads with only it picked. Where the
 * page can't be worked, as on a slide, they show what's picked and can't
 * be changed, as a blank can't be filled in.
 *
 * A value can say what kind it is, as `date:` does anywhere: the field is
 * then that kind. One that's a date is left to the page to draw, the field
 * round it, so it's the date `date:` is anywhere else, its calendar and all,
 * which writes the day picked back in its place; this feature only knows
 * its shape, so without the date feature it reads as typed. Where the page
 * can't be worked, a date not yet picked is a blank, as any field is.
 *
 *   @ When: date:2026-11-10[]
 *
 * `number:` is a field's own kind: a field holding a number, the number
 * after the colon and, as with `date:`, what to show instead in the
 * brackets, which are empty for a blank. It's typed in as any field is,
 * though only a number can be, and written back as `number:12[]`. A value
 * that isn't a number (`number:twelve[]`) stays as typed.
 *
 *   @ Age {e.g. 12}: number:[]
 *
 * A blank can also sit inside a sentence, as in a madlib: `[@ ` and what
 * goes there, which is shown small under the blank, and the answer after a
 * colon once it's filled in:
 *
 *   I am from a [@ an ordinary item from childhood: quilt] and [@ a place].
 *
 * A line can have several, so each carries where it starts and ends on its
 * line too. One followed by `(` or `[` is a link's text, and one in `code`
 * or after a backslash is left as typed.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeExtract, readLines, placeholder, MARKS, LIST_MARKER, splitText, escapeHtml, escapeAttr } from '../source.js';
import { typable, hinted, unfilled, shut, workable, inlineBlanks } from '../blank.js';
import { choicesIn, pickedAt } from '../choices.js';

// A label is any but a colon, though one can be in its hint's braces.
const BRACED = '\\{[^}\\n]*\\}';
const LABEL = `(?:${BRACED}|[^:\\n{]|\\{(?![^}\\n]*\\}))*?(?:${BRACED}|[^:\\s{]|\\{(?![^}\\n]*\\}))`;
const FIELD = new RegExp(`^([ \\t]*)@[ \\t]+(${LABEL})[ \\t]*(:+)[ \\t]*(.*?)[ \\t]*$`);
const HEAD = new RegExp(`^[ \\t]*@[ \\t]+${LABEL}[ \\t]*:+`);
const HINT = /^(.*?[^\s])[ \t]*(?<!\\)\{[ \t]*([^}\n]*?[^\s])[ \t]*(?<!\\)\}$/;
const [OPEN, CLOSE] = MARKS.fields;
// The fields found, by placeholder, kept on `env` under a key no other feature can name, so that
// one reads this one's tokens instead (gh-282); an aside's parse, a copy of
// `env`, keeps it.
const FIELDS = Symbol('fields');
const PLACED = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
// A value that's a date, as the date feature reads one, valid or not; and
// one that's a number, or a blank for one.
const DATE = /^date:(?:\d{4}-\d{2}-\d{2})?\[[^\]\n]*\]$/;
const NUMBER = /^number:(-?(?:\d+(?:\.\d+)?|\.\d+))?\[([^\]\n]*)\]$/;
/** `label` and its hint, in braces at its end: `{ label, hint }`, any `\{` and `\}` in it as braces. */
function labelled(label) {
  const [, rest = label, hint = ''] = HINT.exec(label) ?? [];
  return { label: rest.replace(/\\([{}])/g, '$1'), hint };
}

/**
 * What kind of value `value` is, if it's one of reader's own:
 * `{ kind: 'date' }`, or `{ kind: 'number', value, shown }`, the number and
 * what's shown for it; or nothing, for a value as typed.
 */
function kindOf(value) {
  if (DATE.test(value)) return { kind: 'date' };
  const n = NUMBER.exec(value);
  return n ? { kind: 'number', value: n[1] ?? '', shown: n[2].trim() || (n[1] ?? '') } : {};
}

/**
 * Whether the line at `at` is where a field may start: at the line's start,
 * or indented into a list item, under the item's own text, as a line of it.
 */
function inItem(lines, at) {
  const indent = lines[at].match(/^[ \t]*/)[0].length;
  if (!indent) return true;
  for (let k = at - 1; k >= 0; k--) {
    const before = lines[k].match(/^([ \t]*)(\S.*)?$/);
    if (!before?.[2] || before[1].length >= indent) continue;
    const item = new RegExp(`^${LIST_MARKER}[ \\t]+`).exec(before[2]);
    return Boolean(item) && before[1].length + item[0].length <= indent;
  }
  return false;
}

/** A label's class: one that ends in its own stop, as a question does, takes no colon. */
const labelClass = (label) => (/[?!.:…]$/.test(label) ? 'field-label field-label-stop' : 'field-label');

/**
 * The choices in `value`, if that's all it is (features/choices.js), each
 * with `on`, `line` as it reads with only that one picked. A mark in a
 * blank's answer is the answer's.
 */
function choices(line, head, value) {
  if (!value.startsWith('(')) return null;
  const found = choicesIn(line, head.length, inlineBlanks(line));
  return found?.map((c, k) => ({ ...c, on: pickedAt(line, found, k) })) ?? null;
}

/** A blank in a sentence, `{ line, text, start, end, label, value }`, drawn. The blank first, so the sentence lines up with what's written on it. */
function inlineBlank({ line, text, start, end, label, value }, env) {
  const v = escapeHtml(value);
  return `<span class="field field-inline" data-line="${line}" data-text="${escapeAttr(text)}"`
    + ` data-head="${escapeAttr(`[@ ${label}`)}" data-start="${start}" data-end="${end}">`
    + `<span class="field-value" data-value="${v}"${typable(label, env)}>${v}</span>`
    + `<span class="${labelClass(label)}">${escapeHtml(label)}</span>${unfilled(value, env)}</span>`;
}

/**
 * Choice `c` of a field on `line` (`text` as written), drawn: its button and
 * its words, which pick it. A blank in its words is a blank, to be filled
 * in, not a click on the words: then only the button picks it, in a label
 * of its own, as big as a finger, and named by its words, the blank's by
 * what's in it or what goes there.
 */
function choiceHtml(c, line, text, env) {
  const box = (named) => `<input type="radio" class="choice-box" name="field-${line}" data-on="${escapeAttr(c.on)}"${named}${c.checked ? ' checked' : ''}${shut(env)}>`;
  const words = text.slice(c.label.start, c.label.end);
  const blanks = inlineBlanks(text).filter((b) => b.start >= c.label.start && b.end <= c.label.end);
  if (!blanks.length) return `<label class="field-choice">${box('')} ${escapeHtml(words)}</label>`;
  let shown = '';
  let name = '';
  let at = c.label.start;
  for (const b of blanks) {
    shown += escapeHtml(text.slice(at, b.start)) + inlineBlank({ ...b, line, text }, env);
    name += text.slice(at, b.start) + (b.value || b.label);
    at = b.end;
  }
  shown += escapeHtml(text.slice(at, c.label.end));
  name += text.slice(at, c.label.end);
  return `<span class="field-choice field-choice-blank"><label class="field-choice-box">${box(` aria-label="${escapeAttr(name.trim())}"`)}</label>${shown}</span>`;
}

export function fields(md) {
  beforeExtract(md, 'field_lines', (state) => {
    const found = [];
    readLines(state, (line, n, lines, at) => {
      if (!FIELD.test(line) || !inItem(lines, at)) {
        // Back to front, so each one's place on the line is still as written.
        return inlineBlanks(line).reduceRight((out, f) => {
          found.push({ ...f, line: n, text: line, inline: true });
          return out.slice(0, f.start) + placeholder(OPEN, CLOSE, found.length - 1) + out.slice(f.end);
        }, line);
      }
      // Its indent stays, so a field under a list item is in that item.
      return line.replace(FIELD, (m, indent, written, colons, value) => {
        const field = { line: n, text: line, head: HEAD.exec(line)[0], ...labelled(written), value, lines: colons.length, ...kindOf(value) };
        found.push(field);
        if (field.kind !== 'date') return indent + placeholder(OPEN, CLOSE, found.length - 1);
        // A date stays on the line, for the date feature to read, between
        // the field's start and its end, which shows nothing as written.
        field.typed = m.slice(indent.length, m.lastIndexOf(value));
        found.push({ ends: true, typed: '' });
        return indent + placeholder(OPEN, CLOSE, found.length - 2) + value + placeholder(OPEN, CLOSE, found.length - 1);
      });
    });
    if (found.length) state.env[FIELDS] = found;
  });

  md.core.ruler.push('field_tokens', (state) => {
    const found = state.env[FIELDS];
    if (!found) return;
    splitText(state, PLACED, (k) => {
      if (!found[k]) return null;
      if (found[k].ends) return new state.Token('field_end', 'span', -1);
      const t = new state.Token(found[k].inline ? 'field_inline' : 'field', 'span', 0);
      t.meta = found[k];
      // A blank in a sentence reads as what goes there, in a name made of the sentence.
      if (found[k].inline) t.content = found[k].label;
      // A field of choices is a question (see source.js's tags).
      const picks = !t.meta.inline && choices(t.meta.text, t.meta.head, t.meta.value);
      if (picks) t.meta = { ...t.meta, answered: picks.some((c) => c.checked) };
      return t;
    });
    // An indented code block shows a field as it's written.
    for (const t of state.tokens) {
      if (t.type === 'code_block') t.content = t.content.replace(PLACED, (m, k) => found[k].typed ?? found[k].text.trimStart());
    }
    // Where the page can't be worked, a date not yet picked is only a
    // blank, as any field is: what's drawn of it is let go.
    if (!workable(state.env)) {
      for (const block of state.tokens) {
        if (block.type !== 'inline') continue;
        let dropping = false;
        block.children = block.children.filter((c) => {
          if (c.type === 'field' && c.meta.kind === 'date' && /^date:\[\s*\]$/.test(c.meta.value)) {
            c.meta = { ...c.meta, kind: undefined, value: '' };
            dropping = true;
            return true;
          }
          if (!dropping) return true;
          if (c.type === 'field_end') dropping = false;
          return false;
        });
      }
    }
    // One field to a line: the line break after one is the field's own.
    for (const block of state.tokens) {
      if (block.type !== 'inline') continue;
      block.children = block.children.filter((c, i, all) => !(c.type === 'softbreak' && ['field', 'field_end'].includes(all[i - 1]?.type)));
    }
  });

  md.renderer.rules.field = (tokens, i, opts, env) => {
    const { line, text, head, label, hint, value, lines, kind, shown } = tokens[i].meta;
    const open = `<span class="field" data-line="${line}" data-text="${escapeAttr(text)}" data-head="${escapeAttr(head)}"`;
    // A date, drawn by what's between this and the field's end: a group
    // named by its label, so its button is heard with what it's for.
    if (kind === 'date') return `${open} data-kind="date" role="group" aria-labelledby="field-${line}"><span class="${labelClass(label)}" id="field-${line}">${escapeHtml(label)}</span><span class="field-held">`;
    const picks = choices(text, head, value);
    if (picks) {
      // Its buttons a group, named by its label, and a question.
      return `${open} data-choices data-answered="${picks.some((c) => c.checked)}" role="radiogroup" aria-labelledby="field-${line}"><span class="${labelClass(label)}" id="field-${line}">${escapeHtml(label)}</span><span class="field-choices">`
        + picks.map((c) => choiceHtml(c, line, text, env)).join('')
        + '</span></span>';
    }
    const v = escapeHtml(value);
    const tall = lines > 1 ? ` data-lines="${lines}" style="--lines: ${lines}"` : '';
    const kinded = kind ? ` data-kind="${kind}"` : '';
    return `${open}${kinded}${tall}>`
      + `<span class="${labelClass(label)}">${escapeHtml(label)}</span>`
      + `<span class="field-value" data-value="${v}"${typable(label, env)}${hinted(hint, env)}>${escapeHtml(shown ?? value)}</span>${unfilled(value, env, hint)}</span>`;
  };
  md.renderer.rules.field_end = () => '</span></span>';

  md.renderer.rules.field_inline = (tokens, i, opts, env) => inlineBlank(tokens[i].meta, env);
}

export default {
  name: 'fields',
  plugin: fields,
  css: fs.readFileSync(new URL('./fields.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to make it clickable.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // Reads the file as written, before the features that don't.
  raw: true,
};
