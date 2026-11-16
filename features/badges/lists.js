/**
 * A list CommonMark doesn't know, read as an ordered list whose numbers are
 * badges: one lettered, `a)`, `b)`, ... (gh-261).
 *
 *   1) Favor icons over words:
 *      a) Formatting
 *      b) Work
 *
 * Elsewhere they're lines of text, so they read as plain text on GitHub.
 *
 * markdown-it's own list rule, as of 15.0.3 (MIT, Copyright (c) 2014 Vitaly
 * Puzrin, Alex Kocharin), with its marker read as one of these and the
 * bullets left out: a list goes on while its items have the same kind of
 * marker, and like a numbered list, it breaks into a paragraph only at its
 * first, `a)`, except in a list's item, where the line above is the item's
 * and any letter goes on from it: `1) Ideas` then `d) Today`. Each list says which kind it is (`meta.marker`), and each
 * item its letter (`meta.label`), for badges to draw.
 */

const LETTER = /^([a-z])\)/;
const isSpace = (ch) => ch === 0x09 || ch === 0x20;

/**
 * The marker starting `line`, if it's one of these: where it ends, its kind
 * (`letter`), its value (a is 1) and its label (`d`).
 */
function marker(state, line) {
  const start = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];
  const text = state.src.slice(start, Math.min(max, start + 14));
  const m = LETTER.exec(text);
  const found = m && { kind: 'letter', value: m[1].charCodeAt(0) - 96, label: m[1] };
  if (!found) return null;
  const pos = start + m[0].length;
  if (pos < max && !isSpace(state.src.charCodeAt(pos))) return null;
  return { ...found, pos };
}

function markTightParagraphs(state, idx) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}

function list(state, startLine, endLine, silent) {
  let nextLine = startLine;
  let tight = true;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) return false;
  const isTerminatingParagraph = silent && state.parentType === 'paragraph' && state.sCount[nextLine] >= state.blkIndent;
  let found = marker(state, nextLine);
  if (!found) return false;
  if (isTerminatingParagraph && found.value !== 1 && state.listIndent < 0) return false;
  if (isTerminatingParagraph && state.skipSpaces(found.pos) >= state.eMarks[nextLine]) return false;
  if (silent) return true;

  const { kind } = found;
  const listTokIdx = state.tokens.length;
  let token = state.push('ordered_list_open', 'ol', 1);
  token.attrs = [...(kind === 'letter' ? [['type', 'a']] : []), ...(found.value !== 1 ? [['start', found.value]] : [])];
  token.meta = { marker: kind };
  const listLines = [nextLine, 0];
  token.map = listLines;
  token.markup = ')';
  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules('list');
  const oldParentType = state.parentType;
  state.parentType = 'list';

  while (nextLine < endLine) {
    let pos = found.pos;
    const max = state.eMarks[nextLine];
    const initial = state.sCount[nextLine] + found.pos - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (ch === 0x09) offset += 4 - ((offset + state.bsCount[nextLine]) % 4);
      else if (ch === 0x20) offset++;
      else break;
      pos++;
    }
    const contentStart = pos;
    let indentAfterMarker = contentStart >= max ? 1 : offset - initial;
    if (indentAfterMarker > 4) indentAfterMarker = 1;
    const indent = initial + indentAfterMarker;

    token = state.push('list_item_open', 'li', 1);
    token.markup = ')';
    token.info = found.label;
    token.meta = { label: found.label };
    const itemLines = [nextLine, 0];
    token.map = itemLines;

    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;
    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;
    if (contentStart >= max && state.isEmpty(nextLine + 1)) state.line = Math.min(state.line + 2, endLine);
    else state.md.block.tokenize(state, nextLine, endLine);
    if (!state.tight || prevEmptyEnd) tight = false;
    prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;

    token = state.push('list_item_close', 'li', -1);
    token.markup = ')';
    nextLine = state.line;
    itemLines[1] = nextLine;
    if (nextLine >= endLine) break;
    if (state.sCount[nextLine] < state.blkIndent) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    if (terminatorRules.some((rule) => rule(state, nextLine, endLine, true))) break;
    found = marker(state, nextLine);
    if (!found || found.kind !== kind) break;
  }

  token = state.push('ordered_list_close', 'ol', -1);
  token.markup = ')';
  listLines[1] = nextLine;
  state.line = nextLine;
  state.parentType = oldParentType;
  if (tight) markTightParagraphs(state, listTokIdx);
  return true;
}

/** The rule, before markdown-it's lists, breaking into what they do. */
export function lists(md) {
  md.block.ruler.before('list', 'badge_lists', list, { alt: ['paragraph', 'reference', 'blockquote'] });
}
