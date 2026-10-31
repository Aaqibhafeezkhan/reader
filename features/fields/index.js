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
 * Each button carries the line as it reads with only it picked. Where the
 * page can't be worked, as on a slide, they show what's picked and can't
 * be changed, as a blank can't be filled in.
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
import { beforeExtract, readLines, placeholder, MARKS, splitText, escapeHtml, escapeAttr } from '../source.js';
import { typable, hinted, unfilled, shut } from '../blank.js';

// A label is any but a colon, though one can be in its hint's braces.
const BRACED = '\\{[^}\\n]*\\}';
const LABEL = `(?:${BRACED}|[^:\\n{]|\\{(?![^}\\n]*\\}))*?(?:${BRACED}|[^:\\s{]|\\{(?![^}\\n]*\\}))`;
const FIELD = new RegExp(`^([ \\t]*)@[ \\t]+(${LABEL})[ \\t]*(:+)[ \\t]*(.*?)[ \\t]*$`);
const HEAD = new RegExp(`^[ \\t]*@[ \\t]+${LABEL}[ \\t]*:+`);
const HINT = /^(.*?[^\s])[ \t]*(?<!\\)\{[ \t]*([^}\n]*?[^\s])[ \t]*(?<!\\)\}$/;
const [OPEN, CLOSE] = MARKS.fields;
const PLACED = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
const MARK = /\(([ xX])\)/g;
const INLINE = /\[@[ \t]+([^\]:\n]*?[^\]:\s])[ \t]*(?::[ \t]*([^\]\n]*?))?[ \t]*\](?![([])/g;
/** `label` and its hint, in braces at its end: `{ label, hint }`, any `\{` and `\}` in it as braces. */
function labelled(label) {
  const [, rest = label, hint = ''] = HINT.exec(label) ?? [];
  return { label: rest.replace(/\\([{}])/g, '$1'), hint };
}

const CODE = /(`+)[\s\S]*?[^`]\1(?!`)|(`+)\2(?!`)/g;

/** The inline fields in `line`, outside its code spans: `[{ start, end, label, value }]`. */
function inlineFields(line) {
  if (!line.includes('[@')) return [];
  const code = [...line.matchAll(CODE)].map((m) => [m.index, m.index + m[0].length]);
  const found = [];
  for (const m of line.matchAll(INLINE)) {
    const start = m.index;
    if (line[start - 1] === '\\' || code.some(([a, b]) => start >= a && start < b)) continue;
    found.push({ start, end: start + m[0].length, label: m[1], value: m[2] ?? '' });
  }
  return found;
}

/**
 * The choices in `value`, if that's all it is: `[{ label, checked, on }]`,
 * `on` being `line` as it reads with only that one picked.
 */
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
    const item = /^(?:[-*+]|\d+[.)])[ \t]+/.exec(before[2]);
    return Boolean(item) && before[1].length + item[0].length <= indent;
  }
  return false;
}

function choices(line, head, value) {
  if (!value.startsWith('(')) return null;
  const parts = value.split(MARK);
  const found = [];
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i + 1].trim();
    if (!label) return null;
    found.push({ label, checked: parts[i] !== ' ' });
  }
  if (parts[0] !== '' || !found.length) return null;
  const rest = line.slice(head.length);
  return found.map((c, k) => {
    let at = 0;
    return { ...c, on: head + rest.replace(MARK, () => (at++ === k ? '(x)' : '( )')) };
  });
}

export function fields(md) {
  beforeExtract(md, 'field_lines', (state) => {
    const found = [];
    readLines(state, (line, n, lines, at) => {
      if (!FIELD.test(line) || !inItem(lines, at)) {
        // Back to front, so each one's place on the line is still as written.
        return inlineFields(line).reduceRight((out, f) => {
          found.push({ ...f, line: n, text: line, inline: true });
          return out.slice(0, f.start) + placeholder(OPEN, CLOSE, found.length - 1) + out.slice(f.end);
        }, line);
      }
      // Its indent stays, so a field under a list item is in that item.
      return line.replace(FIELD, (m, indent, written, colons, value) => {
        found.push({ line: n, text: line, head: HEAD.exec(line)[0], ...labelled(written), value, lines: colons.length });
        return indent + placeholder(OPEN, CLOSE, found.length - 1);
      });
    });
    if (found.length) state.env.fields = found;
  });

  md.core.ruler.push('field_tokens', (state) => {
    const found = state.env.fields;
    if (!found) return;
    splitText(state, PLACED, (k) => {
      if (!found[k]) return null;
      const t = new state.Token(found[k].inline ? 'field_inline' : 'field', 'span', 0);
      t.meta = found[k];
      // A field of choices is a question (see source.js's tags).
      const picks = !t.meta.inline && choices(t.meta.text, t.meta.head, t.meta.value);
      if (picks) t.meta = { ...t.meta, answered: picks.some((c) => c.checked) };
      return t;
    });
    // An indented code block shows a field as it's written.
    for (const t of state.tokens) {
      if (t.type === 'code_block') t.content = t.content.replace(PLACED, (m, k) => found[k].text.trimStart());
    }
    // One field to a line: the line break after one is the field's own.
    for (const block of state.tokens) {
      if (block.type !== 'inline') continue;
      block.children = block.children.filter((c, i, all) => !(c.type === 'softbreak' && all[i - 1]?.type === 'field'));
    }
  });

  md.renderer.rules.field = (tokens, i, opts, env) => {
    const { line, text, head, label, hint, value, lines } = tokens[i].meta;
    const open = `<span class="field" data-line="${line}" data-text="${escapeAttr(text)}" data-head="${escapeAttr(head)}"`;
    const picks = choices(text, head, value);
    if (picks) {
      // Its buttons a group, named by its label, and a question.
      return `${open} data-choices data-answered="${picks.some((c) => c.checked)}" role="radiogroup" aria-labelledby="field-${line}"><span class="field-label" id="field-${line}">${escapeHtml(label)}</span><span class="field-choices">`
        + picks.map((c) => `<label class="field-choice"><input type="radio" class="choice-box" name="field-${line}"`
          + ` data-on="${escapeAttr(c.on)}"${c.checked ? ' checked' : ''}${shut(env)}> ${escapeHtml(c.label)}</label>`).join('')
        + '</span></span>';
    }
    const v = escapeHtml(value);
    const tall = lines > 1 ? ` data-lines="${lines}" style="--lines: ${lines}"` : '';
    return `${open}${tall}>`
      + `<span class="field-label">${escapeHtml(label)}</span>`
      + `<span class="field-value" data-value="${v}"${typable(label, env)}${hinted(hint, env)}>${v}</span>${unfilled(value, env, hint)}</span>`;
  };

  // The blank first, so the sentence lines up with what's written on it.
  md.renderer.rules.field_inline = (tokens, i, opts, env) => {
    const { line, text, start, end, label, value } = tokens[i].meta;
    const v = escapeHtml(value);
    return `<span class="field field-inline" data-line="${line}" data-text="${escapeAttr(text)}"`
      + ` data-head="${escapeAttr(`[@ ${label}`)}" data-start="${start}" data-end="${end}">`
      + `<span class="field-value" data-value="${v}"${typable(label, env)}>${v}</span>`
      + `<span class="field-label">${escapeHtml(label)}</span>${unfilled(value, env)}</span>`;
  };
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
