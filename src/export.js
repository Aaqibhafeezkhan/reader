/**
 * A document as one HTML file, to keep or send: the page the preview shows,
 * with its stylesheet and the images it takes from the content directory
 * inside it, so it reads the same wherever it's opened.
 *
 * A deck is saved as its pages, as it's worked through (slides.js), one
 * after another and without its notes. Printed, each page starts a sheet
 * of its own, and each sheet is numbered at its foot.
 *
 * Nothing in the file draws. A diagram is in it as the preview frame drew
 * it, when the app sends that along (`drawn`, see render.js), and is
 * otherwise left as the text it was written as, as a puzzle is; a field or
 * a checkbox shows what the file says.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { render, titleOf } from './render.js';
import { typeOf } from '../static/markdown.js';
import { isDeck, pages } from './slides.js';
import { LIGHT_COLOURS } from './columns.js';
import { escapeHtml, escapeAttr } from '../features/source.js';

const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

const IMG_SRC = /(<img\b[^>]*?\ssrc=")([^"]*)(")/g;
const A_HREF = /(<a\b[^>]*?\shref=")([^"]*)(")/g;
// The backdrop's image (background.js), its quotes escaped for the attribute.
const BACKDROP_URL = /(background-image: url\(&quot;)(.*?)(&quot;\))/g;

// A deck's pages, one after another, each with what's behind it to itself.
// On paper, each starts a sheet, and every sheet of them is numbered. What's
// behind a page is set for a slide's screen, not a sheet, so paper is left
// plain, in the light colours, whatever the screen's.
const PAGES_CSS = `
.gm-page { position: relative; isolation: isolate; }
.gm-page > .gm-bg { position: absolute; }
.gm-page + .gm-page { border-top: 1px solid var(--gm-rule); }
@media print {
  .gm-page { page: numbered; }
  .gm-page + .gm-page { border-top: none; break-before: page; }
  .gm-page > .gm-bg { display: none; }
  :root.gm-dark { ${LIGHT_COLOURS} }
}
@page numbered {
  @bottom-center {
    content: counter(page);
    font-family: "Avenir Next", Avenir, "Helvetica Neue", Inter, system-ui, sans-serif;
    font-size: 9pt;
    color: ${LIGHT_COLOURS.match(/--gm-ink-soft: ([^;]+);/)[1]};
  }
}
`;

// Light text on a dark background, as the preview frame picks it.
const INK_JS = `${fs.readFileSync(new URL('../static/ink.js', import.meta.url), 'utf8')}Ink.set();\n`;
const INK = `<script>${INK_JS}</script>\n`;

// What the page may load and run: its own styles, images inside it or on
// the web, and the one script above. A diagram drawn into it can't add
// another, should one ever get past mermaid's own cleaning.
const CSP = [
  "default-src 'none'",
  'img-src * data:',
  "style-src 'unsafe-inline'",
  `script-src 'sha256-${crypto.createHash('sha256').update(INK_JS).digest('base64')}'`,
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * `{ name, html, missing }` for the document at `file`: the name to save it
 * under, the page, and the images it names from the directory that aren't
 * there, left as links. `content` is the content directory (content.js), and `drawn`
 * what the preview frame drew of the document, if it was asked. A link to
 * one of `linked`, documents saved with this one, goes to its page.
 */
export function exportHtml(content, file, drawn, linked = new Set()) {
  const read = (rel) => content.read(rel).text;
  const text = content.read(file).text;
  const out = (isDeck(text) && deck(text, { file, read, drawn })) || render(text, { file, read, drawn, exported: true });
  const missing = [];
  const inline = (m, before, src, after) => `${before}${dataUrl(content, file, src, missing) ?? src}${after}`;
  const page = (m, before, href, after) => `${before}${pageOf(file, href, linked) ?? href}${after}`;
  const body = out.body.replace(IMG_SRC, inline).replace(BACKDROP_URL, inline).replace(A_HREF, page);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(out.title)}</title>
<style>
${out.css.replace(/<\/(?=style)/gi, '<\\/')}
</style>
</head>
<body>
${body}
${body.includes('class="gm-bg"') ? INK : ''}</body>
</html>
`;
  return { name: `${path.basename(file, path.extname(file))}.html`, html, missing };
}

/**
 * Which way a deck's sheets are turned: as `print:` says, `portrait` or
 * `landscape`; else landscape for `type: slides`, and portrait for a
 * workbook, a packet to fill in.
 */
function orientation(meta) {
  const said = meta.print?.toLowerCase();
  if (['portrait', 'landscape'].includes(said)) return said;
  return typeOf(meta) === 'slides' ? 'landscape' : 'portrait';
}

/**
 * A deck as one page: `{ css, body, title }`, as render() gives a document,
 * of each of its pages in turn; or null, when it has none.
 */
function deck(text, { file, read, drawn }) {
  const { css, meta, pages: list } = pages(text, { file, read, drawn, lines: false, exported: true });
  if (!list.length) return null;
  return {
    css: `${css}${PAGES_CSS}@page numbered { size: ${orientation(meta)}; }\n`,
    body: list.map((p) => `<div class="gm-page">\n${p.body.trim()}\n</div>`).join('\n'),
    title: titleOf(meta, file),
  };
}

/**
 * Where `href`, as written in the page of the document at `file`, goes once
 * the documents `linked` are pages: the page's name in place of the
 * document's, when it's one of them; or null, and it stays as it is.
 */
function pageOf(file, href, linked) {
  const m = /^([^?#]*)([?#].*)?$/.exec(href.replace(/&amp;/g, '&'));
  if (!m[1] || /^([a-z][a-z0-9+.-]*:|\/)/i.test(m[1])) return null;
  let rel;
  try {
    rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(m[1])));
  } catch {
    return null;
  }
  if (!linked.has(rel)) return null;
  const ext = path.posix.extname(m[1]);
  return escapeAttr(`${m[1].slice(0, -ext.length)}.html${m[2] ?? ''}`);
}

/**
 * The image at `src`, as written in the page of the document at `file`, as
 * a `data:` URL; or null when it isn't a file of the content directory's (a
 * URL, a missing file) and stays as it is. A missing file goes on `missing`.
 */
function dataUrl(content, file, src, missing) {
  const ref = src.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  if (!ref || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(ref)) return null;
  let rel;
  try {
    rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(ref.replace(/[?#].*$/, ''))));
    const type = IMAGE_TYPES[path.extname(rel).toLowerCase()];
    if (!type) return null;
    const { abs } = content.statFile(rel);
    return escapeAttr(`data:${type};base64,${fs.readFileSync(abs).toString('base64')}`);
  } catch {
    if (rel && !missing.includes(rel)) missing.push(rel);
    return null;
  }
}
