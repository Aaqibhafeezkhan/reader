/**
 * The page's layout: two columns, the speaker's words in one and the
 * reader's asides in the other, each aside level with the passage it was
 * written against; above them, the masthead from the front matter and, when
 * the document names its voices, the column headings.
 *
 * Features leave notes for the margin on `env.margin`, and the speaker's
 * tokens unbroken. Each note is `{ anchor, render(attrs) }`: the line of the
 * cleaned source it goes before, and its cell, given the attributes the
 * block it's beside is tagged with (`noteAttrs`, features/source.js); the
 * asides feature's `~` lines are such notes. Here the tokens
 * are cut into rows (splitPairs, features/rows.js) and each row is drawn
 * beside its notes. What else goes in the masthead, under the byline, is on
 * `env.masthead` (the asides' legend), and what goes at the end of the
 * byline itself on `env.byline` (when the page closes).
 *
 * Not every page is a whole document (`layout`). A part of a deck has no
 * masthead, its deck's being said elsewhere. A slide also sets its opening
 * heading apart from the rest, as `.slide-title` above `.slide-body`, for the
 * deck's stylesheet (src/slides.js) to keep one at the top and center the
 * other; one with no opening heading is all body. A cover is a slide that's
 * all headings (`.slide-cover`), to be centered whole.
 *
 * A front matter key with an alias, `reviewer #: Josh` or `topic c:
 * Coherence`, declares something for a feature, which claims the line
 * (src/page.js). One that no feature claims isn't read as it's written: a
 * reviewer is the page's own, someone who read it over, and shows in the
 * byline as a chip with their name; anything else is left out. Came from gutter-md, which
 * reader grew out of.
 */

import fs from 'node:fs';
import { splitPairs, noteAttrs } from '../features/rows.js';
import { escapeHtml } from '../features/source.js';

const CSS = fs.readFileSync(new URL('./columns.css', import.meta.url), 'utf8');

// Front matter that's said elsewhere on the page, or is a setting, not
// something to read: how a deck is timed, moved through, paged and printed
// (src/slides.js, export.js), and what kind of document it is.
const UNSHOWN = new Set(['title', 'author', 'date', 'tags', 'speaker', 'listener', 'background', 'accent', 'font', 'title-font', 'time', 'transition', 'paging', 'print', 'type']);

// A key with an alias after it, `reviewer #` or `topic c`, and a reviewer's.
const ALIASED = /[ \t]\S$/;
const REVIEWER = /^reviewer[ \t]\S$/;

// A reviewer's chip in the byline, on a page that has one: the asides
// feature, when it's on, draws its own in its legend instead (asides.css).
const REVIEWER_CSS = `
.gm-byline .gm-who {
  font-weight: 600;
  line-height: 1.5;
  padding: 0 var(--gm-space-3);
  border-radius: 3px;
  color: var(--gm-paper);
  background: var(--gm-accent);
}
@media (forced-colors: active) {
  .gm-byline .gm-who { background: CanvasText; }
}`;

/** The layout's stylesheet. */
export function themeCss() {
  return CSS;
}

/**
 * The light colours' declarations, as columns.css sets them: what a page
 * goes back to where it's dark but mustn't be, as on paper (export.js).
 */
export const LIGHT_COLOURS = CSS.match(/\/\* colours, light \*\/\n:root \{([^}]*)\}/)[1].trim();

/**
 * Lay out a parsed document in two columns: the masthead, the column
 * headings, and each passage of the speaker's beside the notes in the
 * margin about it.
 *
 * @param {MarkdownIt} md the instance that parsed `tokens`
 * @param {Array} tokens
 * @param {object} env the env they were parsed with
 * @param {object} [opts]
 * @param {boolean} [opts.headings=true] show the column headings
 * @param {string} [opts.title]
 * @param {'page'|'part'|'slide'|'cover'} [opts.layout='page']
 * @returns {{css: string, body: string, title: string}}
 */
export function columns(md, tokens, env, { headings = true, title, layout = 'page' } = {}) {
  const meta = env.frontMatter || {};
  const pairs = splitPairs(tokens, env.margin || []);
  const docTitle = title || meta.title || 'Notes';

  const speakerLabel = meta.speaker || 'Speaker';
  const listenerLabel = meta.listener || meta.author || 'Listener';

  const speak = (speaker) => (speaker.length ? md.renderer.render(speaker, md.options, env) : '');
  const row = (speakerHtml, notes) => {
    // Each with what its block gives a note: written in a tab, it shows
    // while that tab does (features/tabs).
    const noteHtml = notes.map((note) => note.render(noteAttrs(tokens, note.anchor))).join('\n');
    const cells = [
      `<div class="gm-speaker">\n${speakerHtml}</div>`,
      noteHtml ? `<div class="gm-asides">\n${noteHtml}\n</div>` : '<div></div>',
    ];
    return `<section class="gm-pair">\n${cells.join('\n')}\n</section>`;
  };
  const rows = (some) => some.map((pair) => row(speak(pair.speaker), pair.notes));

  const body = layout === 'slide' ? slideBody(pairs, speak, row, rows) : rows(pairs).join('\n');

  const colheads = headings
    ? `<div class="gm-colheads"><div>${escapeHtml(speakerLabel)}</div><div class="gm-h-aside">${escapeHtml(listenerLabel)}</div></div>`
    : '';

  const head = masthead(meta, docTitle, (env.masthead || []).join('\n  '), env.byline || []);
  // With no masthead, the column headings or the first row come straight after the opening tag.
  const under = `${colheads}\n${body}\n</div>`;
  return {
    title: docTitle,
    // The byline's reviewer chips, if it has any, want their look.
    css: head.includes('<span class="gm-who">') ? themeCss() + REVIEWER_CSS : themeCss(),
    body: layout === 'page'
      ? `<div class="gm-doc">\n${head}\n${under}`
      : `<div class="${layout === 'cover' ? 'gm-doc slide-cover' : 'gm-doc'}">\n${under.trimStart()}`,
  };
}

/** A slide's rows, under its opening heading if the first of them opens with one. */
function slideBody(pairs, speak, row, rows) {
  if (!pairs.length) return '';
  const [{ speaker, notes }, ...others] = pairs;
  if (speaker[0]?.type !== 'heading_open') return `<div class="slide-body">\n${rows(pairs).join('\n')}\n</div>`;
  const heading = speak(speaker.slice(0, 3)).trim();
  const first = row(speak(speaker.slice(3)), notes);
  // A row that held only the title is gone with it.
  const left = [...(first === row('', []) ? [] : [first]), ...rows(others)];
  return `<header class="slide-title">\n${heading}\n</header>\n<div class="slide-body">\n${left.map((r) => `${r}\n`).join('')}</div>`;
}

/** A reviewer's chip: their name, without the colour after it, or '' for none. */
function reviewerChip(value) {
  const name = value.split(',')[0].trim();
  return name ? `<span class="gm-who">${escapeHtml(name)}</span>` : '';
}

function masthead(meta, docTitle, more = '', said = []) {
  const bits = [];
  if (meta.author) bits.push(`<span>${escapeHtml(meta.author)}</span>`);
  if (meta.date) bits.push(`<span>${escapeHtml(meta.date)}</span>`);
  if (meta.tags) {
    const tags = meta.tags
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((t) => `<span class="gm-tag">#${escapeHtml(t)}</span>`)
      .join(' ');
    if (tags) bits.push(tags);
  }
  const extras = Object.entries(meta)
    // A key holding others (`multibox:`) is a setting, not something said.
    .filter(([k, v]) => !UNSHOWN.has(k) && typeof v === 'string')
    .map(([k, v]) => (REVIEWER.test(k) ? reviewerChip(v) : ALIASED.test(k) ? '' : `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`))
    .filter(Boolean);
  bits.push(...extras, ...said);

  return `<header class="gm-masthead">
  <h1 class="gm-title">${escapeHtml(docTitle)}</h1>
  ${bits.length ? `<div class="gm-byline">${bits.join('')}</div>` : ''}${more ? `\n  ${more}` : ''}
</header>`;
}
