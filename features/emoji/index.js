/**
 * Emoji shortcodes like `:tada:` show as 🎉 in the rendered page but stay as
 * `:tada:` in the file. Code spans and unknown names are left as written.
 *
 * A pass over the finished page rather than its tokens, so a shortcode in
 * the masthead, a figure's caption or a filled-in field shows too.
 *
 * A browser has no emoji, so `:chrome:`, `:safari:`, `:firefox:` and
 * `:edge:` show its mark instead (marks/), drawn in the text's colour and
 * named for a screen reader and as a tooltip.
 */

import fs from 'node:fs';
import EMOJI from 'markdown-it-emoji/lib/data/full.mjs';

// shortcode -> the browser's name, its drawing in marks/<shortcode>.svg.
const MARKS = { chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge' };

const SHORTCODE = /:([a-z0-9_+-]+):/gi;
const RAW = new Set(['code', 'pre']);

/**
 * `:tada:` -> 🎉 in rendered text. The source keeps the shortcode; only the
 * preview shows the emoji. Tags and attributes are left alone, and so is
 * anything inside <code> or <pre>, where the colons are meant literally.
 * Unknown names stay as written.
 */
export function emojify(html) {
  let raw = 0;
  return html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
    if (tag) {
      const t = /^<(\/?)([a-z0-9]+)/i.exec(tag);
      if (t && RAW.has(t[2].toLowerCase())) raw = Math.max(0, raw + (t[1] ? -1 : 1));
      return tag;
    }
    if (raw) return text;
    return text.replace(SHORTCODE, (code, name) => {
      const key = name.toLowerCase();
      if (Object.hasOwn(MARKS, key)) return `<span class="emoji-mark emoji-${key}" role="img" aria-label="${MARKS[key]}" title="${MARKS[key]}"></span>`;
      return EMOJI[key] ?? code;
    });
  });
}

/** A mark's file as a CSS `url()`, without its title. */
function mask(name) {
  const svg = fs.readFileSync(new URL(`./marks/${name}.svg`, import.meta.url), 'utf8')
    .replace(/<title>.*?<\/title>/, '').replace(/ role="img"/, '').trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const CSS = `${fs.readFileSync(new URL('./emoji.css', import.meta.url), 'utf8')}${
  Object.keys(MARKS).map((name) => `.emoji-${name} { --mark: ${mask(name)}; }`).join('\n')}\n`;

export default {
  name: 'emoji',
  html: emojify,
  css: CSS,
};
