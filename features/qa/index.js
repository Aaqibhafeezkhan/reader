/**
 * `Q:` and `A:` at the start of a line make an exchange: each its own item
 * in a list, labelled, with the asker's or answerer's name beside the label
 * when given (`Q (audience):`). A second `A:` in a row, unnamed or naming the
 * same person, continues the answer as a new paragraph rather than starting
 * another; likewise `Q:`. Any other line at the margin ends the exchange,
 * and `\A:` keeps a line that starts that way as typed.
 *
 *   Q (audience): Is this a pendulum swing or an integration?
 *   A (Thomas): An integration.
 *
 * A retro's cards are exchanges too: `Good:`, `Bad:` and `Try:` each start
 * one, labelled G, B and T, and are never continued -- the next is another
 * card. `+1` under a card or a question, named or not and with a comment
 * after a colon or not, is a vote for it: an item of its own, counted on
 * the card.
 *
 *   Bad (Josh): We were surprised by the deadline
 *   +1 (Rob)
 *   A (Rob): Plan them against the calendar.
 *
 * `Bad [x] (Josh):` is a card whose discussion is done: it and what's said
 * under it are faded. On a `Try`, the `[x]` is a box ticked instead: it's
 * been tried, as a recipe's log says of a change to make next time. A
 * click on a card's label writes or takes away the `[x]` (preview.js);
 * `[ ]` is a card not yet done, as no box is.
 *
 * An answer whose line is all `( )` choices, each with words after it, as
 * a field's can be (features/choices.js), is one to pick from: radio
 * buttons in a row, one set to each `A:` line, a group named by what it
 * answers. Each knows its line as written with only it picked; a blank as
 * one of them is the fields feature's, and filling it in picks it
 * (preview.js). A line whose marks aren't all outside emphasis and links
 * stays as typed.
 *
 *   A: ( ) Yes ( ) [@ Something else]
 *
 * Indented under an exchange, a `Q:` or `A:` line (a card's, a vote's) is
 * an exchange nested in it, as deep as it's indented: a list in the item
 * above. Indented with no exchange above it, it stays as typed, unless it's
 * at the words of a list's item: then it starts an exchange inside the item,
 * as at the margin (gh-302). So does one straight after a list item's marker,
 * `- Q:` or `1) Good:`, and a `- A:` in the next bullet goes on with it. Back
 * from a nested exchange, an `A:` is a new answer, not the one before
 * carried on.
 *
 *   A: Now, or file an issue.
 *     Q (Claude): Fix part A now?
 *     A: File an issue.
 *
 * A label with nothing after its colon starts one too, when the next line
 * with words on it is indented under it, and isn't itself an exchange's,
 * a vote or an aside: its words, a paragraph or more, are the indented ones
 * (gh-219). With nothing indented under it, or something other than a
 * paragraph, a list, a quote or code, it stays as typed. Whether it has its
 * words is read once the asides are out, so that one written between a
 * label and its words goes beside the label.
 *
 *   Good (Claude):
 *
 *     An aside under the line it was about kept each conversation in place.
 *
 *     Neither of us had to say which line or which item.
 *
 * Before anything else reads the source -- the asides included, so
 * that an aside ends where an exchange's line begins -- each such line
 * becomes a `+` list item (so it never joins a `-` or `*` list above it), and
 * one that carries on the item before it is indented into that item. Who
 * spoke is kept, by line, on `env` under the feature's own key; once the text is parsed, the items on
 * those lines are labelled, finding their lines through the asides feature's
 * `env.sourceLines`.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeExtract, keepWritten, addClass, escapeAttr, fenced, unplaced, textToken, MARKS } from '../source.js';
import { workable, shut, inlineBlanks, codeSpans } from '../blank.js';
import { MARK, choicesIn, pickedAt, answeredBy } from '../choices.js';

// The speaker of each exchange's line, kept on `env` under a key no other feature can name, so that
// one reads this one's tokens instead (gh-282); an aside's parse, a copy of
// `env`, keeps it.
const SAID = Symbol('said');

// A name may hold a link, whose address is in parentheses of its own.
const QA = /^\\?(Q|A|Good|Bad|Try)(?:[ \t]+\[([ xX])\])?(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?:[ \t]+(?=\S)/;
// The same, with nothing after its colon: its words start on a line under it.
const BARE = new RegExp(`${QA.source.slice(0, -'[ \\t]+(?=\\S)'.length)}[ \\t]*$`);
// Where such a label's words would be, until they're found under it (items).
const [UNDER] = MARKS.qa;
const VOTE = /^\+1(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?(?::[ \t]+(?=\S)|:?[ \t]*$)/;
const LABELS = { Good: 'G', Bad: 'B', Try: 'T', '+1': '+1' };
const CARDS = new Set(['Good', 'Bad', 'Try']);
// How many of each kind have been counted, for their ids, on `env.shared`
// so a deck's slides count on from the ones before.
const COUNTED = Symbol('qa counted');

export function qa(md) {
  keepWritten(md);
  beforeExtract(md, 'qa_lines', lines);
  // Once the asides are out, and before markdown reads the blocks: whether
  // a label alone on its line has words under it (gh-219).
  md.core.ruler.before('block', 'qa_under', under);
  // Last, after markdown's own rules: a paragraph split off here has no
  // source text of its own for them to check before they'd run.
  md.core.ruler.push('qa_items', items);
  md.renderer.rules.qa_label = (tokens, i, options, env) => {
    const { who, name, votes, toggle } = tokens[i].meta;
    const tally = votes ? `<span class="qa-tally">+${votes}</span>` : '';
    // A toggle, pressed once discussed, named for its card rather than its
    // letter. An exported page has no script to press it with, so there it's
    // only a label. Elsewhere the page can't be worked, as on a slide, it
    // still says whether it's done, but can't be reached or pressed.
    // A Try is ticked off once it's been tried, a checkbox rather than a toggle.
    const tried = who === 'Try';
    const open = workable(env);
    const reach = open ? 'tabindex="0"' : 'aria-disabled="true"';
    const hint = (t) => (open ? ` title="${t}"` : '');
    const state = tried
      ? `role="checkbox" ${reach} aria-label="Try, tried" aria-checked="${toggle?.done}"${hint(toggle?.done ? 'Not tried yet' : 'Mark it tried')}`
      : `role="button" ${reach} aria-label="${who}, discussed" aria-pressed="${toggle?.done}"${hint(toggle?.done ? 'Reopen the discussion' : 'Mark the discussion done')}`;
    const label = toggle && env.drawing?.for !== 'export'
      ? `<span class="qa-label qa-toggle${tried ? ' qa-tried' : ''}" ${state} data-line="${toggle.line}" data-on="${escapeAttr(toggle.on)}" data-off="${escapeAttr(toggle.off)}">`
      : '<span class="qa-label">';
    // A Try that's been tried shows a check in place of its T.
    const mark = tried && toggle?.done ? '✓' : LABELS[who] ?? who;
    // A name is markdown like the rest of the line: *emphasis*, quotes.
    return `${label}${mark}</span>${tally}${name ? `<span class="qa-name">${md.renderInline(name)}</span>` : ''}`;
  };
  md.renderer.rules.qa_para = () => '<span class="qa-para"></span>';
  // An answer's choices: a group of buttons named by what it answers, a
  // question (see source.js's tags), each knowing its line with only it picked.
  md.renderer.rules.qa_choices_open = (tokens, i) => {
    const { line, text, off, answered, name } = tokens[i].meta;
    return `<span class="qa-choices" role="radiogroup" aria-label="${escapeAttr(name || 'Answer')}" data-line="${line}"`
      + ` data-text="${escapeAttr(text)}" data-off="${escapeAttr(off)}" data-answered="${answered}">`;
  };
  md.renderer.rules.qa_choices_close = () => '</span>';
  // A choice's words pick it, unless there's a blank in them, to be filled
  // in: then only its button does, in a label of its own as big as a
  // finger, named by its words (fields/index.js draws one alike).
  md.renderer.rules.qa_choice_open = (tokens, i, options, env) => {
    const { line, on, checked, blank, name } = tokens[i].meta;
    const box = `<input type="radio" class="qa-box" name="qa-${line}" data-on="${escapeAttr(on)}"`
      + `${blank ? ` aria-label="${escapeAttr(name)}"` : ''}${checked ? ' checked' : ''}${shut(env)}>`;
    return blank ? `<span class="qa-choice qa-choice-blank"><label class="qa-choice-box">${box}</label>` : `<label class="qa-choice">${box} `;
  };
  md.renderer.rules.qa_choice_close = (tokens, i) => (tokens[i].meta.blank ? '</span>' : '</label>');
}

/**
 * The choices on an answer's line, `written`, line `line` of the file, if
 * its answer is all choices: `{ line, text, checked, on, off, head }`, each
 * choice's line with only it picked (`on`) and the line with none (`off`).
 * A mark in a blank's answer or in code is that's, not a choice.
 */
function answerChoices(written, line, head, marked) {
  const lead = (marked ? /^[ \t]*\S+[ \t]+/ : /^[ \t]*/).exec(written)[0].length;
  const at = QA.exec(written.slice(lead))?.[0].length;
  if (!at) return null;
  const found = choicesIn(written, lead + at, [...inlineBlanks(written), ...codeSpans(written)]);
  if (!found) return null;
  return { line, text: written, answered: answeredBy(found, inlineBlanks(written)), checked: found.map((c) => c.checked), on: found.map((c, k) => pickedAt(written, found, k)), off: pickedAt(written, found), head };
}

/**
 * Rewrites `Q:`, `A:`, card and vote lines as list items, noting who spoke
 * on each. A vote keeps its `+1` as the item's text, so the item is never
 * empty (an empty one would join the line before); labelling takes it off.
 */
function lines(state) {
  // An aside is a thought of the reader's own, not part of an exchange.
  if (state.inlineMode || state.env.nested) return;
  const said = new Map();
  const lineBase = state.env.lineBase ?? 0;
  // What's open at each depth of nesting, the margin's first: the indent its
  // lines start at, who's speaking (`open`), the question or card a vote is
  // for (`head`), and the label alone on its line that's speaking, if it is
  // one (`cand`), which may yet go back to typed text (`under`).
  let levels = [];
  // Where the words of each list item open around a line start, innermost
  // last, so that an exchange can start inside one (gh-302).
  const cols = [];
  const code = fenced();
  const src = state.src.split('\n');
  // The label alone on its line that what's at depth `at` hangs from, if any.
  const hangsFrom = (at) => levels.slice(0, at).reverse().find((l) => l.cand)?.cand ?? null;
  const out = src.map((line, n) => {
    if (code(line)) {
      levels = [];
      return line;
    }
    const lead = /^[ \t]*/.exec(line)[0];
    // A list item's marker, `- ` or `1) `, before an exchange's line starts
    // one inside the item, as a line indented to its words would (gh-302).
    const marker = ITEM.exec(line.slice(lead.length))?.[0] ?? '';
    const after = line.slice(lead.length + marker.length);
    const opens = Boolean(marker) && (QA.test(after) || BARE.test(after)) && !after.startsWith('\\');
    const body = opens ? after : line.slice(lead.length);
    const indent = width(opens ? lead + marker : lead);
    if (line.trim()) {
      while (cols.length && cols.at(-1) > width(lead)) cols.pop();
    }
    // Inside a list item: at its words' indent, short of code.
    const inItem = cols.length > 0 && indent >= cols.at(-1) && indent < cols.at(-1) + 4;
    if (marker) cols.push(itemCol(lead, marker));
    // A bullet's exchange goes on in the next bullet alike, `- Q:` then
    // `- A:`, each an item of its own.
    let at = opens ? (levels[0]?.indent === indent ? 0 : -1) : depthOf(levels, indent);
    // Indented, a line nests only in an exchange open above it, or starts
    // one in the list item it's in.
    if (at < 0 && (opens || (inItem && (QA.test(body) || BARE.test(body))))) {
      levels = [];
      at = 0;
    }
    if (at < 0) return escapedIn(line, lead, body, inItem);
    const level = levels[at]?.indent === indent ? levels[at] : { indent, open: null, head: null, cand: null };
    const base = at ? levels[0].indent : indent;
    const pad = opens ? lead + marker : ' '.repeat(base + 2 * at);
    const v = level.head && VOTE.exec(body);
    if (v) {
      const text = body.slice(v[0].length);
      levels = [...levels.slice(0, at), level];
      level.head.votes++;
      level.open = { who: '+1' };
      level.cand = null;
      const dep = level.head.under ? level.head : hangsFrom(at);
      said.set(n, { who: '+1', name: v[1]?.trim() ?? '', bare: !text, head: level.head, typed: line, dep });
      return `${pad}+ +1 ${text}`;
    }
    // A label alone on its line is only a candidate here: whether words are
    // under it is read once the asides are out (`under`), as this reads a
    // line at a time.
    const q = QA.exec(body) ?? BARE.exec(body);
    const bare = Boolean(q) && !QA.test(body);
    // Only a card is done, or not.
    if (!q || q[0].startsWith('\\') || (q[2] && !CARDS.has(q[1]))) {
      const escaped = q?.[0].startsWith('\\');
      // Any other line at the margin, or at the indent an exchange inside
      // a list item started at, ends the exchange.
      if (body && levels.length && width(lead) <= levels[0].indent) levels = [];
      return escaped && (!lead || levels.length || inItem) ? lead + body.slice(1) : line;
    }
    const [m, who, box] = q;
    const name = q[3]?.trim() ?? '';
    const text = body.slice(m.length);
    // Back from an exchange nested under it, an answer is a new one, not
    // the one before carried on: that's not in a row.
    if (levels.length > at + 1) level.open = null;
    levels = [...levels.slice(0, at), level];
    const written = state.env.written?.[n] ?? line;
    const choices = who === 'A' ? answerChoices(written, lineBase + n, level.head, opens) : null;
    const { open } = level;
    if (open && !bare && !opens && open.who === who && !CARDS.has(who) && (!name || name === open.name)) {
      said.set(n, { more: true, choices, typed: line, dep: level.cand ?? hangsFrom(at) });
      return `${pad}  ${text}`;
    }
    level.open = { who, name };
    const item = { who, name, votes: 0, head: level.head, choices, depth: at, typed: line, dep: hangsFrom(at) };
    if (bare) Object.assign(item, { under: true, indent, col: base + 2 * at + 2 });
    level.cand = bare ? item : null;
    if (who !== 'A') item.head = level.head = item;
    if (CARDS.has(who)) {
      const after = written.indexOf(who) + who.length;
      const rest = written.slice(after).replace(/^[ \t]+\[[ xX]\]/, '');
      item.done = box === 'x' || box === 'X';
      item.toggle = {
        done: item.done,
        line: lineBase + n,
        on: `${written.slice(0, after)} [x]${rest}`,
        off: box === ' ' ? written : `${written.slice(0, after)}${rest}`,
      };
    }
    said.set(n, item);
    return `${pad}+ ${bare ? UNDER : text}`;
  });
  // An escaped `\A:` loses its backslash even when nothing else changed.
  state.src = out.join('\n');
  if (said.size) state.env[SAID] = said;
}

/**
 * Decides, once the asides are out and before markdown reads the blocks,
 * whether each label alone on its line has words under it (gh-219): the
 * next line with words, indented under it, starting a paragraph. One that
 * hasn't goes back to typed text, with all that hung from it. Read here
 * rather than with the lines, so that an aside between a label and its
 * words is already gone, and goes beside the label.
 */
function under(state) {
  const said = state.env[SAID];
  if (!said || state.inlineMode || state.env.nested) return;
  const labels = [...said].filter(([, s]) => s.under);
  if (!labels.length) return;
  const src = state.src.split('\n');
  // Lines as written -> lines now, the asides out.
  const source = state.env.sourceLines;
  const now = new Map(src.map((_, k) => [source?.[k] ?? k, k]));
  const typed = new Set();
  const back = (item) => {
    if (typed.has(item)) return;
    typed.add(item);
    for (const s of said.values()) if (s.dep === item) back(s);
  };
  for (const [n, item] of labels) if (!typed.has(item) && !wordsUnder(src, now.get(n), item)) back(item);
  if (!typed.size) return;
  for (const [n, s] of [...said]) {
    if (!typed.has(s)) continue;
    said.delete(n);
    const k = now.get(n);
    if (k != null) src[k] = s.typed;
  }
  state.src = src.join('\n');
}

// What starts something other than a paragraph: a list's item (a numbered
// or lettered one too), a quote, a fence, a heading, a table's row, a block.
const NOT_WORDS = /^(?:[-+*]|\d{1,9}[.)]|[a-zA-Z][.)])(?:[ \t]|$)|^(?:>|```|~~~|#{1,6}(?:[ \t]|$)|\||:::)/;

/**
 * Whether the next line of `src` after line `k` with words on it is indented
 * under the label alone on line `k`, `item`, and starts a paragraph: not
 * another block, indented code, or an exchange's line or a vote left as
 * typed.
 */
function wordsUnder(src, k, item) {
  if (k == null) return false;
  let j = k + 1;
  while (j < src.length && !src[j].trim()) j++;
  if (j >= src.length) return false;
  const lead = /^[ \t]*/.exec(src[j])[0];
  const body = src[j].slice(lead.length);
  const w = width(lead);
  // Four past where the item's words start is code.
  return w > item.indent && w - item.col < 4 && !NOT_WORDS.test(body)
    && !QA.test(body) && !BARE.test(body) && !VOTE.test(body);
}

// A list item's marker and the space after it.
const ITEM = /^(?:[-+*]|\d{1,9}[.)])[ \t]+/;

/** Where a list item's words start, its marker `marker` after `lead`, as markdown counts it: one past the marker if five or more spaces follow it. */
const itemCol = (lead, marker) => {
  const mark = marker.trimEnd();
  const w = width(lead + marker);
  return w - width(lead + mark) > 4 ? width(lead + mark) + 1 : w;
};

/** A line `line` left as typed, losing the backslash before an exchange's label inside a list item, as at the margin. */
const escapedIn = (line, lead, body, inItem) => (inItem && /^\\(?:Q|A|Good|Bad|Try)\b/.test(body) ? lead + body.slice(1) : line);

/** How wide `lead` is, a tab to the next stop of four, as markdown counts it. */
const width = (lead) => [...lead].reduce((w, c) => (c === '\t' ? w + 4 - (w % 4) : w + 1), 0);

/**
 * The depth a line indented `indent` is at, among the exchanges open at
 * each depth, `levels`: the margin's, one already open at that indent, or
 * one deeper than the deepest indented less. -1 for an indented line with
 * no exchange open above it.
 */
function depthOf(levels, indent) {
  if (!indent) return 0;
  let at = -1;
  for (let d = 0; d < levels.length && levels[d].indent <= indent; d++) at = d;
  if (at < 0) return -1;
  return levels[at].indent === indent ? at : at + 1;
}

/**
 * Whether `tokens[i]` opens an exchange's item: a `+` one with words of its
 * own, not a `+ Q:` item whose first words are the exchange in it (gh-302).
 */
const exchangeAt = (tokens, i) => tokens[i].type === 'list_item_open' && tokens[i].markup === '+' && tokens[i].map
  && tokens[i + 1]?.type !== 'bullet_list_open';

/**
 * Labels the list items on lines that held a `Q:` or `A:`, and starts a new
 * paragraph where an item carries on from the line before.
 */
function items(state) {
  if (!state.env[SAID] || state.env.nested) return;
  // Lines the parser saw -> lines as written, before asides were taken out.
  const source = state.env.sourceLines;
  const said = { get: (n) => state.env[SAID].get(source?.[n] ?? n) };
  lift(state, said);
  choose(state, said);
  const tokens = state.tokens;
  const counted = state.env.shared ? (state.env.shared[COUNTED] ??= {}) : {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (exchangeAt(tokens, i) && said.get(t.map[0])?.who) {
      const { who, name, votes, bare, head, toggle } = said.get(t.map[0]);
      const kind = who === '+1' ? `vote${bare ? ' qa-bare' : ''}` : `${CARDS.has(who) ? 'card qa-' : ''}${who.toLowerCase()}`;
      addClass(t, `qa qa-${kind}${head?.done ? ' qa-done' : ''}`);
      // A question or a card is linked to by its kind and how many of that
      // kind come before it, `#Q2`, `#G1` (gh-300); src/anchors.js gives it
      // the id unless a heading or a block before it has it.
      if (who === 'Q' || CARDS.has(who)) {
        const letter = LABELS[who] ?? who;
        counted[letter] = (counted[letter] ?? 0) + 1;
        t.meta = { ...t.meta, anchor: `${letter}${counted[letter]}` };
      }
      let k = i + 1;
      while (k < tokens.length && tokens[k].type !== 'inline') k++;
      const inline = tokens[k];
      if (who === '+1') {
        const first = inline.children[0];
        first.content = first.content.replace(/^\+1 ?/, '');
      }
      const label = new state.Token('qa_label', '', 0);
      label.meta = { who, name, votes, toggle };
      inline?.children.unshift(label);
    } else if (t.type === 'inline' && t.map) {
      i = carryOn(state, i, said);
    }
  }
}

/**
 * Takes away the placeholder a label alone on its line left where its words
 * would be, so that the words under it are the item's first (gh-219): with a
 * blank line between, its paragraph, the next one then starting at the
 * label's line; straight under it, its line, and the break after it.
 */
function lift(state, said) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!exchangeAt(tokens, i) || !said.get(t.map[0])?.under) continue;
    const at = tokens.findIndex((x, k) => k > i && x.type === 'inline');
    const inline = tokens[at];
    const [first, next] = inline?.children ?? [];
    if (first?.type !== 'text' || !first.content.startsWith(UNDER)) continue;
    if (inline.children.length === 1 && first.content.trim() === UNDER) {
      tokens.splice(at - 1, 3);
      // Its words' paragraph starts at the label's line, as it would beside
      // it, so an aside on them lines up with the card, not inside it (rows.js).
      const words = tokens[at - 1];
      if (words?.type === 'paragraph_open' && words.map) words.map = [t.map[0], words.map[1]];
    } else if (first.content.trim() === UNDER && /break$/.test(next?.type)) {
      inline.children.splice(0, 2);
      inline.map = [inline.map[0] + 1, inline.map[1]];
    } else {
      first.content = first.content.slice(UNDER.length);
    }
  }
}

/**
 * Makes the choices on each answer's line that has them (`choices`), and
 * keeps the words of each question and card, to name the choices answering
 * it by.
 */
function choose(state, said) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const item = exchangeAt(tokens, i) && said.get(t.map[0]);
    if (item?.who && item.who !== 'A' && item.who !== '+1') {
      const inline = tokens.slice(i + 1).find((x) => x.type === 'inline');
      item.words = words(inline?.children ?? []);
    } else if (t.type === 'inline' && t.map && t.children) {
      chooseIn(state, t, said);
    }
  }
}

/** What `children` say, in words: their text, a blank's what goes there. */
const words = (children) => unplaced(children.map((c) => (/break$/.test(c.type) ? ' ' : c.nesting === 0 && !c.type.startsWith('html') ? c.content : '')).join(''))
  .replace(/\s+/g, ' ').trim();

/**
 * Each line of `inline` that's an answer's with choices, made into them:
 * its line breaks say which line is which, as carryOn's do. A line that
 * doesn't start and end outside any emphasis or link stays as typed.
 */
function chooseIn(state, inline, said) {
  let line = inline.map[0];
  let depth = 0;
  let from = 0;
  let row = [];
  const out = [];
  const end = () => {
    const choices = !from && !depth && said.get(line)?.choices;
    out.push(...(choices ? choiceRow(state, row, choices) : row));
    row = [];
  };
  for (const c of inline.children) {
    if (/break$/.test(c.type)) {
      end();
      out.push(c);
      line++;
      from = depth;
      continue;
    }
    row.push(c);
    depth += c.nesting;
  }
  end();
  inline.children = out;
}

/**
 * The tokens of an answer's line, `row`, as its choices: a group, each
 * choice's mark its button, and its words up to the next. As typed, unless
 * its marks are the ones `choices` found on the line as written, each
 * outside emphasis and links.
 */
function choiceRow(state, row, choices) {
  const parts = [];
  let depth = 0;
  for (const c of row) {
    if (c.type === 'text' && c.content.search(MARK) >= 0) {
      if (depth) return row;
      c.content.split(MARK).forEach((piece, k) => parts.push(k % 2 ? { mark: piece } : textToken(state, piece)));
    } else parts.push(c);
    depth += c.nesting;
  }
  if (parts.filter((p) => p.mark).length !== choices.on.length) return row;
  const open = new state.Token('qa_choices_open', 'span', 1);
  open.meta = { ...choices, answered: choices.answered, name: choices.head?.words };
  const out = [open];
  let choice = null;
  const finish = () => {
    if (!choice) return;
    const last = out.at(-1);
    if (last.type === 'text') last.content = last.content.trimEnd();
    choice.meta.blank = choice.meta.tokens.some((t) => t.type === 'field_inline');
    choice.meta.name = words(choice.meta.tokens);
    out.push(Object.assign(new state.Token('qa_choice_close', '', -1), { meta: choice.meta }));
  };
  for (const p of parts) {
    if (p.mark) {
      finish();
      const k = (choice?.meta.k ?? -1) + 1;
      choice = new state.Token('qa_choice_open', '', 1);
      choice.meta = { k, line: choices.line, on: choices.on[k], checked: choices.checked[k], tokens: [] };
      out.push(choice);
    } else if (!choice) {
      // Before the first mark, only space, as on the line as written.
      if (p.type !== 'text' || p.content.trim()) return row;
    } else {
      if (!choice.meta.tokens.length && p.type === 'text') p.content = p.content.trimStart();
      choice.meta.tokens.push(p);
      out.push(p);
    }
  }
  finish();
  out.push(new state.Token('qa_choices_close', '', -1));
  return out;
}

/**
 * An answer carried on straight after the line before landed in that line's
 * paragraph: split it off into a paragraph of its own, or, in a tight list
 * where paragraphs aren't shown, mark the break. Returns where to go on from.
 */
function carryOn(state, i, said) {
  const tokens = state.tokens;
  const inline = tokens[i];
  const [start, end] = inline.map;
  // The k-th line break in the paragraph comes before its line start + k.
  const breaks = inline.children.flatMap((c, at) => (c.type === 'softbreak' ? [at] : []));
  const cuts = breaks.filter((at, k) => said.get(start + k + 1)?.more && start + k + 1 < end);
  if (!cuts.length) return i;
  const open = tokens[i - 1];
  const close = tokens[i + 1];
  if (open.hidden) {
    for (const at of cuts) inline.children.splice(at, 1, new state.Token('qa_para', '', 0));
    return i;
  }
  const pieces = [];
  let from = 0;
  for (const at of [...cuts, inline.children.length]) {
    const piece = new state.Token('inline', '', 0);
    piece.children = inline.children.slice(from, at);
    piece.content = '';
    piece.level = inline.level;
    pieces.push(piece);
    from = at + 1;
  }
  const copy = (t) => Object.assign(new state.Token(t.type, t.tag, t.nesting), t, { attrs: t.attrs?.map((a) => [...a]) ?? null });
  const run = pieces.flatMap((piece, k) => (k === 0 ? [piece] : [copy(close), copy(open), piece]));
  tokens.splice(i, 1, ...run);
  return i + run.length - 1;
}

export default {
  name: 'qa',
  plugin: qa,
  css: fs.readFileSync(new URL('./qa.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to make a card's label clickable.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
