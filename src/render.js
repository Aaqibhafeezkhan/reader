/**
 * Markdown (with `~` asides) -> { css, body, title, anchors } for the preview pane.
 *
 * One markdown-it parses every document, its front matter and comments
 * taken off first (page.js), then with each feature's plugin (features/),
 * asides among them. columns.js lays the
 * tokens out in two columns, and the preview iframe, loaded once, has its
 * style and body swapped for these on every keystroke.
 */

import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { columns } from './columns.js';
import { readBackground, backdrop, CSS as BACKGROUND_CSS } from './background.js';
import { fontCss } from './fonts.js';
import { accentCss } from './accent.js';
import { FEATURES, checkRequires } from '../features/index.js';
import { page as pageRule } from './page.js';
import { headingIds, anchors } from './anchors.js';

// Whether to mark each block with its line: the core's, as no feature reads it.
const LINES = Symbol('lines');

// What a page can be drawn for: the app's preview, beside the editor; a
// slide presented; or an export, a file that runs none of the app's scripts.
const PURPOSES = ['preview', 'present', 'export'];

/** The markdown-it that parses a document, built from `features`. */
function markdown(features) {
  // Features that read the file as written go before the rest, their rules
  // before the page's front matter and comments come off.
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });
  md.use(pageRule, features);
  for (const f of features.filter((f) => f.plugin && f.raw)) md.use(f.plugin);
  for (const f of features.filter((f) => f.plugin && !f.raw)) md.use(f.plugin);
  // A `late` plugin, which reads what all of them leave as text (the words an
  // aside chooses), goes after.
  for (const f of features.filter((f) => f.late)) md.use(f.late);
  // Every heading's id, from its words (anchors.js).
  md.use(headingIds);
  md.core.ruler.push('reader_lines', (state) => {
    if (state.env[LINES] && !state.inlineMode && !state.env.nested) markLines(state.tokens, state.env);
  });
  return md;
}

const md = markdown(FEATURES);

/**
 * A document's title: the one its front matter names, or else its file's
 * name, as the editor shows it. A document with neither is `Untitled`.
 */
export function titleOf(meta, file) {
  return meta?.title || (file ? path.basename(file, path.extname(file)) : 'Untitled');
}

/**
 * `line` is the line of the file `src` starts on, when it is only part of
 * one (a slide), so whatever is written back by line number finds its line.
 * `file` is the document's path, and `read(path)` reads another file from
 * the content directory, for features that may (a puzzle's board). `shared`
 * is kept by features across the renders of one document's parts (a deck's
 * slides), to number things through the whole of it. `frontMatter` is
 * the front matter of the file `src` is a part of, for when it has none of
 * its own (a deck's, for one slide of it), for the settings a part takes
 * from its file (the names of a staged box's stages, features/tasks). `lines` marks each block with the line of the file
 * it was drawn from, `data-line`, for scrolling in step with the editor.
 * `for` is what the page is drawn for, `'preview'` unless given:
 * `'present'`, a slide being presented, where the deck keeps the page's
 * fields shut, or `'export'`, a page that will run no script of the app's,
 * so draws nothing that would wait on one. Features read it, with whether
 * this is a whole file or a part of one (`layout`), on `env.drawing`.
 * `background` is what's behind the page (see background.js) when it isn't
 * the front matter's to say: a slide's own, or its deck's, or null for none.
 * `fonts` is likewise the front matter that names the fonts (see fonts.js)
 * and the accent (see accent.js): a slide's deck's. `drawn` is what the preview frame
 * drew of the page, by feature (`{ mermaid: { text: svg } }`), to set into
 * it where the page will have nothing to draw it (export.js). `now` is the
 * time, in ms, that the page is drawn as of (now, if not given): a page past
 * the time its front matter says it's open until is drawn as a record.
 * `layout` is how much of a page this is, when it isn't all of one: see columns.js.
 */
export function render(src, options) {
  return renderWith(md, FEATURES, src, options);
}

/**
 * render(), with only `features`, in their order: for a test that leaves
 * one out, to show the page renders without it. Throws, as the features'
 * list does, unless each one's `requires` are among them.
 */
export function makeRenderer(features) {
  const own = markdown(checkRequires(features));
  return (src, options) => renderWith(own, features, src, options);
}

/** render(), by `md`, built from `features`. */
function renderWith(md, features, src, { file, read, line = 0, shared = {}, frontMatter, lines = false, background, fonts, drawn, for: purpose = 'preview', now, layout } = {}) {
  if (!PURPOSES.includes(purpose)) throw new Error(`A page is drawn for one of ${PURPOSES.join(', ')}, not ${purpose}`);
  const text = src || '';
  const drawing = { for: purpose, what: layout && layout !== 'page' ? 'part' : 'file' };
  const env = { lineBase: line, file, read, shared, frontMatter, drawn, drawing, now, [LINES]: lines };
  const tokens = md.parse(text, env);
  const meta = env.frontMatter || {};
  // The notes in the page's margin (src/columns.js), its asides among them.
  const notes = env.margin || [];

  // Column headings ("Speaker" / "Listener") only help when the document
  // names its voices; a journal entry doesn't need them.
  const headings = Boolean(drawing.what === 'file' && notes.length && (meta.speaker || meta.listener));
  const title = titleOf(meta, file);

  const page = columns(md, tokens, env, { headings, title, layout });
  // Then each feature's pass over the finished page, if it has one.
  const body = features.reduce((html, f) => (f.html ? f.html(html) : html), figures(page.body.trim()));
  const behind = backdrop(background === undefined ? readBackground(meta.background) : background);
  return {
    // The document's fonts last, over the theme's and under a `:::` block's
    // own, and its accent, which the theme makes its accent from.
    css: [page.css.trim(), CSS, BACKGROUND_CSS, ...features.map((f) => f.css).filter(Boolean), fontCss(fonts ?? meta), accentCss(fonts ?? meta)].filter(Boolean).join('\n'),
    body: behind + body,
    // How many notes are in the margin, asides or any other feature's.
    notes: notes.length,
    title,
    // Each heading's id, to the line of the file it's on.
    anchors: anchors(env),
  };
}

/**
 * A slide's speaker notes, rendered by the same markdown as the page, but
 * as plain HTML, without its columns: they're read at a glance, mid-talk.
 */
export function renderNotes(src) {
  return src ? md.render(src, { lineBase: 0, shared: {} }).trim() : '';
}

/**
 * Each block that opens on a line of its own gets that line of the file as
 * `data-line`, 0-based. Token maps count lines of what's left once the
 * front matter, comments and asides are off, so they're traced back through `env.sourceLines`. Asides aren't
 * marked: they're parsed apart, and set beside the line they follow.
 */
function markLines(tokens, env) {
  const base = env.lineBase ?? 0;
  for (const t of tokens) {
    if (!t.block || !t.map || t.nesting < 0 || t.type === 'inline') continue;
    t.attrSet('data-line', String(base + (env.sourceLines?.[t.map[0]] ?? t.map[0])));
  }
}

const FIGURE = /<p((?: data-line="\d+")?)>(<img src="[^"]*" alt="([^"]*)"(?: title="([^"]*)")?(?: style="[^"]*")?>)<\/p>/g;

/**
 * An image alone in its paragraph becomes a figure, captioned by its title,
 * or failing that its alt text: `![a cat](cat.jpg "Ginger, 2019")`. The
 * figure keeps its paragraph's line, when it was marked with one.
 */
export function figures(html) {
  return html.replace(FIGURE, (m, line, img, alt, title) => {
    const caption = title || alt;
    return caption
      ? `<figure${line}>${img}<figcaption>${caption}</figcaption></figure>`
      : `<figure${line}>${img}</figure>`;
  });
}

const CSS = `
/* Heard, not seen: what's said to a screen reader and not shown, as any
 * feature writes it (a link's site, a blank's emptiness), and what the
 * preview frame says aloud (Preview.say). One rule, which an export carries. */
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
figure { margin: var(--gm-space-5) 0; }
figure img { display: block; max-width: 100%; height: auto; }
figcaption {
  font-family: var(--gm-sans);
  font-size: 0.82rem;
  color: var(--gm-ink-soft);
  margin-top: var(--gm-space-3);
}
img { max-width: 100%; }



table { margin: var(--gm-space-5) 0; }
th {
  font-family: var(--gm-sans);
  font-size: 0.88em;
  font-weight: 600;
  background: var(--gm-th);
}
tbody tr:nth-child(even) td { background: var(--gm-stripe); }


`;
