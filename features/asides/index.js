/**
 * Asides: a line starting `~` is the reader's own voice, set beside the line
 * it reacts to rather than in the run of the text.
 *
 *   I continue to mourn things that I loved being in the stream of.
 *
 *   ~ Maybe a post about the music; go towards the music
 *
 * Once the page's front matter and comments are off (src/page.js), the
 * asides are lifted out of the source before block parsing, so they cannot
 * disturb the document's structure, and kept on `env.asides`. Each is a
 * note in the page's margin (`env.margin`, src/columns.js), which wants the
 * speaker's stream unbroken so it can choose its own cut points; the
 * feature draws its cell (`cell`). The aliases they may use,
 * `reviewer #: Josh` and `topic c: Coherence`, are the front matter lines
 * the feature claims (`matter`), and make its key, whose topics it offers
 * the page's marks on `env.topics` (features/source.js); who
 * and what the asides are from and about goes in the masthead
 * (`env.masthead`), as a legend.
 *
 * Taking them out shifts the lines the block parser sees again, so the
 * feature traces `env.sourceLines` on through what it took.
 *
 * Once everything else has parsed the page, it marks the words an aside
 * names in brackets (`~a[quick]`) in the line it's written under, and ties
 * the aside to them by a line (marks.js, preview.js).
 *
 * Came from gutter-md, which reader grew out of.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preprocess } from './preprocess.js';
import { readEntry, makeKey, ownClass } from './key.js';
import { marks, about } from './marks.js';
import { escapeHtml, escapeAttr } from '../source.js';
import { shut } from '../blank.js';

export function asides(md) {
  const rule = (state) => {
    // An aside's own body is parsed nested (`env.nested`, features/source.js);
    // it has already been stripped of its markers and must not be re-processed.
    if (state.inlineMode || state.env.nested) return;
    // The aliases the front matter declares, or a deck's, for one slide of it.
    const key = makeKey((state.env.entries ?? []).filter((e) => e.feature === 'asides'));
    const { source, asides, lines } = preprocess(state.src, key);
    state.src = source.endsWith('\n') ? source : source + '\n';
    // Each aside's line, and each line left, traced back to the file
    // through the page's own trace.
    const page = state.env.sourceLines ?? [];
    for (const a of [...asides, ...asides.flatMap((t) => t.replies ?? [])]) a.line = page[a.line] ?? a.line;
    state.env.sourceLines = lines.map((k) => page[k] ?? k);
    state.env.asides = asides;
    // The key's topics, for a mark in braces to be in (`[words]{c}`).
    state.env.topics = new Map([...key].filter(([, e]) => e.kind === 'topic'));
    // Each one a note in the margin, its cell drawn as the page is laid
    // out, once every rule has run, so the words it chose are marked by then.
    const { md, env } = state;
    env.margin = [...(env.margin ?? []), ...asides.map((aside) => ({ anchor: aside.anchor, render: (attrs) => cell(md, aside, env, attrs) }))];
    const shown = legend(asides, key, env);
    if (shown) env.masthead = [...(env.masthead ?? []), shown];
  };
  // After the page's front matter and comments are off, or after
  // normalizing when there's no such rule (a test of the feature alone).
  try {
    md.core.ruler.after('page_extract', 'aside_extract', rule);
  } catch {
    md.core.ruler.after('normalize', 'aside_extract', rule);
  }
}

/**
 * An aside's cell in the margin, with `attrs`, the attributes the page
 * gives it (` data-in-tab="2"`, for one that shows with a tab).
 */
function cell(md, aside, env, attrs = '') {
  const html = md.renderer.render(asideTokens(md, aside, env), md.options, env);
  // The words it's about, if it chose some (marks.js), follow who it's
  // from and what it's about, or its `~`.
  const words = about(aside.mark);
  const tied = aside.mark?.id;
  const style = [aside.by?.who && `--by: ${escapeHtml(aside.by.who.color)}`, tied && aside.mark.color && `--mk: ${escapeHtml(aside.mark.color)}`].filter(Boolean).join('; ');
  attrs = `${style ? ` style="${style}"` : ''}${tied ? ` data-mark="${escapeHtml(tied)}"` : ''}${voice(aside.by)}${attrs}`;
  const replies = (aside.replies ?? []).map((r) => reply(md, r, env)).join('');
  const resolved = aside.box?.checked;
  // A thread that can be resolved ends with its button, as a section to
  // finish does with its Done (gh-199).
  const foot = aside.box ? `<p class="gm-thread-foot">${resolveButton(aside, env)}</p>\n` : '';
  // A resolved thread folds to its first line, cut short; opened, it's the
  // rest, the file as it was, without its first line again.
  const fold = (opener) => {
    if (!resolved) return opener + replies + foot;
    const first = /^<p\b[^>]*>([\s\S]*?)<\/p>\n?/.exec(opener);
    const head = first ? first[1] : aside.by ? byChips(aside.by) : '<span class="gm-mark" aria-hidden="true">~</span>';
    const rest = first ? opener.slice(first[0].length) : opener;
    return `<details class="gm-thread">\n<summary><span class="vh">Resolved: </span>${head}</summary>\n${rest}${replies}${foot}</details>\n`;
  };
  const classes = `gm-aside-cell${aside.by ? ' gm-attributed' : ''}${aside.box ? ' gm-resolvable' : ''}${resolved ? ' gm-is-resolved' : ''}`;
  // An attributed aside opens with who it's from and what it's about, at the
  // start of its first paragraph, or above it when it doesn't open with one.
  if (aside.by) {
    const chips = byChips(aside.by) + words;
    const opened = /^<p\b/.test(html) ? html.replace(/^<p\b([^>]*)>/, `<p$1>${chips}`) : `${chips}\n${html}`;
    return `<div class="${classes}" role="note"${attrs}>\n${fold(opened)}</div>`;
  }
  // Slip the `~` in front of the first line of prose so the mark survives into
  // the printed page. It's seen, not read: the aside is a note.
  const lead = `<span class="gm-mark" aria-hidden="true">~</span>${words}`;
  const marked = /<p\b/.test(html) ? html.replace(/<p\b([^>]*)>/, `<p$1>${lead}`) : words ? `<p>${lead}</p>\n${html}` : html;
  return `<div class="${classes}" role="note"${attrs}>\n${fold(marked)}</div>`;
}

/**
 * The button that resolves a thread, "Resolve", and "✓ Resolved" once it
 * is, as a heading's Done: pressed, it writes the aside's line with `[x]`,
 * or `[ ]` again (preview.js).
 */
function resolveButton(aside, env) {
  const { checked, on, off } = aside.box;
  return `<button type="button" class="gm-resolve" data-line="${aside.line}" data-on="${escapeAttr(on)}" data-off="${escapeAttr(off)}"`
    + ` aria-pressed="${checked}"${shut(env)}></button>`;
}

/** A reply in a thread, opening with who it's from, as an aside does. */
function reply(md, r, env) {
  const html = md.renderer.render(asideTokens(md, r, env), md.options, env);
  const lead = r.by ? byChips(r.by) : '<span class="gm-mark" aria-hidden="true">~~</span>';
  const opened = /^<p\b/.test(html) ? html.replace(/^<p\b([^>]*)>/, `<p$1>${lead}`) : `<p>${lead}</p>\n${html}`;
  const style = r.by?.who ? ` style="--by: ${escapeHtml(r.by.who.color)}"` : '';
  return `<div class="gm-reply${r.by ? ' gm-attributed' : ''}"${style}${voice(r.by)}>\n${opened}</div>\n`;
}

/**
 * Who an aside or a reply is from and what it's about, by their aliases,
 * for the legend's filter to go by (preview.js, gh-21): ` data-by="#"
 * data-about="cv"`, or '' for the writer's own.
 */
function voice(by) {
  if (!by) return '';
  const topics = by.topics.map((t) => t.alias).join('');
  return `${by.who ? ` data-by="${escapeAttr(by.who.alias)}"` : ''}${topics ? ` data-about="${escapeAttr(topics)}"` : ''}`;
}

/** The tokens of one aside's content. */
export function asideTokens(md, aside, env) {
  // Parse the aside body as markdown in its own right, so **emphasis**,
  // `code`, links and even nested lists work inside a thought. Link reference
  // definitions carry over; the aside bookkeeping deliberately does not.
  return md.parse(aside.text, { ...env, asides: null, nested: true });
}

// A chip's or a pill's class, and whether it's in an author's own colour.
const chipClass = (kind, color) => `${kind}${ownClass(color)}`;

/**
 * Who an aside is from and what it's about, as chips: the reviewer's name,
 * a pill for each topic, and each alias that isn't declared, with a `?`.
 */
export function byChips(by) {
  const chips = [];
  if (by.who) chips.push(`<span class="${chipClass('gm-who', by.who.color)}">${escapeHtml(by.who.name)}</span>`);
  for (const t of by.topics) chips.push(`<span class="${chipClass('gm-topic', t.color)}" style="--topic: ${escapeHtml(t.color)}">${escapeHtml(t.name)}</span>`);
  for (const c of by.unknown) chips.push(`<span class="gm-unknown" title="Not declared in the front matter">${escapeHtml(c)}?</span>`);
  return `<span class="gm-by">${chips.join('')}</span>`;
}

/**
 * Who and what a document's asides and replies are from and about, with
 * how many of each, and how many of those are in threads still to be
 * resolved, in the order
 * they're declared: a legend for the masthead, or ''.
 */
export function legend(asides, key, env = {}) {
  // Each aside and each reply counts towards who wrote it and what it's
  // about; and those in a thread still to resolve, apart, so what's left shows.
  const counts = new Map();
  const open = new Map();
  const add = (into, e) => into.set(e, (into.get(e) || 0) + 1);
  for (const thread of asides) {
    for (const a of [thread, ...(thread.replies ?? [])]) {
      if (!a.by) continue;
      for (const e of [a.by.who, ...a.by.topics].filter(Boolean)) {
        add(counts, e);
        if (thread.box && !thread.box.checked) add(open, e);
      }
    }
  }
  if (!counts.size) return '';
  const used = [...(key?.values() || [])].filter((e) => counts.has(e));
  // What's unresolved, in a dot at the chip's corner, said in words too.
  const count = (e) => `<b>${counts.get(e)}</b>${open.has(e) ? `<span class="gm-unresolved" title="${open.get(e)} unresolved"><span class="vh">, unresolved: </span>${open.get(e)}</span>` : ''}`;
  // Where the page is read in the app, each chip toggles a filter of the
  // asides by it, and a last button clears it (preview.js, gh-21); not in
  // an export, nor on a slide.
  const filters = !env.exported && !env.deck;
  const tag = filters ? 'button' : 'span';
  const chip = (e) => {
    const by = e.kind === 'reviewer';
    const toggle = filters ? ` type="button" data-filter="${by ? 'by' : 'about'}" data-alias="${escapeAttr(e.alias)}" aria-pressed="false"` : '';
    return `<${tag} class="${chipClass(by ? 'gm-who' : 'gm-topic', e.color)}"${toggle} style="${by ? '--by' : '--topic'}: ${escapeHtml(e.color)}">${escapeHtml(e.name)} ${count(e)}</${tag}>`;
  };
  const clear = filters ? '<button type="button" class="gm-legend-clear" aria-label="Show every aside" hidden>×</button>' : '';
  return `<div class="gm-legend"${filters ? ' role="group" aria-label="Show the asides of"' : ''}>${used.map(chip).join('')}${clear}</div>`;
}

export default {
  name: 'asides',
  // reader lays the asides out in columns of their own.
  plugin: asides,
  // Claims the front matter's `reviewer #: Josh` and `topic c: Coherence`.
  matter: readEntry,
  // Last of all: the words an aside chooses are found in what the others
  // leave as text, tabs' among them (marks.js).
  late: marks,
  css: ['./asides.css', './marks.css'].map((f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n'),
  // The line from a mark to the asides about it.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
